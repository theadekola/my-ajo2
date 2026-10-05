import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME, AUTH_COOKIE_SECURE, JWT_EXPIRES_IN, JWT_SECRET } from './config.js';
import { incrementRateLimit } from './services/redisService.js';
import { getPool, sql } from './db.js';

const retiredDemoEmails = new Set([
  'adeola@myajo.app',
  'ifeoma@myajo.app',
  'chioma@myajo.app',
  'musa@myajo.app',
  'kemi@myajo.app',
]);

const CSRF_COOKIE_NAME = '__Host-myajo_csrf';

let authUserLoader = async claims => {
  const pool = await getPool();
  await pool.request().input('uid', sql.Int, claims.userId).query(`
    DECLARE @restored TABLE(UserId INT);
    UPDATE dbo.Users SET IsActive=1,AccountStatus='Active',StatusReason=NULL,StatusUntil=NULL,
      TokenVersion=TokenVersion+1,UpdatedAt=SYSUTCDATETIME()
      OUTPUT inserted.UserId INTO @restored(UserId)
    WHERE UserId=@uid AND IsActive=0 AND AccountStatus='Suspended'
      AND StatusUntil IS NOT NULL AND StatusUntil<=SYSUTCDATETIME();
    IF EXISTS(SELECT 1 FROM @restored)
    BEGIN
      IF OBJECT_ID('dbo.AdminAuditLog') IS NOT NULL
        INSERT dbo.AdminAuditLog(ActorUserId,ActorType,Action,TargetType,TargetId,PreviousValue,NewValue,Reason,InternalNote,IpAddress,Result)
        SELECT NULL,'System','automatic-suspension-expiry','User',CONVERT(NVARCHAR(50),UserId),
          '{"AccountStatus":"Suspended"}','{"AccountStatus":"Active"}',
          'Temporary suspension expired',NULL,'system','Success' FROM @restored;
      INSERT dbo.Notifications(UserId,Type,Title,Body)
        SELECT UserId,'AccountAccessRestored','Account access restored',
          'Your temporary account suspension has expired and access has been restored.' FROM @restored;
    END
  `);
  const current = await pool.request().input('uid', sql.Int, claims.userId)
    .query(`SELECT UserId,Email,FirstName,LastName,SystemRole,IsProtectedAccount,OrganizerStatus,CanCreateGroups,
                   MfaEnabled,TokenVersion,IsActive,IsEmailVerified,OnboardingDone,LockedUntil
            FROM dbo.Users WHERE UserId=@uid`);
  return current.recordset[0];
};

export function setAuthUserLoaderForTests(loader) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Authentication loader can only be replaced in tests');
  authUserLoader = loader;
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    const raw = part.slice(index + 1).trim();
    try { return [part.slice(0, index).trim(), decodeURIComponent(raw)]; }
    catch { return [part.slice(0, index).trim(), '']; }
  }).filter(([name]) => name));
}

function csrfCookieAttributes(token, maxAge = AUTH_COOKIE_MAX_AGE_SECONDS) {
  return [
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    AUTH_COOKIE_SECURE ? 'Secure' : '',
    AUTH_COOKIE_SECURE ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join('; ');
}

export function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString('base64url');
  res.append('Set-Cookie', csrfCookieAttributes(token));
  res.setHeader('Cache-Control', 'no-store');
  return token;
}

export function csrfProtection(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (req.originalUrl?.startsWith('/api/paystack/webhook')) return next();
    if (/^Bearer\s+\S+/i.test(String(req.headers.authorization || ''))) return next();
    const cookies = parseCookies(req);
    if (!cookies[AUTH_COOKIE_NAME]) return next();

    let requestOrigin = String(req.get('origin') || '').replace(/\/$/, '');
    if (!requestOrigin && req.get('referer')) {
      try { requestOrigin = new URL(req.get('referer')).origin; } catch { requestOrigin = ''; }
    }
    if (!requestOrigin || !allowed.has(requestOrigin)) {
      return res.status(403).json({ error: 'Untrusted request origin', code: 'CSRF_ORIGIN_REJECTED' });
    }

    const cookieToken = String(cookies[CSRF_COOKIE_NAME] || '');
    const headerToken = String(req.get('x-csrf-token') || '');
    if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length
        || !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
      return res.status(403).json({ error: 'Invalid or missing CSRF token', code: 'CSRF_TOKEN_INVALID' });
    }
    next();
  };
}

