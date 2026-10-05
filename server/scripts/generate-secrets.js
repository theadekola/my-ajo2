import crypto from 'crypto';

for (const name of ['JWT_SECRET','OTP_PEPPER','MFA_ENCRYPTION_KEY']) {
  console.log(`${name}=${crypto.randomBytes(32).toString('hex')}`);
}
