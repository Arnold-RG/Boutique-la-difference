/**
 * Admin auth — fixed username + password only.
 */
(function (global) {
  const FIXED_USERNAME = 'Family@nbr1';
  const PASS_SALT_B64 = 'YmxkLWZhbWlseS1uYnIxLXNhbHQtdjE=';
  const PASS_HASH_B64 = 'FMRm4xer7e7mwc1hC+H2YYRmCdxc99vj4V4E7CYC54g=';
  const PASS_ITERS = 210000;

  const SESSION_KEY = 'bld-admin-session-v4';
  const DEVICE_KEY = 'bld-allowed-devices-v1';
  const DEVICE_ID_KEY = 'bld-this-device-id-v1';
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

  async function verifyPassword(username, password) {
    if (String(username || '').trim() !== FIXED_USERNAME) return false;
    if (!password) return false;
    const hash = await deriveKey(password, PASS_SALT_B64, PASS_ITERS);
    return hash === PASS_HASH_B64;
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
    getUsername,
    verifyPassword,
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
