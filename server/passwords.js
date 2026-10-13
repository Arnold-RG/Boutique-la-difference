'use strict';

const crypto = require('crypto');

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, key) => {
      if (err) reject(err);
      else resolve(encodeHash(SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, key));
    });
  });
}

function encodeHash(N, r, p, salt, key) {
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

function parseHash(encoded) {
  const parts = String(encoded || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N < 16384 || N > 1048576 || r < 1 || r > 32 || p < 1 || p > 8) return null;
  let salt;
  let expect;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expect = Buffer.from(parts[5], 'base64');
  } catch (err) {
    return null;
  }
  if (salt.length < 8 || expect.length < 16) return null;
  return { N, r, p, salt, expect };
}

function verifyPassword(password, encoded) {
  const parsed = parseHash(encoded);
  if (!parsed) return Promise.resolve(false);
  return new Promise((resolve) => {
    crypto.scrypt(password, parsed.salt, parsed.expect.length, { N: parsed.N, r: parsed.r, p: parsed.p }, (err, key) => {
      if (err || !key || key.length !== parsed.expect.length) {
        resolve(false);
        return;
      }
      resolve(crypto.timingSafeEqual(key, parsed.expect));
    });
  });
}

module.exports = {
  hashPassword,
  parseHash,
  verifyPassword
};
