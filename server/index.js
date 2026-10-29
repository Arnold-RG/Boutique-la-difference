'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hashPassword, parseHash, verifyPassword } = require('./passwords');

const BODY_LIMIT = 4096;
const RATE_PER_MIN = 20;
const DEFAULT_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_MS = 15 * 60 * 1000;
const DEFAULT_ACCOUNT_ATTEMPTS = 10;
const DEFAULT_PRUNE_MS = 60 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

// Hash both sides first so the comparison is constant-time and does not
// reveal the length of the configured value.
function bytesEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

/**
 * Pick the client address from X-Forwarded-For when behind trusted proxies.
 * Each proxy appends the address it saw, so the right-most entries are the
 * ones our own proxies wrote; anything further left is client-controlled.
 * With `hops` trusted proxies, the client is the entry `hops` from the end.
 */
function pickForwardedFor(header, hops, fallback) {
  if (typeof header !== 'string' || !header.trim()) return fallback;
  const list = header.split(',').map((part) => part.trim()).filter(Boolean);
  if (!list.length) return fallback;
  const n = Math.max(1, Math.floor(Number(hops) || 1));
  const pick = list.length >= n ? list[list.length - n] : list[0];
  return pick.slice(0, 80) || fallback;
}

function lastListValue(header) {
  const list = String(header || '').split(',').map((part) => part.trim()).filter(Boolean);
  return list.length ? list[list.length - 1] : '';
}

