'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createApp, pickForwardedFor } = require('./index');
const { hashPassword, verifyPassword } = require('./passwords');

const root = path.join(__dirname, '..');

function cookieFrom(res) {
  const list = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie') || ''];
  const raw = list.find((item) => item && item.includes('bld_session='));
  if (!raw) return '';
  return raw.split(';')[0];
}

async function boot(options) {
  const passwordHash = options.passwordHash || await hashPassword(options.password || 'correct-horse-battery');
  const decoyHash = await hashPassword('decoy-not-the-password');
  const server = createApp(Object.assign({
    root,
    username: 'test-admin',
    passwordHash,
    sessionSecret: 'test-session-secret-value',
    sessionHours: 1,
    decoyHash,
    maxAttempts: 3,
    lockoutMs: 1200
  }, options, { passwordHash, decoyHash }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  return {
    server,
    base,
    password: options.password || 'correct-horse-battery',
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function postLogin(base, username, password) {
  return fetch(base + '/api/login', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password })
  });
}

test('password hash verifies and rejects a wrong password', async () => {
  const hash = await hashPassword('a-long-secret-phrase');
  assert.equal(await verifyPassword('a-long-secret-phrase', hash), true);
  assert.equal(await verifyPassword('a-long-secret-phrase!', hash), false);
  assert.equal(hash.includes('a-long-secret-phrase'), false);
});

test('public shop is open and the office is not', async () => {
  const app = await boot({});
  try {
    const home = await fetch(app.base + '/');
    const html = await home.text();
    assert.equal(home.status, 200);
    assert.match(html, /Boutique La Différence/);
    assert.equal(html.includes('href="admin/'), false);

    const office = await fetch(app.base + '/admin/', { redirect: 'manual' });
    assert.equal(office.status, 303);
    assert.equal(office.headers.get('location'), '/admin/login');
    assert.match(office.headers.get('x-robots-tag') || '', /noindex/);

    const script = await fetch(app.base + '/admin/js/admin.js', { redirect: 'manual' });
    assert.equal(script.status, 401);

    const hidden = await fetch(app.base + '/server/index.js');
    assert.equal(hidden.status, 404);
    const env = await fetch(app.base + '/.env');
    assert.equal(env.status, 404);
  } finally {
    await app.close();
  }
});

test('sign-in sets a session and sign-out ends it', async () => {
  const app = await boot({});
  try {
    const bad = await postLogin(app.base, 'test-admin', 'not-the-password');
    assert.equal(bad.status, 303);
    assert.equal(bad.headers.get('location'), '/admin/login?e=invalid');
    assert.equal(cookieFrom(bad), '');

    const good = await postLogin(app.base, 'test-admin', app.password);
    assert.equal(good.status, 303);
    assert.equal(good.headers.get('location'), '/admin/');
    const cookie = cookieFrom(good);
    assert.match(cookie, /^bld_session=/);
    assert.match(good.headers.get('set-cookie') || '', /HttpOnly/i);
    assert.match(good.headers.get('set-cookie') || '', /SameSite=Strict/i);

    const page = await fetch(app.base + '/admin/', { headers: { cookie } });
    assert.equal(page.status, 200);
    const pageHtml = await page.text();
    assert.match(pageHtml, /noindex/);

    const session = await fetch(app.base + '/api/session', { headers: { cookie } });
    const body = await session.json();
    assert.equal(body.ok, true);
    assert.equal(body.username, 'test-admin');

    const out = await fetch(app.base + '/api/logout', {
      method: 'POST',
      headers: { cookie, Accept: 'application/json' }
    });
    assert.equal(out.status, 200);
    const after = await fetch(app.base + '/admin/js/admin.js', {
      headers: { cookie },
      redirect: 'manual'
    });
    assert.equal(after.status, 401);
  } finally {
    await app.close();
  }
});

test('repeated failures lock the door, then it opens again', async () => {
  const app = await boot({});
  try {
    for (let i = 0; i < 3; i += 1) {
      const res = await postLogin(app.base, 'test-admin', 'wrong-password-' + i);
      assert.equal(res.headers.get('location'), '/admin/login?e=invalid');
    }
    const locked = await postLogin(app.base, 'test-admin', app.password);
    assert.equal(locked.headers.get('location'), '/admin/login?e=locked');
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const again = await postLogin(app.base, 'test-admin', app.password);
    assert.equal(again.headers.get('location'), '/admin/');
  } finally {
    await app.close();
  }
});

test('sign-in without server secrets does not accept a password', async () => {
  const decoyHash = await hashPassword('decoy-not-the-password');
  const server = createApp({
    root,
    username: '',
    passwordHash: '',
    sessionSecret: '',
    decoyHash
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const res = await postLogin(base, 'anyone', 'anything-at-all');
    assert.equal(res.headers.get('location'), '/admin/login?e=unconfigured');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// The old public password hash is checked by the SHA-256 of a 16-character
// fragment of it (high-entropy, not reversible by brute force), so the
// literal never appears in the repository. Low-entropy personal values (the
// retired username and the old phone number) are deliberately not encoded
// here at all, not even hashed, because such hashes are trivially reversible.
const RETIRED_SHA256 = new Set([
  'e5579abbd86687034e0cb9fb2219c8104ffcf6841c51288da1142e41ceae0660'
]);

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (/\.(html|js|css|json|md|txt|xml|yml|yaml|csv|example|webmanifest)$/i.test(entry.name)) out.push(abs);
  }
  return out;
}

test('the repository does not contain the old admin password material', () => {
  const files = walk(root, []);
  assert.ok(files.length > 10);
  for (const abs of files) {
    const text = fs.readFileSync(abs, 'utf8');
    const tokens = text.match(/[A-Za-z0-9@._+-]{6,}/g) || [];
    for (const token of tokens) {
      const variants = [token, token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')];
      for (const v of variants) {
        assert.equal(RETIRED_SHA256.has(sha256(v)), false, path.relative(root, abs));
      }
    }
  }
});

test('X-Forwarded-For uses the proxy-appended entry, not the client-supplied first one', async () => {
  assert.equal(pickForwardedFor('6.6.6.6, 203.0.113.9', 1, 'direct'), '203.0.113.9');
  assert.equal(pickForwardedFor('6.6.6.6, 203.0.113.9, 10.0.0.2', 2, 'direct'), '203.0.113.9');
  assert.equal(pickForwardedFor('203.0.113.9', 3, 'direct'), '203.0.113.9');
  assert.equal(pickForwardedFor('', 1, 'direct'), 'direct');
  assert.equal(pickForwardedFor(undefined, 1, 'direct'), 'direct');

  const app = await boot({ trustProxy: true, maxAttempts: 2, accountMaxAttempts: 50 });
  try {
    // Spoofing different first entries must not dodge the per-IP lockout.
    for (let i = 0; i < 2; i += 1) {
      await fetch(app.base + '/api/login', {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': '9.9.9.' + i + ', 198.51.100.7' },
        body: new URLSearchParams({ username: 'test-admin', password: 'wrong-' + i })
      });
    }
    const res = await fetch(app.base + '/api/login', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': '1.2.3.4, 198.51.100.7' },
      body: new URLSearchParams({ username: 'test-admin', password: app.password })
    });
    assert.equal(res.headers.get('location'), '/admin/login?e=locked');
  } finally {
    await app.close();
  }
});

test('per-account lockout holds across different addresses', async () => {
  const app = await boot({ trustProxy: true, maxAttempts: 50, accountMaxAttempts: 3 });
  try {
    const login = (ip, password) => fetch(app.base + '/api/login', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': ip },
      body: new URLSearchParams({ username: 'test-admin', password })
    });
    for (let i = 0; i < 3; i += 1) {
      const res = await login('198.51.100.' + (10 + i), 'wrong-' + i);
      assert.equal(res.headers.get('location'), '/admin/login?e=invalid');
    }
    const locked = await login('198.51.100.99', app.password);
    assert.equal(locked.headers.get('location'), '/admin/login?e=locked');
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const again = await login('198.51.100.99', app.password);
    assert.equal(again.headers.get('location'), '/admin/');
  } finally {
    await app.close();
  }
});

test('expired sessions, failures and rate windows are pruned', async () => {
  let clock = 1_000_000;
  const app = await boot({ now: () => clock, sessionHours: 1, lockoutMs: 1000 });
  try {
    await postLogin(app.base, 'test-admin', 'wrong');
    const good = await postLogin(app.base, 'test-admin', app.password);
    assert.match(cookieFrom(good), /^bld_session=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    await postLogin(app.base, 'someone-else', 'wrong');
    let sizes = app.server.storeSizes();
    assert.equal(sizes.sessions, 1);
    assert.ok(sizes.failures >= 1 && sizes.accountFailures >= 1 && sizes.rates >= 1);

    clock += 2 * 60 * 60 * 1000; // past session expiry, lockout and rate window
    app.server.sweep();
    sizes = app.server.storeSizes();
    assert.deepEqual(sizes, { sessions: 0, failures: 0, accountFailures: 0, rates: 0 });
  } finally {
    await app.close();
  }
});

test('a session cookie with a bad signature is rejected', async () => {
  const app = await boot({});
  try {
    const good = await postLogin(app.base, 'test-admin', app.password);
    const cookie = cookieFrom(good);
    const [id] = cookie.replace('bld_session=', '').split('.');
    const forged = 'bld_session=' + id + '.' + 'A'.repeat(43);
    const res = await fetch(app.base + '/api/session', { headers: { cookie: forged } });
    assert.equal(res.status, 401);
    const bare = await fetch(app.base + '/api/session', { headers: { cookie: 'bld_session=' + id } });
    assert.equal(bare.status, 401);
    const ok = await fetch(app.base + '/api/session', { headers: { cookie } });
    assert.equal(ok.status, 200);
  } finally {
    await app.close();
  }
});

test('login accepts Origin: null only with Sec-Fetch-Site: same-origin', async () => {
  const app = await boot({});
  try {
    const send = (headers) => fetch(app.base + '/api/login', {
      method: 'POST',
      redirect: 'manual',
      headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, headers),
      body: new URLSearchParams({ username: 'test-admin', password: app.password })
    });
    assert.equal((await send({ Origin: 'null', 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await send({ Origin: 'null' })).status, 403);
    const ok = await send({ Origin: 'null', 'Sec-Fetch-Site': 'same-origin' });
    assert.equal(ok.headers.get('location'), '/admin/');
    const page = await fetch(app.base + '/admin/login');
    assert.equal(page.headers.get('referrer-policy'), 'same-origin');
    const html = await page.text();
    assert.match(html, /<meta name="referrer" content="same-origin">/);
  } finally {
    await app.close();
  }
});
