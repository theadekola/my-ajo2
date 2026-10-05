import crypto from 'crypto';
import QRCode from 'qrcode';
import { JWT_SECRET } from '../config.js';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    output += alphabet[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return output;
}

function base32Decode(value) {
  const clean = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const character of clean) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid MFA secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function counterBuffer(counter) {
  const value = Buffer.alloc(8);
  value.writeBigUInt64BE(BigInt(counter));
  return value;
}

export function generateMfaSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function verifyTotp(secret, suppliedCode, now = Date.now()) {
  const code = String(suppliedCode || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secret);
  const currentCounter = Math.floor(now / 30000);
  for (let window = -1; window <= 1; window += 1) {
    const digest = crypto.createHmac('sha1', key).update(counterBuffer(currentCounter + window)).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
    const expected = String(binary).padStart(6, '0');
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
  }
  return false;
}

export function authenticatorUri(secret, email) {
  const issuer = 'My Ajo';
  const label = `${issuer}:${String(email || '').trim().toLowerCase()}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export async function authenticatorQrDataUrl(secret, email) {
  return QRCode.toDataURL(authenticatorUri(secret, email), { errorCorrectionLevel: 'M', margin: 2, width: 280 });
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => crypto.randomBytes(6).toString('hex').toUpperCase().match(/.{1,4}/g).join('-'));
}

export function hashRecoveryCode(code) {
  return crypto.createHmac('sha256', JWT_SECRET)
    .update(String(code || '').toUpperCase().replace(/[^A-F0-9]/g, ''))
    .digest('hex');
}

export function consumeRecoveryCode(serializedHashes, suppliedCode) {
  let hashes;
  try { hashes = JSON.parse(serializedHashes || '[]'); } catch { hashes = []; }
  const suppliedHash = hashRecoveryCode(suppliedCode);
  const index = hashes.findIndex(hash => String(hash).length === suppliedHash.length
    && crypto.timingSafeEqual(Buffer.from(String(hash)), Buffer.from(suppliedHash)));
  if (index < 0) return null;
  hashes.splice(index, 1);
  return JSON.stringify(hashes);
}
