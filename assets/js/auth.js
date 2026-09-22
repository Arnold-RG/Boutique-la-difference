/**
 * Admin auth — fixed username + password + authenticator app (TOTP).
 * Scan the QR once with Google Authenticator / Authy / Microsoft Authenticator,
 * then type the 6-digit code on every login.
 */
(function (global) {
  const FIXED_USERNAME = 'Family@nbr1';
  const PASS_SALT_B64 = 'YmxkLWZhbWlseS1uYnIxLXNhbHQtdjE=';
  const PASS_HASH_B64 = 'FMRm4xer7e7mwc1hC+H2YYRmCdxc99vj4V4E7CYC54g=';
  const PASS_ITERS = 210000;
  /** Stable TOTP secret — same QR on every reconnect so your phone app stays linked */
  const FIXED_TOTP_SECRET = 'BS5FFYNTUVTTAGSFEAGQLJ4Z6434BGWV';

  const SESSION_KEY = 'bld-admin-session-v3';
  const DEVICE_KEY = 'bld-allowed-devices-v1';
  const DEVICE_ID_KEY = 'bld-this-device-id-v1';
  const ENROLLED_KEY = 'bld-totp-enrolled-v1';
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

  function base32ToBytes(str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = String(str || '').replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0, value = 0;
    const out = [];
    for (let i = 0; i < cleaned.length; i++) {
      const idx = alphabet.indexOf(cleaned[i]);
      if (idx < 0) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return new Uint8Array(out);
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
  function getTotpSecret() { return FIXED_TOTP_SECRET; }

  function otpauthUrl(username) {
    const label = encodeURIComponent('Boutique La Différence:' + (username || FIXED_USERNAME));
    const issuer = encodeURIComponent('Boutique La Différence');
    return 'otpauth://totp/' + label + '?secret=' + FIXED_TOTP_SECRET +
      '&issuer=' + issuer + '&algorithm=SHA1&digits=6&period=30';
  }

  async function verifyPassword(username, password) {
    if (String(username || '').trim() !== FIXED_USERNAME) return false;
    if (!password) return false;
    const hash = await deriveKey(password, PASS_SALT_B64, PASS_ITERS);
    return hash === PASS_HASH_B64;
  }

  async function totpCode(secretBase32, step) {
    const keyBytes = base32ToBytes(secretBase32 || FIXED_TOTP_SECRET);
    const counter = Math.floor((step != null ? step : Date.now() / 1000) / 30);
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(0, 0);
    view.setUint32(4, counter);
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
    const offset = sig[sig.length - 1] & 0xf;
    const bin =
      ((sig[offset] & 0x7f) << 24) |
      ((sig[offset + 1] & 0xff) << 16) |
      ((sig[offset + 2] & 0xff) << 8) |
      (sig[offset + 3] & 0xff);
    return String(bin % 1000000).padStart(6, '0');
  }

  async function verifyTotp(code) {
    const clean = String(code || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(clean)) return false;
    const now = Math.floor(Date.now() / 1000);
    for (let w = -1; w <= 1; w++) {
      const expected = await totpCode(FIXED_TOTP_SECRET, now + w * 30);
      if (expected === clean) return true;
    }
    return false;
  }

  function isEnrolled() {
    return localStorage.getItem(ENROLLED_KEY) === '1';
  }
  function markEnrolled() {
    localStorage.setItem(ENROLLED_KEY, '1');
  }

  function loadQrScript() {
    return new Promise((resolve) => {
      if (global.QRCode) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  function renderQr(container, text) {
    if (!container) return;
    container.innerHTML = '';
    if (global.QRCode) {
      new global.QRCode(container, {
        text: text,
        width: 180,
        height: 180,
        correctLevel: global.QRCode.CorrectLevel.M
      });
      return;
    }
    const img = document.createElement('img');
    img.alt = 'Authenticator QR';
    img.width = 180;
    img.height = 180;
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(text);
    container.appendChild(img);
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
    getTotpSecret,
    otpauthUrl,
    verifyPassword,
    verifyTotp,
    totpCode,
    isEnrolled,
    markEnrolled,
    loadQrScript,
    renderQr,
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
