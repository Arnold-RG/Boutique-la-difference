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

function bytesEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
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

  const sessions = new Map();
  const failures = new Map();
  const rates = new Map();

  function clientIp(req) {
    if (trustProxy) {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim().slice(0, 80);
      }
    }
    return String(req.socket.remoteAddress || 'unknown');
  }

  function isHttps(req) {
    if (trustProxy && req.headers['x-forwarded-proto']) {
      return String(req.headers['x-forwarded-proto']).split(',')[0].trim() === 'https';
    }
    return Boolean(req.socket.encrypted);
  }

  function originOk(req) {
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin' && site !== 'none') return false;
    const origin = req.headers.origin;
    if (!origin) return true;
    let host = req.headers.host || '';
    if (trustProxy && req.headers['x-forwarded-host']) {
      host = String(req.headers['x-forwarded-host']).split(',')[0].trim();
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
    const id = parseCookies(req).bld_session;
    if (!id || !/^[A-Za-z0-9_-]{20,}$/.test(id)) return null;
    const row = sessions.get(id);
    if (!row) return null;
    if (row.expires <= Date.now()) {
      sessions.delete(id);
      return null;
    }
    return { id, ...row };
  }

  function setSessionCookie(res, req, id) {
    const parts = [
      'bld_session=' + id,
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
    const now = Date.now();
    const row = rates.get(ip);
    if (!row || now - row.start > 60000) {
      rates.set(ip, { start: now, count: 1 });
      return false;
    }
    row.count += 1;
    return row.count > RATE_PER_MIN;
  }

  function locked(ip, name) {
    const row = failures.get(ip + '\n' + name.toLowerCase());
    return Boolean(row && row.lockedUntil && row.lockedUntil > Date.now());
  }

  function noteFailure(ip, name) {
    const key = ip + '\n' + name.toLowerCase();
    const now = Date.now();
    let row = failures.get(key);
    if (!row || (row.lockedUntil && row.lockedUntil <= now)) {
      row = { count: 0, lockedUntil: 0 };
    }
    if (row.lockedUntil > now) return;
    row.count += 1;
    if (row.count >= maxAttempts) {
      row.count = 0;
      row.lockedUntil = now + lockoutMs;
    }
    failures.set(key, row);
  }

  function clearFailures(ip, name) {
    failures.delete(ip + '\n' + name.toLowerCase());
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
      'Referrer-Policy': admin ? 'no-referrer' : 'strict-origin-when-cross-origin',
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
    sessions.set(id, { username, expires: Date.now() + sessionMs });
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

  server.appInfo = { configured, root };
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

module.exports = { createApp, startFromEnv };
