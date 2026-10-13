'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createApp } = require('./index');
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
    username: 'shop-owner',
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
    const bad = await postLogin(app.base, 'shop-owner', 'not-the-password');
    assert.equal(bad.status, 303);
    assert.equal(bad.headers.get('location'), '/admin/login?e=invalid');
    assert.equal(cookieFrom(bad), '');

    const good = await postLogin(app.base, 'shop-owner', app.password);
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
    assert.equal(body.username, 'shop-owner');

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
      const res = await postLogin(app.base, 'shop-owner', 'wrong-password-' + i);
      assert.equal(res.headers.get('location'), '/admin/login?e=invalid');
    }
    const locked = await postLogin(app.base, 'shop-owner', app.password);
    assert.equal(locked.headers.get('location'), '/admin/login?e=locked');
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const again = await postLogin(app.base, 'shop-owner', app.password);
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

test('the repository does not contain the old admin password material', () => {
  const files = [
    'admin/js/auth.js',
    'admin/js/admin.js',
    'README.md',
    'index.html',
    'server/index.js'
  ];
  files.forEach((rel) => {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.equal(text.includes('Family@nbr1'), false, rel);
    assert.equal(text.includes('FMRm4xer7e7mwc1h'), false, rel);
    assert.equal(text.includes('25079401854'), false, rel);
  });
});
