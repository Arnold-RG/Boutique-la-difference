/**
 * Admin auth — fixed username + PBKDF2-SHA256 password + client rate limit.
 *
 * Limits (client-side only — documented in SECURITY.md):
 * - 5 failed attempts → 60s lockout
 * - Session: 8 hours in sessionStorage
 * Not a substitute for server-side authentication on a static host.
 */
(function (global) {
  const FIXED_USERNAME = 'Family@nbr1';
  const PASS_SALT_B64 = 'YmxkLWZhbWlseS1uYnIxLXNhbHQtdjE=';
  const PASS_HASH_B64 = 'FMRm4xer7e7mwc1hC+H2YYRmCdxc99vj4V4E7CYC54g=';
  const PASS_ITERS = 210000;

  const SESSION_KEY = 'bld-admin-session-v4';
  const DEVICE_KEY = 'bld-allowed-devices-v1';
  const DEVICE_ID_KEY = 'bld-this-device-id-v1';
  const RATE_KEY = 'bld-auth-rate-v1';
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 60 * 1000;

  const encoder = new TextEncoder();

  function b64(buf) {
    const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    let s = '';
    bytes.forEach(b => { s += String.fromCharCode(b); });
    return btoa(s);
  }
  function fromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function randomBytes(n) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return a;
  }

  async function deriveKey(password, saltB64, iterations) {
    const salt = fromB64(saltB64);
    const baseKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: iterations || PASS_ITERS, hash: 'SHA-256' },
      baseKey,
      256
    );
    return b64(bits);
  }

  function getUsername() { return FIXED_USERNAME; }

  function loadRate() {
    try {
      const raw = localStorage.getItem(RATE_KEY);
      if (!raw) return { fails: 0, lockedUntil: 0 };
      const o = JSON.parse(raw);
      return {
        fails: Number(o.fails) || 0,
        lockedUntil: Number(o.lockedUntil) || 0
      };
    } catch (e) {
      return { fails: 0, lockedUntil: 0 };
    }
  }

  function saveRate(state) {
    localStorage.setItem(RATE_KEY, JSON.stringify(state));
  }

  function getLockRemainingMs() {
    const r = loadRate();
    const left = (r.lockedUntil || 0) - Date.now();
    return left > 0 ? left : 0;
  }

  function isLocked() {
    return getLockRemainingMs() > 0;
  }

  function recordFailedAttempt() {
    const r = loadRate();
    if (r.lockedUntil && Date.now() < r.lockedUntil) return r;
    r.fails = (r.fails || 0) + 1;
    if (r.fails >= MAX_ATTEMPTS) {
      r.lockedUntil = Date.now() + LOCK_MS;
      r.fails = 0;
    }
    saveRate(r);
    return r;
  }

  function clearRateLimit() {
    saveRate({ fails: 0, lockedUntil: 0 });
  }

  function rateLimitMessage() {
    const left = getLockRemainingMs();
    if (left > 0) {
      const sec = Math.ceil(left / 1000);
      return 'Too many failed attempts. Try again in ' + sec + 's. (Client-side lock — see SECURITY.md.)';
    }
    const r = loadRate();
    const remaining = Math.max(0, MAX_ATTEMPTS - (r.fails || 0));
    if (remaining <= 2 && remaining > 0) {
      return 'Incorrect password. ' + remaining + ' attempt' + (remaining === 1 ? '' : 's') + ' left before a 60s lock.';
    }
    return 'Incorrect password.';
  }

  async function verifyPassword(username, password) {
    if (isLocked()) return { ok: false, reason: 'locked', message: rateLimitMessage() };
    if (String(username || '').trim() !== FIXED_USERNAME) {
      recordFailedAttempt();
      return { ok: false, reason: 'bad_user', message: rateLimitMessage() };
    }
    if (!password) {
      return { ok: false, reason: 'empty', message: 'Enter the admin password.' };
    }
    const hash = await deriveKey(password, PASS_SALT_B64, PASS_ITERS);
    if (hash !== PASS_HASH_B64) {
      recordFailedAttempt();
      return { ok: false, reason: 'bad_pass', message: rateLimitMessage() };
    }
    clearRateLimit();
    return { ok: true };
  }

  function getOrCreateDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + b64(randomBytes(12)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  function loadDevices() {
    try {
      const raw = localStorage.getItem(DEVICE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveDevices(list) {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(list));
  }

  function registerThisDevice(label) {
    const id = getOrCreateDeviceId();
    const list = loadDevices().filter(d => d.id !== id);
    const ua = navigator.userAgent || '';
    let guessed = 'Browser device';
    if (/iPhone|iPad/i.test(ua)) guessed = 'iPhone / iPad';
    else if (/Android/i.test(ua)) guessed = 'Android phone';
    else if (/Windows/i.test(ua)) guessed = 'Windows computer';
    else if (/Mac/i.test(ua)) guessed = 'Mac';
    list.unshift({
      id,
      label: label || guessed,
      allowed: true,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    saveDevices(list.slice(0, 12));
    return id;
  }

  function touchThisDevice() {
    const id = getOrCreateDeviceId();
    const list = loadDevices();
    const d = list.find(x => x.id === id);
    if (d) {
      d.lastSeen = new Date().toISOString();
      saveDevices(list);
    }
  }

  function revokeDevice(id) {
    saveDevices(loadDevices().filter(d => d.id !== id));
  }

  function createSession() {
    const token = b64(randomBytes(32));
    const expires = Date.now() + 1000 * 60 * 60 * 8;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expires, user: FIXED_USERNAME }));
    return token;
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function hasSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s.expires || Date.now() > s.expires) { clearSession(); return false; }
      return true;
    } catch (e) { return false; }
  }

  global.BLDAuth = {
    FIXED_USERNAME,
    MAX_ATTEMPTS,
    LOCK_MS,
    getUsername,
    verifyPassword,
    isLocked,
    getLockRemainingMs,
    rateLimitMessage,
    getOrCreateDeviceId,
    loadDevices,
    registerThisDevice,
    touchThisDevice,
    revokeDevice,
    createSession,
    clearSession,
    hasSession
  };
})(window);
