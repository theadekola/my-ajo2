import dotenv from 'dotenv';

dotenv.config();

function requiredSecret(name, minimumLength = 32) {
  const value = String(process.env[name] || '').trim();
  const placeholders = ['change-this', 'replace-with', 'dev-secret', 'your-'];
  if (value.length < minimumLength || placeholders.some(item => value.toLowerCase().includes(item))) {
    throw new Error(`${name} must be a unique secret of at least ${minimumLength} characters`);
  }
  return value;
}

export const JWT_SECRET = requiredSecret('JWT_SECRET', 32);
export const OTP_PEPPER = requiredSecret('OTP_PEPPER', 32);
const mfaKeyHex = String(process.env.MFA_ENCRYPTION_KEY || '').trim();
if (!/^[a-fA-F0-9]{64}$/.test(mfaKeyHex)) {
  throw new Error('MFA_ENCRYPTION_KEY must be exactly 64 hexadecimal characters');
}
export const MFA_ENCRYPTION_KEY = Buffer.from(mfaKeyHex, 'hex');
export const MFA_ENCRYPTION_KEY_VERSION = String(process.env.MFA_ENCRYPTION_KEY_VERSION || '1').trim();
if (!/^[1-9]\d*$/.test(MFA_ENCRYPTION_KEY_VERSION)) {
  throw new Error('MFA_ENCRYPTION_KEY_VERSION must be a positive integer');
}
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || '__Host-myajo_session';
export const AUTH_COOKIE_MAX_AGE_SECONDS = Math.min(86400, Math.max(300, Number(process.env.AUTH_COOKIE_MAX_AGE_SECONDS || 3600)));
export const AUTH_COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE !== 'false';
export const PASSWORD_ROUNDS = Math.min(15, Math.max(12, Number(process.env.PASSWORD_ROUNDS || 12)));
const configuredOrigins = String(process.env.ALLOWED_ORIGINS || process.env.APP_BASE_URL || '')
  .split(',')
  .map(value => value.trim().replace(/\/$/, ''))
  .filter(Boolean);
export const ALLOWED_ORIGINS = [...new Set([
  ...configuredOrigins,
  'https://my-ajo.org',
  'https://www.my-ajo.org',
  'https://localhost',
  'capacitor://localhost',
])];