export async function requirePendingAuth(req, res, next) {
  const cookies = parseCookies(req);
  const bearer = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1] || null;
  const token = bearer || cookies[AUTH_COOKIE_NAME] || null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const claims = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (retiredDemoEmails.has(String(claims.email || '').toLowerCase())) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const user = await authUserLoader(claims);
    if (!user || !user.IsActive || Number(user.TokenVersion) !== Number(claims.tokenVersion)) {
      return res.status(401).json({ error: 'Session has been revoked', code: 'SESSION_REVOKED' });
    }
    if (user.LockedUntil && new Date(user.LockedUntil) > new Date()) {
      return res.status(423).json({ error: 'Account temporarily locked', code: 'ACCOUNT_LOCKED' });
    }
    req.user = {
      ...claims,
      email: user.Email,
      name: `${user.FirstName} ${user.LastName}`,
      systemRole: user.SystemRole || 'Member',
      isProtectedAccount: !!user.IsProtectedAccount,
      organizerStatus: user.OrganizerStatus || 'NotApplied',
      canCreateGroups: !!user.CanCreateGroups,
      mfaEnabled: !!user.MfaEnabled,
      mfaVerified: claims.mfaVerified === true,
      mfaVerifiedAt: claims.mfaVerifiedAt || null,
      isEmailVerified: !!user.IsEmailVerified,
      onboardingDone: user.OnboardingDone !== false && user.OnboardingDone !== 0,
    };
    next();
  }
  catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(error);
  }
}

export function requireAuth(req, res, next) {
  return requirePendingAuth(req, res, () => {
    if (req.user?.onboardingDone === false) {
      return res.status(403).json({ error: 'Complete onboarding to continue', code: 'ONBOARDING_REQUIRED' });
    }
    next();
  });
}

export function requireAdmin(req, res, next) {
  if (!['Admin', 'SuperAdmin'].includes(req.user?.systemRole))
    return res.status(403).json({ error: 'Admin only', code: 'ADMIN_ONLY' });
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (req.user?.systemRole !== 'SuperAdmin')
    return res.status(403).json({ error: 'Super administrator only', code: 'SUPER_ADMIN_ONLY' });
  next();
}

export function requireMfa(req, res, next) {
  if (!req.user?.mfaEnabled) {
    return res.status(403).json({ error: 'MFA enrolment is required', code: 'MFA_ENROLLMENT_REQUIRED' });
  }
  if (req.user?.mfaVerified !== true) {
    return res.status(403).json({ error: 'MFA verification is required', code: 'MFA_REQUIRED' });
  }
  next();
}

export function requireVerifiedEmail(req, res, next) {
  if (!req.user?.isEmailVerified)
    return res.status(403).json({ error: 'Verify your email to continue', code: 'EMAIL_VERIFICATION_REQUIRED' });
  next();
}

export async function requireApprovedOrganizer(req, res, next) {
  try {
    const pool = await getPool();
    const result = await pool.request().input('uid', sql.Int, req.user.userId)
      .query(`SELECT OrganizerStatus,CanCreateGroups FROM Users
              WHERE UserId=@uid AND IsActive=1`);
    const user = result.recordset[0];
    if (!user || user.OrganizerStatus !== 'Approved' || !user.CanCreateGroups) {
      return res.status(403).json({ error: 'Approved organiser access required', code: 'ORGANIZER_APPROVAL_REQUIRED' });
    }
    next();
  } catch (error) { next(error); }
}

export function signToken(user) {
  return jwt.sign(
    { userId: user.UserId, email: user.Email,
      name: `${user.FirstName} ${user.LastName}`,
      systemRole: user.SystemRole || 'Member',
      isEmailVerified: user.IsEmailVerified === true || user.IsEmailVerified === 1,
      tokenVersion: user.TokenVersion || 1,
      mfaVerified: user.MfaVerified === true || user.mfaVerified === true,
      mfaVerifiedAt: user.MfaVerifiedAt || user.mfaVerifiedAt || null,
      onboardingDone: user.OnboardingDone !== false && user.OnboardingDone !== 0 },
    JWT_SECRET, { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN }
  );
}

function cookieAttributes(maxAge) {
  return [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    AUTH_COOKIE_SECURE ? 'Secure' : '',
    AUTH_COOKIE_SECURE ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].filter(Boolean);
}

export function setAuthCookie(res, user) {
  const token = encodeURIComponent(signToken(user));
  const parts = cookieAttributes(AUTH_COOKIE_MAX_AGE_SECONDS);
  parts[0] = `${AUTH_COOKIE_NAME}=${token}`;
  res.append('Set-Cookie', parts.join('; '));
  res.setHeader('Cache-Control', 'no-store');
}

