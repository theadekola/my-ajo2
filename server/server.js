import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ALLOWED_ORIGINS } from './config.js';
import { getPool, sql } from './db.js';
import { csrfProtection, issueCsrfToken, rateLimit } from './middleware.js';
import { connectRedis, redisHealth } from './services/redisService.js';
import { instrumentMutations } from './services/mutationActivity.js';

import authRoutes         from './routes/auth.js';
import userRoutes         from './routes/users.js';
import groupRoutes        from './routes/groups.js';
import memberRoutes       from './routes/members.js';
import inviteRoutes       from './routes/invites.js';
import contributionRoutes from './routes/contributions.js';
import payoutRoutes       from './routes/payouts.js';
import messageRoutes      from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import { startAutomations } from './services/automationService.js';
import paymentInfoRoutes  from './routes/paymentInfo.js';
import directDebitRoutes  from './routes/directDebit.js';
import pushRoutes         from './routes/push.js';
import supportRoutes      from './routes/support.js';
import paystackRoutes, { reconcilePendingPaystackPayments } from './routes/paystack.js';
import activityRoutes     from './routes/activity.js';
import insightsRoutes     from './routes/insights.js';
import privateFileRoutes  from './routes/privateFiles.js';
import systemAdminRoutes  from './routes/systemAdmin.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcElem: ["'self'", 'https://www.googletagmanager.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      styleSrcElem: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: [
        "'self'",
        ...ALLOWED_ORIGINS,
        'https://api.paystack.co',
        'https://www.google-analytics.com',
        'https://*.google-analytics.com',
        'https://analytics.google.com',
        'https://*.analytics.google.com',
      ],
      frameSrc: ["'self'", 'blob:', 'https://docs.google.com'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      workerSrc: ["'self'", 'blob:'],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(cors({
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))) return callback(null, true);
    callback(new Error('Origin not allowed'));
  },
}));
app.use(express.json({ limit: '12mb', verify: (req, _res, buf) => { if (req.originalUrl?.startsWith('/api/paystack/webhook')) req.rawBody = Buffer.from(buf); } }));
app.get('/api/csrf', (_req, res) => res.json({ csrfToken: issueCsrfToken(res) }));
app.use('/api', csrfProtection(ALLOWED_ORIGINS));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});
app.use('/api',instrumentMutations);
app.use('/profile-pictures', express.static(path.join(__dirname, 'public-uploads', 'profile-pictures'), {
  dotfiles: 'deny', index: false, fallthrough: false, immutable: true, maxAge: '1y',
  setHeaders: res => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));
app.get('/uploads/:filename', async (req,res,next) => {
  try {
    const filename=path.basename(String(req.params.filename||''));
    const expected=`/uploads/${filename}`;
    const pool=await getPool();
    const profile=await pool.request().input('url',sql.NVarChar,expected)
      .query('SELECT TOP 1 UserId FROM Users WHERE ProfilePicture=@url');
    if(!profile.recordset[0]) return res.sendStatus(404);
    res.setHeader('Cache-Control','public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy','cross-origin');
    res.sendFile(path.join(__dirname,'uploads',filename),error=>{ if(error && !res.headersSent) next(error); });
  } catch(error) { next(error); }
});

app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use('/api/auth/password-reset', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }));
app.use('/api/auth/reset-password', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 60 }), authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/groups',        groupRoutes);
app.use('/api/members',       memberRoutes);
app.use('/api/invites',       inviteRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/payouts',       payoutRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payment-info',  paymentInfoRoutes);
app.use('/api/direct-debit',  directDebitRoutes);
app.use('/api/push',          pushRoutes);
app.use('/api/support',       supportRoutes);
app.use('/api/paystack',      paystackRoutes);
app.use('/api/dashboard/activity', activityRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/private-files', privateFileRoutes);
app.use('/api/system-admin', systemAdminRoutes);

app.get('/api/health', async (_, res) => res.json({ ok:true, ts:new Date().toISOString(), redis:await redisHealth() }));

app.use((err, _, res, _next) => {
  if (err?.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Upload must be 5 MB or smaller'
      : 'Upload must be a JPG, PNG, WebP, HEIC, HEIF, or PDF file';
    return res.status(400).json({ error: message });
  }
  if (/unexpected end of form|multipart|part terminated|boundary/i.test(String(err?.message || ''))) {
    console.error('Multipart upload failed', err?.message || err);
    return res.status(400).json({ error: 'The upload was interrupted. Please choose the file again and retry.', code: 'UPLOAD_INTERRUPTED' });
  }
  if (['EACCES', 'EPERM', 'ENOENT'].includes(err?.code)) {
    console.error('Upload storage failed', err?.message || err);
    return res.status(500).json({ error: 'Could not save the uploaded file. Please contact support if this continues.' });
  }
  if (err?.message === 'Origin not allowed') return res.status(403).json({ error: 'Origin not allowed' });
  console.error('Request failed', err?.message || err);
  res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
});

// Serve React PWA
const dist = path.join(__dirname, '..', 'client', 'dist');
app.use('/assets', express.static(path.join(dist, 'assets'), {
  dotfiles: 'deny',
  index: false,
  fallthrough: true,
  immutable: true,
  maxAge: '1y',
}));
app.use(express.static(dist, {
  dotfiles: 'deny',
  index: false,
  fallthrough: true,
  maxAge: '1h',
  setHeaders(res, filePath) {
    if (/[/\\](?:index\.html|sw\.js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));
app.get('/{*splat}', (_, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(dist, 'index.html'));
});

async function finalizeExpiredAccountDeletions() {
  try {
    const pool = await getPool();
    await pool.request().query(`UPDATE Users
      SET Email=Email+'_deleted_'+CAST(UserId AS NVARCHAR),
          AccountDeletionStatus='Deleted',
          UpdatedAt=SYSUTCDATETIME()
      WHERE IsActive=0
        AND IsProtectedAccount=0
        AND AccountDeletionDueAt IS NOT NULL
        AND AccountDeletionDueAt<=SYSUTCDATETIME()
        AND AccountDeletionStatus IN ('PendingSelfDelete','Approved','PendingAdminApproval')
        AND Email NOT LIKE '%_deleted_%'`);
  } catch (err) {
    console.error('Account deletion cleanup failed', err?.message || err);
  }
}

const PORT = process.env.PORT || 5000;
await connectRedis();
await finalizeExpiredAccountDeletions();
startAutomations();
setInterval(finalizeExpiredAccountDeletions, 60 * 60 * 1000).unref();
if (process.env.PAYSTACK_SECRET_KEY) {
  const reconciliationTimer = setInterval(
    () => reconcilePendingPaystackPayments().catch(error => console.error('Paystack reconciliation failed', error?.message || error)),
    Math.max(5, Number(process.env.PAYSTACK_RECONCILIATION_MINUTES) || 15) * 60 * 1000
  );
  reconciliationTimer.unref();
}
app.listen(PORT, () => console.log(`My Ajo v2 running on http://localhost:${PORT}`));