function createApp(options) {
  const root = path.resolve(options.root || path.join(__dirname, '..'));
  const username = String(options.username || '');
  const passwordHash = String(options.passwordHash || '');
  const sessionSecret = String(options.sessionSecret || '');
  const parsedHash = parseHash(passwordHash);
  const configured = Boolean(username && parsedHash && sessionSecret.length >= 16);
  const sessionMs = Math.max(1, Number(options.sessionHours) || 8) * 60 * 60 * 1000;
  const trustProxy = options.trustProxy === true || options.trustProxy === '1';
  const maxAttempts = Number(options.maxAttempts) || DEFAULT_ATTEMPTS;
  const lockoutMs = Number(options.lockoutMs) || DEFAULT_LOCKOUT_MS;
  const decoyHash = options.decoyHash || '';
  const proxyHops = Math.max(1, Math.floor(Number(options.proxyHops) || 1));
  const accountMaxAttempts = Number(options.accountMaxAttempts) || DEFAULT_ACCOUNT_ATTEMPTS;
  const pruneMs = Number(options.pruneMs) || DEFAULT_PRUNE_MS;
  const now = typeof options.now === 'function' ? options.now : Date.now;

  const sessions = new Map();
  const failures = new Map(); // per (ip, account)
  const accountFailures = new Map(); // per account, any ip
  const rates = new Map();

  // Session cookie = <random id>.<HMAC-SHA256(sessionSecret, id)>. The id is
  // still looked up in memory; the MAC means a forged or truncated cookie is
  // rejected before the lookup and ties cookies to this server's secret.
  function signId(id) {
    return crypto.createHmac('sha256', sessionSecret).update(id).digest('base64url');
  }

  function sessionCookieValue(id) {
    return id + '.' + signId(id);
  }

  function idFromCookie(value) {
    if (!value || !/^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$/.test(value)) return null;
    const [id, mac] = value.split('.');
    return bytesEqual(mac, signId(id)) ? id : null;
  }

  function clientIp(req) {
    const direct = String(req.socket.remoteAddress || 'unknown');
    if (!trustProxy) return direct;
    return pickForwardedFor(req.headers['x-forwarded-for'], proxyHops, direct);
  }

  function isHttps(req) {
    if (trustProxy && req.headers['x-forwarded-proto']) {
      return lastListValue(req.headers['x-forwarded-proto']) === 'https';
    }
    return Boolean(req.socket.encrypted);
  }

  function originOk(req) {
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin' && site !== 'none') return false;
    const origin = req.headers.origin;
    if (!origin) return true;
    // Some browsers send "Origin: null" under strict referrer policies; accept
    // it only when the browser also vouches the request is same-origin.
    if (origin === 'null') return site === 'same-origin';
    let host = req.headers.host || '';
    if (trustProxy && req.headers['x-forwarded-host']) {
      host = lastListValue(req.headers['x-forwarded-host']);
    }
    try {
      return new URL(origin).host === host;
    } catch (err) {
      return false;
    }
  }

  function parseCookies(req) {
    const out = {};
    const raw = req.headers.cookie;
    if (!raw) return out;
    String(raw).split(';').forEach((part) => {
      const i = part.indexOf('=');
      if (i === -1) return;
      const key = part.slice(0, i).trim();
      const val = part.slice(i + 1).trim();
      if (key) out[key] = val;
    });
    return out;
  }

  function currentSession(req) {
    const id = idFromCookie(parseCookies(req).bld_session);
    if (!id) return null;
    const row = sessions.get(id);
    if (!row) return null;
    if (row.expires <= now()) {
      sessions.delete(id);
      return null;
    }
    return { id, ...row };
  }

  function setSessionCookie(res, req, id) {
    const parts = [
      'bld_session=' + sessionCookieValue(id),
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      'Max-Age=' + Math.floor(sessionMs / 1000)
    ];
    if (isHttps(req)) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  function clearSessionCookie(res, req) {
    const parts = ['bld_session=', 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=0'];
    if (isHttps(req)) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  function tooManyRequests(ip) {
    const t = now();
    const row = rates.get(ip);
    if (!row || t - row.start > 60000) {
      rates.set(ip, { start: t, count: 1 });
      return false;
    }
    row.count += 1;
    return row.count > RATE_PER_MIN;
  }

  function isLockedRow(row) {
    return Boolean(row && row.lockedUntil && row.lockedUntil > now());
  }

  function locked(ip, name) {
    const account = name.toLowerCase();
    return isLockedRow(failures.get(ip + '\n' + account)) || isLockedRow(accountFailures.get(account));
  }

  function bump(map, key, limit) {
    const t = now();
    let row = map.get(key);
    if (!row || (row.lockedUntil && row.lockedUntil <= t)) {
      row = { count: 0, lockedUntil: 0, last: t };
    }
    if (row.lockedUntil > t) return;
    row.count += 1;
    row.last = t;
    if (row.count >= limit) {
      row.count = 0;
      row.lockedUntil = t + lockoutMs;
    }
    map.set(key, row);
  }

  function noteFailure(ip, name) {
    const account = name.toLowerCase();
    bump(failures, ip + '\n' + account, maxAttempts);
    // Per-account limit across all addresses, so rotating IPs does not help.
    bump(accountFailures, account, accountMaxAttempts);
  }

  function clearFailures(ip, name) {
    const account = name.toLowerCase();
    failures.delete(ip + '\n' + account);
    accountFailures.delete(account);
  }

  // Drop expired sessions, finished lockouts, stale failure counters and old
  // rate windows so the maps cannot grow without bound.
  function sweep() {
    const t = now();
    for (const [id, row] of sessions) if (row.expires <= t) sessions.delete(id);
    for (const map of [failures, accountFailures]) {
      for (const [key, row] of map) {
        const lockDone = !row.lockedUntil || row.lockedUntil <= t;
        if (lockDone && t - (row.last || 0) > lockoutMs) map.delete(key);
      }
    }
    for (const [key, row] of rates) if (t - row.start > 60000) rates.delete(key);
  }

  function gate(pathname) {
    if (pathname === '/admin/login' || pathname === '/admin/login.html') return null;
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return pathname.endsWith('.js') ? 'script' : 'page';
    }
    return null;
  }

  function safeFile(urlPath) {
    let decoded;
    try {
      decoded = decodeURIComponent(urlPath);
    } catch (err) {
      return null;
    }
    if (decoded.includes('\0')) return null;
    const rel = decoded.replace(/^\/+/, '');
    if (!rel || rel.split('/').some((seg) => seg === '..' || seg === '.' || seg.startsWith('.'))) return null;
    if (rel === 'server' || rel.startsWith('server/') || rel === 'node_modules' || rel.startsWith('node_modules/')) return null;
    const abs = path.resolve(root, rel);
    const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
    if (abs !== root && !abs.startsWith(rootWithSep)) return null;
    return abs;
  }

  function securityHeaders(admin) {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      // same-origin (not no-referrer): no-referrer makes Chromium send
      // "Origin: null" on the login POST, which the origin check rejects.
      'Referrer-Policy': admin ? 'same-origin' : 'strict-origin-when-cross-origin',
      'Permissions-Policy': admin ? 'camera=(self), microphone=(), geolocation=()' : 'camera=(), microphone=(), geolocation=()'
    };
    if (admin) headers['X-Robots-Tag'] = 'noindex, nofollow';
    return headers;
  }

  function send(res, status, body, headers) {
    res.writeHead(status, headers);
    res.end(body);
  }

  function redirect(res, req, location, admin) {
    send(res, 303, '', Object.assign(securityHeaders(admin !== false), {
      Location: location,
      'Cache-Control': 'no-store'
    }));
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > BODY_LIMIT) {
          reject(Object.assign(new Error('too large'), { status: 413 }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  function parseFields(req, raw) {
    const type = String(req.headers['content-type'] || '');
    if (type.includes('application/json')) {
      try {
        const data = JSON.parse(raw || '{}');
        return {
          username: String(data.username || ''),
          password: String(data.password || '')
        };
      } catch (err) {
        return { username: '', password: '' };
      }
    }
    const params = new URLSearchParams(raw);
    return {
      username: String(params.get('username') || ''),
      password: String(params.get('password') || '')
    };
  }

  async function login(req, res) {
    if (!originOk(req)) {
      send(res, 403, 'Forbidden', Object.assign(securityHeaders(true), {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }));
      return;
    }
    const ip = clientIp(req);
    if (tooManyRequests(ip)) {
      redirect(res, req, '/admin/login?e=locked');
      return;
    }
    const fields = parseFields(req, await readBody(req));
    const name = fields.username.trim().slice(0, 80);
    const password = fields.password.slice(0, 200);
    const attempt = name || 'blank';
    if (!configured) {
      redirect(res, req, '/admin/login?e=unconfigured');
      return;
    }
    if (locked(ip, attempt)) {
      redirect(res, req, '/admin/login?e=locked');
      return;
    }
    const nameOk = bytesEqual(name, username);
    const passOk = await verifyPassword(password, nameOk ? passwordHash : (decoyHash || passwordHash));
    if (!nameOk || !passOk) {
      noteFailure(ip, attempt);
      redirect(res, req, '/admin/login?e=invalid');
      return;
    }
    clearFailures(ip, name);
    const id = crypto.randomBytes(32).toString('base64url');
    sessions.set(id, { username, expires: now() + sessionMs });
    setSessionCookie(res, req, id);
    redirect(res, req, '/admin/');
  }

  function logout(req, res) {
    if (!originOk(req)) {
      send(res, 403, 'Forbidden', Object.assign(securityHeaders(true), {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }));
      return;
    }
    const row = currentSession(req);
    if (row) sessions.delete(row.id);
    clearSessionCookie(res, req);
    const accept = String(req.headers.accept || '');
    if (accept.includes('application/json')) {
      send(res, 200, JSON.stringify({ ok: true }), Object.assign(securityHeaders(true), {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }));
      return;
    }
    redirect(res, req, '/admin/login');
  }

  function sessionInfo(req, res) {
    const row = currentSession(req);
    if (!row) {
      send(res, 401, JSON.stringify({ ok: false }), Object.assign(securityHeaders(true), {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }));
      return;
    }
    send(res, 200, JSON.stringify({ ok: true, username: row.username }), Object.assign(securityHeaders(true), {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }));
  }

  function serveFile(res, abs, admin) {
    fs.stat(abs, (err, stat) => {
      if (err || !stat.isFile()) {
        const missing = path.join(root, '404.html');
        fs.readFile(missing, (readErr, buf) => {
          const headers = Object.assign(securityHeaders(false), {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          });
          if (readErr) send(res, 404, 'Not found', Object.assign(headers, { 'Content-Type': 'text/plain; charset=utf-8' }));
          else send(res, 404, buf, headers);
        });
        return;
      }
      const ext = path.extname(abs).toLowerCase();
      const headers = Object.assign(securityHeaders(admin), {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': admin || ext === '.html' ? 'no-store' : 'public, max-age=300'
      });
      const stream = fs.createReadStream(abs);
      stream.on('error', () => {
        if (!res.headersSent) send(res, 500, 'Something went wrong', securityHeaders(admin));
      });
      res.writeHead(200, headers);
      stream.pipe(res);
    });
  }

  async function handle(req, res) {
    const hostUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = hostUrl.pathname;
    const method = req.method || 'GET';

    if (method === 'POST' && pathname === '/api/login') {
      await login(req, res);
      return;
    }
    if (method === 'POST' && pathname === '/api/logout') {
      logout(req, res);
      return;
    }
    if (method === 'GET' && pathname === '/api/session') {
      sessionInfo(req, res);
      return;
    }
    if (pathname === '/api/login' || pathname === '/api/logout' || pathname.startsWith('/api/')) {
      send(res, 405, 'Method not allowed', Object.assign(securityHeaders(true), {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        Allow: 'GET, POST'
      }));
      return;
    }
    if (method !== 'GET' && method !== 'HEAD') {
      send(res, 405, 'Method not allowed', Object.assign(securityHeaders(false), {
        'Content-Type': 'text/plain; charset=utf-8'
      }));
      return;
    }

    const need = gate(pathname);
    const session = currentSession(req);
    if (need && !session) {
      if (need === 'script') {
        send(res, 401, 'Sign in required', Object.assign(securityHeaders(true), {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store'
        }));
        return;
      }
      redirect(res, req, '/admin/login');
      return;
    }
    if ((pathname === '/admin/login' || pathname === '/admin/login.html') && session) {
      redirect(res, req, '/admin/');
      return;
    }

    let fileUrl = pathname;
    if (fileUrl === '/admin/login') fileUrl = '/admin/login.html';
    if (fileUrl === '/admin') fileUrl = '/admin/index.html';
    if (fileUrl.endsWith('/')) fileUrl += 'index.html';
    const abs = safeFile(fileUrl);
    if (!abs) {
      send(res, 404, 'Not found', Object.assign(securityHeaders(false), {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }));
      return;
    }
    if (method === 'HEAD') {
      fs.stat(abs, (err, stat) => {
        if (err || !stat.isFile()) {
          send(res, 404, '', securityHeaders(false));
          return;
        }
        const ext = path.extname(abs).toLowerCase();
        send(res, 200, '', Object.assign(securityHeaders(Boolean(need)), {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Content-Length': stat.size,
          'Cache-Control': need ? 'no-store' : 'public, max-age=300'
        }));
      });
      return;
    }
    serveFile(res, abs, Boolean(need) || pathname.startsWith('/admin'));
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (res.headersSent) return;
      const status = err && err.status ? err.status : 500;
      send(res, status, status === 413 ? 'Request too large' : 'Something went wrong', Object.assign(securityHeaders(false), {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }));
    });
  });

  const pruneTimer = setInterval(sweep, pruneMs);
  if (typeof pruneTimer.unref === 'function') pruneTimer.unref();
  server.on('close', () => clearInterval(pruneTimer));

  server.appInfo = { configured, root };
  // Test hooks (not routes): manual sweep, map sizes, and the IP chooser.
  server.sweep = sweep;
  server.storeSizes = () => ({
    sessions: sessions.size,
    failures: failures.size,
    accountFailures: accountFailures.size,
    rates: rates.size
  });
  server.clientIp = clientIp;
  return server;
}

async function startFromEnv() {
  const username = process.env.ADMIN_USERNAME || '';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';
  const sessionSecret = process.env.SESSION_SECRET || '';
  const configured = Boolean(username && parseHash(passwordHash) && sessionSecret.length >= 16);
  const decoyHash = configured ? await hashPassword(crypto.randomBytes(24).toString('base64url')) : await hashPassword('decoy-not-a-login');
  const server = createApp({
    username,
    passwordHash,
    sessionSecret,
    sessionHours: process.env.SESSION_HOURS,
    trustProxy: process.env.TRUST_PROXY,
    proxyHops: process.env.TRUST_PROXY_HOPS,
    decoyHash
  });
  const port = Number(process.env.PORT) || 8080;
  const host = process.env.HOST || '0.0.0.0';
  await new Promise((resolve) => server.listen(port, host, resolve));
  const shown = server.address();
  console.log('Shop listening on http://' + host + ':' + shown.port);
  console.log('Public pages are open. Admin sign-in is /admin/login');
  if (!configured) {
    console.log('Admin sign-in is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD_HASH, and SESSION_SECRET.');
  }
  return server;
}

if (require.main === module) {
  startFromEnv().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { createApp, startFromEnv, pickForwardedFor };
