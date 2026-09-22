/**
 * Admin auth — fixed owner account + password + quick number match.
 * Username is constant and not editable. Password is always typed.
 * Second step: portal shows a number; user must select the matching one
 * (on this screen or on an allowed device companion page).
 */
(function (global) {
  const FIXED_USERNAME = 'Family@nbr1';
  const PASS_SALT_B64 = 'YmxkLWZhbWlseS1uYnIxLXNhbHQtdjE=';
  const PASS_HASH_B64 = 'FMRm4xer7e7mwc1hC+H2YYRmCdxc99vj4V4E7CYC54g=';
  const PASS_ITERS = 210000;

  const SESSION_KEY = 'bld-admin-session-v2';
  const DEVICE_KEY = 'bld-allowed-devices-v1';
  const DEVICE_ID_KEY = 'bld-this-device-id-v1';
  const CHALLENGE_KEY = 'bld-login-challenge-v1';
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
  function randomInt(min, max) {
    const range = max - min + 1;
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return min + (buf[0] % range);
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

  async function verifyPassword(username, password) {
    if (String(username || '').trim() !== FIXED_USERNAME) return false;
    if (!password) return false;
    const hash = await deriveKey(password, PASS_SALT_B64, PASS_ITERS);
    return hash === PASS_HASH_B64;
  }

  /** Create a quick number challenge (1–99 style) with decoy options. */
  function createNumberChallenge() {
    const target = randomInt(1, 99);
    const options = new Set([target]);
    while (options.size < 6) options.add(randomInt(1, 99));
    const list = Array.from(options);
    for (let i = list.length - 1; i > 0; i--) {
      const j = randomInt(0, i);
      const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    const confirmCode = String(randomInt(1000, 9999));
    const challenge = {
      id: b64(randomBytes(8)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12),
      target,
      options: list,
      confirmCode,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3 * 60 * 1000,
      solved: false,
      deviceSolved: false
    };
    sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));
    // Also mirror for companion page on same browser profile
    try { localStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge)); } catch (e) {}
    return challenge;
  }

  function getChallenge() {
    try {
      const raw = sessionStorage.getItem(CHALLENGE_KEY) || localStorage.getItem(CHALLENGE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c.expiresAt || Date.now() > c.expiresAt) {
        clearChallenge();
        return null;
      }
      return c;
    } catch (e) { return null; }
  }

  function saveChallenge(c) {
    sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(c));
    try { localStorage.setItem(CHALLENGE_KEY, JSON.stringify(c)); } catch (e) {}
  }

  function clearChallenge() {
    sessionStorage.removeItem(CHALLENGE_KEY);
    try { localStorage.removeItem(CHALLENGE_KEY); } catch (e) {}
  }

  function solveChallenge(selectedNumber) {
    const c = getChallenge();
    if (!c) return { ok: false, error: 'Verification expired. Sign in again.' };
    if (Number(selectedNumber) !== Number(c.target)) {
      return { ok: false, error: 'Wrong number. Select the exact number shown above.' };
    }
    c.solved = true;
    saveChallenge(c);
    return { ok: true, challenge: c };
  }

  /** Companion device marks challenge solved after picking the match. */
  function deviceSolveChallenge(selectedNumber) {
    const c = getChallenge();
    if (!c) return { ok: false, error: 'No active code on the admin portal (or it expired).' };
    if (Number(selectedNumber) !== Number(c.target)) {
      return { ok: false, error: 'That number does not match the admin portal.' };
    }
    c.deviceSolved = true;
    c.solved = true;
    saveChallenge(c);
    return { ok: true, confirmCode: c.confirmCode, challenge: c };
  }

  function verifyConfirmCode(code) {
    const c = getChallenge();
    if (!c || !c.solved) return false;
    return String(code || '').trim() === String(c.confirmCode);
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

  function isThisDeviceAllowed() {
    const id = getOrCreateDeviceId();
    return loadDevices().some(d => d.id === id && d.allowed);
  }

  function registerThisDevice(label) {
    const id = getOrCreateDeviceId();
    const list = loadDevices().filter(d => d.id !== id);
    list.unshift({
      id,
      label: label || guessDeviceLabel(),
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

  function guessDeviceLabel() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad/i.test(ua)) return 'iPhone / iPad';
    if (/Android/i.test(ua)) return 'Android phone';
    if (/Windows/i.test(ua)) return 'Windows computer';
    if (/Mac/i.test(ua)) return 'Mac';
    return 'Browser device';
  }

  function createSession() {
    const token = b64(randomBytes(32));
    const expires = Date.now() + 1000 * 60 * 60 * 8;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expires, user: FIXED_USERNAME }));
    clearChallenge();
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

  // Clear legacy TOTP setup keys so old failed logins do not block
  try { localStorage.removeItem('bld-auth-v1'); } catch (e) {}

  global.BLDAuth = {
    FIXED_USERNAME,
    getUsername,
    verifyPassword,
    createNumberChallenge,
    getChallenge,
    clearChallenge,
    solveChallenge,
    deviceSolveChallenge,
    verifyConfirmCode,
    getOrCreateDeviceId,
    loadDevices,
    isThisDeviceAllowed,
    registerThisDevice,
    touchThisDevice,
    revokeDevice,
    guessDeviceLabel,
    createSession,
    clearSession,
    hasSession
  };
})(window);
