import crypto from 'crypto';
import { MFA_ENCRYPTION_KEY, MFA_ENCRYPTION_KEY_VERSION, OTP_PEPPER } from '../config.js';

const PREFIX = 'enc:';
export function encryptValue(value) {
  if (value === null || value === undefined || value === '') return value || null;
  return String(value);
}

export function decryptValue(value) {
  if (value === null || value === undefined || value === '') return value || null;
  return String(value);
}

export function encryptMfaValue(value) {
  if (value === null || value === undefined || value === '') return value || null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MFA_ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}v${MFA_ENCRYPTION_KEY_VERSION}:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptMfaValue(value) {
  if (value === null || value === undefined || value === '') return value || null;
  const text = String(value);
  if (!text.startsWith(PREFIX)) throw new Error('Unencrypted sensitive value encountered; run migrate:encrypt');
  const [marker, version, ivPart, tagPart, encryptedPart] = text.split(':');
  if (marker !== 'enc' || version !== `v${MFA_ENCRYPTION_KEY_VERSION}` || !ivPart || !tagPart || !encryptedPart) {
    throw new Error(`Unsupported or malformed encrypted value (${version || 'unknown version'})`);
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', MFA_ENCRYPTION_KEY, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64url')), decipher.final()]).toString('utf8');
}

export function decryptRecord(record, fields) {
  if (!record) return record;
  const copy = { ...record };
  for (const field of fields) {
    try {
      copy[field] = decryptValue(copy[field]);
    } catch (error) {
      console.warn(`Could not decrypt field "${field}"; returning null`);
      copy[field] = null;
    }
  }
  return copy;
}

export function decryptRecords(records, fields) {
  return records.map(record => decryptRecord(record, fields));
}

export function blindIndex(value, purpose = 'lookup') {
  if (value === null || value === undefined || value === '') return null;
  return crypto.createHmac('sha256', OTP_PEPPER)
    .update(`${purpose}|${String(value)}`)
    .digest('hex');
}

export function hashOtp(email, purpose, code) {
  return crypto.createHmac('sha256', OTP_PEPPER)
    .update(`${String(email).trim().toLowerCase()}|${purpose}|${String(code)}`)
    .digest('hex');
}