export function clearAuthCookie(res) {
  res.append('Set-Cookie', cookieAttributes(0).join('; '));
  res.append('Set-Cookie', csrfCookieAttributes('', 0));
  res.setHeader('Cache-Control', 'no-store');
}

export function rateLimit({ windowMs, max }) {
  const attempts = new Map();
  return async (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const shared = await incrementRateLimit(`rate:${req.method}:${req.baseUrl || req.path}:${key}`, windowMs);
    if (shared) {
      if (shared.count > max) { res.setHeader('Retry-After', Math.ceil((shared.resetAt-now)/1000)); return res.status(429).json({error:'Too many requests. Please try again later.'}); }
      return next();
    }
    const current = attempts.get(key);
    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  };
}

// File uploads: public profile pictures and private financial evidence never share a directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const legacyUploadRoot = path.join(__dirname, 'uploads');
export const publicProfileRoot = path.join(__dirname, 'public-uploads', 'profile-pictures');
export const privateUploadRoot = path.join(__dirname, 'private-uploads', 'financial');
export const privateChatUploadRoot = path.join(__dirname, 'private-uploads', 'chat');
for (const directory of [publicProfileRoot, privateUploadRoot, privateChatUploadRoot]) fs.mkdirSync(directory, { recursive: true });

const storageFor = directory => multer.diskStorage({
  destination: (_, __, cb) => cb(null, directory),
  filename: (_, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});

const typeByExtension = new Map([
  ['.jpg',new Set(['image/jpeg'])],['.jpeg',new Set(['image/jpeg'])],['.png',new Set(['image/png'])],
  ['.webp',new Set(['image/webp'])],['.heic',new Set(['image/heic','image/heif'])],
  ['.heif',new Set(['image/heic','image/heif'])],['.pdf',new Set(['application/pdf'])],
]);

function signatureMatches(buffer, extension) {
  if (extension==='.jpg' || extension==='.jpeg') return buffer.length>=3 && buffer[0]===0xff && buffer[1]===0xd8 && buffer[2]===0xff;
  if (extension==='.png') return buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (extension==='.webp') return buffer.subarray(0,4).toString('ascii')==='RIFF' && buffer.subarray(8,12).toString('ascii')==='WEBP';
  if (extension==='.pdf') return buffer.subarray(0,5).toString('ascii')==='%PDF-';
  if (extension==='.heic' || extension==='.heif') {
    const brand=buffer.subarray(8,12).toString('ascii');
    return buffer.subarray(4,8).toString('ascii')==='ftyp' && ['heic','heix','hevc','hevx','mif1','msf1'].includes(brand);
  }
  return false;
}

export function validateFileBuffer(buffer, extension, {profileOnly=false}={}) {
  const ext=String(extension||'').toLowerCase();
  return (!profileOnly || ext!=='.pdf') && signatureMatches(buffer,ext);
}

function createUpload(directory, allowPdf) {
  return multer({
  storage: storageFor(directory),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const permitted=typeByExtension.get(ext);
    if (permitted?.has(String(file.mimetype||'').toLowerCase()) && (allowPdf || ext!=='.pdf')) return cb(null, true);
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
  });
}

export const profileUpload=createUpload(publicProfileRoot,false);
export const financialUpload=createUpload(privateUploadRoot,true);
export const chatUpload=multer({
  storage:storageFor(privateChatUploadRoot),
  limits:{fileSize:15*1024*1024,files:1},
  fileFilter:(_,file,cb)=>{
    const allowed=new Set(['image/jpeg','image/png','image/webp','application/pdf','audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-wav','audio/aac','audio/3gpp','video/mp4']);
    allowed.has(String(file.mimetype||'').toLowerCase())?cb(null,true):cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE',file.fieldname));
  }
});
export const upload=financialUpload;

export async function validateUploadedFile(file, { profileOnly=false }={}) {
  if(!file?.path) return false;
  const extension=path.extname(file.filename||file.originalname||'').toLowerCase();
  let handle;
  try {
    handle=await fs.promises.open(file.path,'r');
    const header=Buffer.alloc(32);
    const {bytesRead}=await handle.read(header,0,header.length,0);
    const valid=validateFileBuffer(header.subarray(0,bytesRead),extension,{profileOnly});
    await handle.close(); handle=null;
    if(!valid) await fs.promises.unlink(file.path).catch(()=>{});
    return valid;
  } finally { await handle?.close().catch(()=>{}); }
}
