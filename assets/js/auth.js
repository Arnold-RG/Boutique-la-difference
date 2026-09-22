/**
 * Admin auth: single account, PBKDF2 password + TOTP (authenticator app / QR).
 */
(function (global) {
  const AUTH_KEY = 'bld-auth-v1';
  const SESSION_KEY = 'bld-admin-session';
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
  function bytesToBase32(bytes) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0, value = 0, output = '';
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
    return output;
  }
  function base32ToBytes(str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = str.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
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
      { name: 'PBKDF2', salt, iterations: iterations || 210000, hash: 'SHA-256' },
      baseKey,
      256
    );
    return b64(bits);
  }

  function randomBytes(n) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return a;
  }

  function loadAuth() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveAuth(obj) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(obj));
  }

  function isSetup() {
    const a = loadAuth();
    return !!(a && a.username && a.passwordHash && a.totpSecret);
  }

  async function setupAccount({ username, password, totpSecret }) {
    if (!username || !password || password.length < 10) {
      throw new Error('Username required and password must be at least 10 characters.');
    }
    if (!totpSecret) throw new Error('Authenticator secret missing.');
    const salt = b64(randomBytes(16));
    const iterations = 210000;
    const passwordHash = await deriveKey(password, salt, iterations);
    saveAuth({
      username: String(username).trim(),
      salt,
      iterations,
      passwordHash,
      totpSecret,
      createdAt: new Date().toISOString()
    });
  }

  async function verifyPassword(username, password) {
    const a = loadAuth();
    if (!a) throw new Error('Admin account not configured.');
    if (username !== a.username) return false;
    const hash = await deriveKey(password, a.salt, a.iterations);
    return hash === a.passwordHash;
  }

  async function totpCode(secretBase32, step) {
    const keyBytes = base32ToBytes(secretBase32);
    const counter = Math.floor((step != null ? step : Date.now() / 1000) / 30);
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    // big-endian 64-bit counter (high 32 always 0 for practical time)
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
    const a = loadAuth();
    if (!a) return false;
    const clean = String(code || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(clean)) return false;
    const now = Math.floor(Date.now() / 1000);
    for (let w = -1; w <= 1; w++) {
      const expected = await totpCode(a.totpSecret, now + w * 30);
      if (expected === clean) return true;
    }
    return false;
  }

  function generateTotpSecret() {
    return bytesToBase32(randomBytes(20));
  }

  function otpauthUrl(username, secret) {
    const label = encodeURIComponent('Boutique La Différence:' + username);
    const issuer = encodeURIComponent('Boutique La Différence');
    return 'otpauth://totp/' + label + '?secret=' + secret + '&issuer=' + issuer + '&algorithm=SHA1&digits=6&period=30';
  }

  function createSession() {
    const token = b64(randomBytes(32));
    const expires = Date.now() + 1000 * 60 * 60 * 8; // 8h
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expires }));
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

  async function changePassword(currentPassword, newPassword) {
    const a = loadAuth();
    if (!a) throw new Error('Not configured');
    const ok = await verifyPassword(a.username, currentPassword);
    if (!ok) throw new Error('Current password is incorrect.');
    if (!newPassword || newPassword.length < 10) throw new Error('New password must be at least 10 characters.');
    const salt = b64(randomBytes(16));
    const iterations = 210000;
    a.salt = salt;
    a.iterations = iterations;
    a.passwordHash = await deriveKey(newPassword, salt, iterations);
    a.updatedAt = new Date().toISOString();
    saveAuth(a);
  }

  async function rotateTotp(password) {
    const a = loadAuth();
    if (!a) throw new Error('Not configured');
    const ok = await verifyPassword(a.username, password);
    if (!ok) throw new Error('Password incorrect.');
    const secret = generateTotpSecret();
    a.totpSecret = secret;
    a.updatedAt = new Date().toISOString();
    saveAuth(a);
    return { secret, url: otpauthUrl(a.username, secret) };
  }

  /** Draw QR without external libs (finder patterns + data modules simplified via API fallback). */
  function renderQr(canvas, text) {
    // Prefer QR Server image if canvas helper not enough — but keep offline-capable path via library-free grid.
    // Use Google Chart-less: encode via external image only as enhancement; primary: qrcode CDN if present.
    if (global.QRCode && canvas) {
      // qrcodejs style
      const wrap = canvas.parentElement;
      wrap.innerHTML = '';
      new global.QRCode(wrap, { text, width: 180, height: 180, correctLevel: global.QRCode.CorrectLevel.M });
      return;
    }
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const size = 180;
      canvas.width = size; canvas.height = size;
      // Fallback: show otpauth text hint + block pattern so user can still type secret
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#07140f';
      ctx.font = '10px monospace';
      const lines = [];
      for (let i = 0; i < text.length; i += 22) lines.push(text.slice(i, i + 22));
      lines.slice(0, 12).forEach((ln, i) => ctx.fillText(ln, 8, 18 + i * 12));
    }
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

  global.BLDAuth = {
    AUTH_KEY,
    isSetup,
    setupAccount,
    verifyPassword,
    verifyTotp,
    generateTotpSecret,
    otpauthUrl,
    createSession,
    clearSession,
    hasSession,
    changePassword,
    rotateTotp,
    loadAuth,
    renderQr,
    loadQrScript,
    totpCode
  };
})(window);
