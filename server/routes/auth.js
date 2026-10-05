import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getPool, sql } from '../db.js';
import { clearAuthCookie, profileUpload, requireAuth, requirePendingAuth, setAuthCookie, validateUploadedFile } from '../middleware.js';
import { sendOtp, sendDeletionFeedback } from '../mailer.js';
import { JWT_SECRET, PASSWORD_ROUNDS } from '../config.js';
import { decryptMfaValue, decryptRecord, encryptMfaValue, encryptValue, hashOtp } from '../utils/fieldCrypto.js';
import { sendPushToUser } from '../utils/push.js';
import { authenticatorQrDataUrl, authenticatorUri, consumeRecoveryCode, generateMfaSecret, generateRecoveryCodes, hashRecoveryCode, verifyTotp } from '../utils/mfa.js';

const r = Router();
const profileImagePattern = /\.(jpe?g|png|webp|heic|heif)$/i;
const retiredDemoEmails = new Set([
  'adeola@myajo.app',
  'ifeoma@myajo.app',
  'chioma@myajo.app',
  'musa@myajo.app',
  'kemi@myajo.app',
]);

function isRetiredDemoEmail(email) {
  return retiredDemoEmails.has(String(email || '').trim().toLowerCase());
}

function genOtp() { return String(crypto.randomInt(100000, 1000000)); }
function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
function ticketHash(ticket) { return crypto.createHash('sha256').update(String(ticket), 'utf8').digest('hex'); }

async function replaceActiveOtp(pool, { email, purpose, code, expiresAt, userId = null }) {
  await pool.request().input('e',sql.NVarChar,email).input('p',sql.NVarChar,purpose)
    .input('c',sql.NVarChar,hashOtp(email,purpose,code)).input('ex',sql.DateTime2,expiresAt).input('uid',sql.Int,userId)
    .query(`DELETE FROM OtpCodes WHERE ExpiresAt<=SYSUTCDATETIME();
            DELETE FROM RegistrationTickets WHERE ExpiresAt<=SYSUTCDATETIME();
            DELETE FROM OtpCodes WHERE Email=@e AND Purpose=@p AND UsedAt IS NULL;
            INSERT INTO OtpCodes(Email,Code,Purpose,ExpiresAt,UserId,FailedAttempts) VALUES(@e,@c,@p,@ex,@uid,0)`);
}

async function verifyActiveOtp(pool, { email, purpose, code, createRegistrationTicket = false }) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  try {
    const found=await new sql.Request(transaction).input('e',sql.NVarChar,email).input('p',sql.NVarChar,purpose)
      .query(`SELECT TOP 1 OtpId,Code,FailedAttempts FROM OtpCodes WITH (UPDLOCK,ROWLOCK)
              WHERE Email=@e AND Purpose=@p AND UsedAt IS NULL AND ExpiresAt>SYSUTCDATETIME()
              ORDER BY CreatedAt DESC`);
    const otp=found.recordset[0];
    if(!otp || Number(otp.FailedAttempts)>=5) {
      await transaction.commit();
      return {ok:false,locked:Boolean(otp)};
    }
    const supplied=hashOtp(email,purpose,code);
    if(String(otp.Code)!==supplied) {
      const failed=await new sql.Request(transaction).input('id',sql.Int,otp.OtpId)
        .query('UPDATE OtpCodes SET FailedAttempts=FailedAttempts+1 OUTPUT INSERTED.FailedAttempts WHERE OtpId=@id');
      await transaction.commit();
      return {ok:false,locked:Number(failed.recordset[0]?.FailedAttempts)>=5};
    }
    await new sql.Request(transaction).input('id',sql.Int,otp.OtpId)
      .query('UPDATE OtpCodes SET UsedAt=SYSUTCDATETIME() WHERE OtpId=@id AND UsedAt IS NULL');
    let registrationTicket=null;
    if(createRegistrationTicket) {
      registrationTicket=crypto.randomBytes(32).toString('base64url');
      await new sql.Request(transaction).input('e',sql.NVarChar,email).input('hash',sql.Char(64),ticketHash(registrationTicket))
        .query(`DELETE FROM RegistrationTickets WHERE Email=@e AND UsedAt IS NULL;
                INSERT INTO RegistrationTickets(Email,TicketHash,ExpiresAt) VALUES(@e,@hash,DATEADD(MINUTE,10,SYSUTCDATETIME()))`);
    }
    await transaction.commit();
    return {ok:true,registrationTicket};
  } catch(error) { await transaction.rollback().catch(()=>{}); throw error; }
}
function isUploadedProfileImage(file) {
  return Boolean(file && String(file.mimetype || '').startsWith('image/') && profileImagePattern.test(file.originalname || file.filename || ''));
}

const supportedCountries = {
  GH: { currencyCode: 'GHS', currencySymbol: 'GH\u20B5' },
  NG: { currencyCode: 'NGN', currencySymbol: '\u20A6' },
  ZA: { currencyCode: 'ZAR', currencySymbol: 'R' },
  GB: { currencyCode: 'GBP', currencySymbol: '\u00A3' },
  US: { currencyCode: 'USD', currencySymbol: '$' },
};

const oauthProviders = {
  google: {
    idEnv: 'GOOGLE_CLIENT_ID',
    secretEnv: 'GOOGLE_CLIENT_SECRET',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
    idColumn: 'GoogleId',
  },
};

function appBaseUrl(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function socialRedirect(path) {
  return `/auth${path}`;
}

function providerConfig(provider) {
  return oauthProviders[provider];
}

function oauthCallbackUrl(req, provider) {
  return `${appBaseUrl(req)}/api/auth/${provider}/callback`;
}

function createOAuthState(provider) {
  const payload = Buffer.from(JSON.stringify({
    provider,
    nonce: crypto.randomBytes(12).toString('hex'),
    ts: Date.now(),
  })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyOAuthState(state, provider) {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) return false;
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payload)
    .digest('base64url');
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expected)) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return data.provider === provider && Date.now() - data.ts < 10 * 60 * 1000;
}

function splitName(profile) {
  const firstName = profile.given_name || profile.givenName || '';
  const lastName = profile.family_name || profile.surname || '';
  if (firstName || lastName) return { firstName: firstName || 'Ajo', lastName: lastName || 'Member' };
  const parts = String(profile.name || profile.displayName || profile.email || 'Ajo Member').trim().split(/\s+/);
  return { firstName: parts[0] || 'Ajo', lastName: parts.slice(1).join(' ') || 'Member' };
}


async function finalizeExpiredAccountDeletions(pool) {
  await pool.request().query(`UPDATE Users
    SET Email=Email+'_deleted_'+CAST(UserId AS NVARCHAR),
        AccountDeletionStatus='Deleted',
        UpdatedAt=SYSUTCDATETIME()
    WHERE IsActive=0
      AND AccountDeletionDueAt IS NOT NULL
      AND AccountDeletionDueAt<=SYSUTCDATETIME()
      AND AccountDeletionStatus IN ('PendingSelfDelete','Approved','PendingAdminApproval')
      AND IsProtectedAccount=0
      AND Email NOT LIKE '%_deleted_%'`);
}

async function getDeletionContext(pool, userId) {
  const memberships = await pool.request().input('uid', sql.Int, userId)
    .query(`SELECT gm.MemberId,gm.GroupId,gm.Role,gm.Status,g.GroupName,g.AdminUserId,
                   admin.FirstName+' '+admin.LastName AS AdminName
            FROM GroupMembers gm
            JOIN AjoGroups g ON g.GroupId=gm.GroupId
            JOIN Users admin ON admin.UserId=g.AdminUserId
            WHERE gm.UserId=@uid AND gm.Status='Approved'
            ORDER BY g.GroupName`);
  const adminGroups = await pool.request().input('uid', sql.Int, userId)
    .query(`SELECT g.GroupId,g.GroupName,
                   COUNT(CASE WHEN gm.UserId<>@uid AND gm.Status='Approved' THEN 1 END) AS ActiveMemberCount
            FROM AjoGroups g
            LEFT JOIN GroupMembers gm ON gm.GroupId=g.GroupId
            WHERE g.AdminUserId=@uid AND g.Status='Active'
            GROUP BY g.GroupId,g.GroupName
            HAVING COUNT(CASE WHEN gm.UserId<>@uid AND gm.Status='Approved' THEN 1 END)>0
            ORDER BY g.GroupName`);
  return { memberships: memberships.recordset, adminGroups: adminGroups.recordset };
}

function deletionMessageText(user, groupName) {
  const name = [user.FirstName, user.LastName].filter(Boolean).join(' ').trim() || 'A group member';
  return `${name} is requesting permission to delete their My Ajo account in ${groupName}. Please confirm they are not owing any Ajo money before approving. If approved, the account will be inactive and fully deleted after 24 hours unless the member recovers it.`;
}
async function exchangeOAuthCode(req, provider, code) {
  const cfg = providerConfig(provider);
  const clientId = process.env[cfg.idEnv];
  const clientSecret = process.env[cfg.secretEnv];
  const tokenRes = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: oauthCallbackUrl(req, provider),
    }),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(token.error_description || token.error || 'OAuth token exchange failed');

  const userRes = await fetch(cfg.userInfoUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await userRes.json();
  if (!userRes.ok) throw new Error(profile.error_description || profile.error || 'OAuth profile fetch failed');
  return profile;
}

async function findOrCreateSocialUser(provider, profile) {
  const cfg = providerConfig(provider);
  const providerId = profile.sub || profile.id;
  const email = String(profile.email || profile.preferred_username || '').toLowerCase();
  if (!providerId || !email) throw new Error('Your social account did not return an email address');
  if (isRetiredDemoEmail(email)) throw new Error('This account is no longer available');

  const pool = await getPool();
  const byProvider = await pool.request()
    .input('pid', sql.NVarChar, providerId)
    .query(`SELECT * FROM Users WHERE ${cfg.idColumn}=@pid AND IsActive=1`);
  if (byProvider.recordset[0]) return { user: byProvider.recordset[0], accountExists: true };

  const byEmail = await pool.request()
    .input('email', sql.NVarChar, email)
    .query('SELECT * FROM Users WHERE Email=@email AND IsActive=1');
  if (byEmail.recordset[0]) {
    const user = byEmail.recordset[0];
    await pool.request()
      .input('id', sql.Int, user.UserId)
      .input('pid', sql.NVarChar, providerId)
      .query(`UPDATE Users SET ${cfg.idColumn}=@pid, IsEmailVerified=1, UpdatedAt=SYSUTCDATETIME() WHERE UserId=@id`);
    user[cfg.idColumn] = providerId;
    user.IsEmailVerified = true;
    return { user, accountExists: true };
  }

  const { firstName, lastName } = splitName(profile);
  const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), PASSWORD_ROUNDS);
  const created = await pool.request()
    .input('fn', sql.NVarChar, firstName)
    .input('ln', sql.NVarChar, lastName)
    .input('email', sql.NVarChar, email)
    .input('hash', sql.NVarChar, randomPassword)
    .input('pid', sql.NVarChar, providerId)
    .query(`
      INSERT INTO Users(FirstName,LastName,Email,PasswordHash,CountryCode,CurrencyCode,CurrencySymbol,SystemRole,IsEmailVerified,OnboardingDone,${cfg.idColumn})
      OUTPUT INSERTED.*
      VALUES(@fn,@ln,@email,@hash,'NG','NGN',N'\u20A6','Member',1,0,@pid)
    `);
  return { user: created.recordset[0], accountExists: false };
}

/* GET /api/auth/google */
r.get('/google', (req, res) => res.status(404).json({ error: 'Google sign-in is disabled' }));

/* GET /api/auth/google/callback */
r.get('/google/callback', (req, res) => res.status(404).json({ error: 'Google sign-in is disabled' }));

function startSocialAuth(req, res, provider) {
  const cfg = providerConfig(provider);
  const clientId = process.env[cfg.idEnv];
  const clientSecret = process.env[cfg.secretEnv];
  if (!clientId || !clientSecret) return res.redirect(socialRedirect('?social=not-configured'));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthCallbackUrl(req, provider),
    response_type: 'code',
    scope: cfg.scope,
    state: createOAuthState(provider),
    prompt: provider === 'google' ? 'select_account' : 'select_account',
  });
  res.redirect(`${cfg.authorizeUrl}?${params.toString()}`);
}

function needsProfileCompletion(user) {
  return ![
    user.Title,
    user.FirstName,
    user.LastName,
    user.Phone,
    user.CountryCode,
    user.Sex,
    user.Occupation,
    user.Address,
  ].every(value => String(value || '').trim());
}

async function finishSocialAuth(req, res, provider) {
  try {
    if (req.query.error) return res.redirect(socialRedirect(`?social=failed&message=${encodeURIComponent(req.query.error_description || req.query.error)}`));
    if (!verifyOAuthState(req.query.state, provider)) return res.redirect(socialRedirect('?social=failed&message=Invalid%20social%20sign-in%20state'));
    const profile = await exchangeOAuthCode(req, provider, req.query.code);
    const { user, accountExists } = await findOrCreateSocialUser(provider, profile);
    setAuthCookie(res, user);
    if (!accountExists || user.OnboardingDone === false || user.OnboardingDone === 0) {
      return res.redirect(socialRedirect('?social=profile'));
    }
    if (needsProfileCompletion(user)) {
      return res.redirect(socialRedirect('?social=profile'));
    }
    return res.redirect(socialRedirect('?social=success'));
  } catch (e) {
    console.error(`${provider} auth failed`, e);
    res.redirect(socialRedirect(`?social=failed&message=${encodeURIComponent(e.message || 'Social sign-in failed')}`));
  }
}

/* POST /api/auth/social/onboarding */
r.post('/social/onboarding', requirePendingAuth, profileUpload.single('profilePicture'), async (req, res) => {
  try {
    if (req.user.onboardingDone !== false) return res.status(409).json({ error: 'Onboarding is already complete' });
    const {
      title, firstName, lastName, phone, dialCode, countryCode,
      sex, dateOfBirth, occupation, address
    } = req.body;
    if (![title, firstName, lastName, phone, dialCode, countryCode, sex, occupation, address]
      .every(value => String(value || '').trim())) {
      return res.status(400).json({ error: 'All onboarding fields are required' });
    }
    const country = supportedCountries[countryCode];
    if (!country) return res.status(400).json({ error: 'Please choose a supported country' });
    const birthDate = dateOfBirth ? new Date(dateOfBirth) : null;
    if (birthDate && (Number.isNaN(birthDate.getTime()) || birthDate > new Date())) return res.status(400).json({ error: 'Enter a valid date of birth' });
    if (!isUploadedProfileImage(req.file) || !await validateUploadedFile(req.file,{profileOnly:true})) return res.status(400).json({ error: 'A valid profile picture is required' });

    const pool = await getPool();
    const current = await pool.request().input('id', sql.Int, req.user.userId)
      .query('SELECT OnboardingDone,GoogleId,MicrosoftId FROM Users WHERE UserId=@id AND IsActive=1');
    const pending = current.recordset[0];
    if (!pending) return res.status(404).json({ error: 'Account not found' });
    if (pending.OnboardingDone) return res.status(409).json({ error: 'Onboarding is already complete' });
    if (!pending.GoogleId && !pending.MicrosoftId) return res.status(403).json({ error: 'Social onboarding is not available for this account' });

    const profilePicture = `/profile-pictures/${req.file.filename}`;
    const updated = await pool.request()
      .input('id', sql.Int, req.user.userId)
      .input('ti', sql.NVarChar, String(title).trim())
      .input('fn', sql.NVarChar, String(firstName).trim())
      .input('ln', sql.NVarChar, String(lastName).trim())
      .input('ph', sql.NVarChar, encryptValue(String(phone).trim()))
      .input('dc', sql.NVarChar, String(dialCode).trim())
      .input('pp', sql.NVarChar, profilePicture)
      .input('cc', sql.Char, countryCode)
      .input('cu', sql.Char, country.currencyCode)
      .input('sy', sql.NVarChar, country.currencySymbol)
      .input('sx', sql.NVarChar, String(sex).trim())
      .input('db', sql.Date, birthDate)
      .input('oc', sql.NVarChar, String(occupation).trim())
      .input('ad', sql.NVarChar, encryptValue(String(address).trim()))
      .query(`UPDATE Users SET Title=@ti,FirstName=@fn,LastName=@ln,Phone=@ph,DialCode=@dc,
              ProfilePicture=@pp,CountryCode=@cc,CurrencyCode=@cu,CurrencySymbol=@sy,Sex=@sx,
              DateOfBirth=@db,Occupation=@oc,Address=@ad,SystemRole='Member',OnboardingDone=1,
              UpdatedAt=SYSUTCDATETIME()
              WHERE UserId=@id AND OnboardingDone=0`);
    if (!updated.rowsAffected?.[0]) return res.status(409).json({ error: 'Onboarding is already complete' });
    const refreshed=await pool.request().input('id',sql.Int,req.user.userId).query('SELECT * FROM dbo.Users WHERE UserId=@id');
    const user = refreshed.recordset[0];
    delete user.PasswordHash;
    Object.assign(user, decryptRecord(user, ['Phone','Address','BankName','BankAccountNumber','BankAccountName','BankRoutingCode']));
    setAuthCookie(res, user);
    res.json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not complete social onboarding' });
  }
});

/* POST /api/auth/register/otp */
r.post('/register/otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (isRetiredDemoEmail(email)) return res.status(403).json({ error: 'This account is no longer available' });
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ error: 'Email service is not configured on the server' });
    }
    const pool = await getPool();
    const existing = await pool.request()
      .input('e', sql.NVarChar, email)
      .query('SELECT 1 FROM Users WHERE Email=@e AND IsActive=1');
    if (existing.recordset.length) return res.status(409).json({ error: 'Email already registered' });

    const code = genOtp();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await replaceActiveOtp(pool,{email,purpose:'EmailVerify',code,expiresAt:expires});
    const delivery = await sendOtp(email, code, 'EmailVerify');
    res.json({ sent: true, sentTo: delivery.recipient });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.response || e?.message || 'Failed to send verification code' });
  }
});

/* POST /api/auth/register/verify */
r.post('/register/verify', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
    const pool = await getPool();
    const result=await verifyActiveOtp(pool,{email,purpose:'EmailVerify',code,createRegistrationTicket:true});
    if(!result.ok) return res.status(result.locked?429:400).json({error:result.locked?'Too many incorrect attempts. Request a new code.':'Invalid or expired verification code'});
    res.json({ verified:true, registrationTicket:result.registrationTicket });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/* POST /api/auth/register */
r.post('/register', profileUpload.single('profilePicture'), async (req, res) => {
  try {
    const {
      title, firstName, lastName, phone, dialCode, password,
      countryCode='NG', currencyCode='NGN', currencySymbol='NGN',
      sex, dateOfBirth, occupation, address, bio, registrationTicket,
      termsAccepted, marketingConsent
    } = req.body;
    const email = normalizeEmail(req.body.email);
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
      return res.status(400).json({ error:'Password must be between 12 and 128 characters' });
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({ error:'Password must include uppercase and lowercase letters, a number, and a special character' });
    }
    if (String(termsAccepted).toLowerCase() !== 'true') {
      return res.status(400).json({ error:'You must accept the Terms of Service and Privacy Policy' });
    }
    if (!title||!firstName||!lastName||!email||!phone||!dialCode||!password||!registrationTicket||!countryCode||!sex||!occupation||!address) {
      return res.status(400).json({ error:'All onboarding fields are required' });
    }
    if (!isUploadedProfileImage(req.file) || !await validateUploadedFile(req.file,{profileOnly:true})) return res.status(400).json({ error:'A valid profile picture is required' });
    const profilePicture = `/profile-pictures/${req.file.filename}`;
    if (isRetiredDemoEmail(email)) return res.status(403).json({ error:'This account is no longer available' });
    const pool = await getPool();
    const ex = await pool.request().input('e',sql.NVarChar,email).query('SELECT 1 FROM Users WHERE Email=@e');
    if (ex.recordset.length) return res.status(409).json({ error:'Email already registered' });
    const birthDate = dateOfBirth ? new Date(dateOfBirth) : null;
    if (birthDate && (Number.isNaN(birthDate.getTime()) || birthDate > new Date())) return res.status(400).json({ error:'Enter a valid date of birth' });
    const hash = await bcrypt.hash(password, PASSWORD_ROUNDS);
    const transaction=new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    let r2;
    try {
      const ticket=await new sql.Request(transaction).input('e',sql.NVarChar,email).input('hash',sql.Char(64),ticketHash(registrationTicket))
        .query(`UPDATE RegistrationTickets WITH (ROWLOCK) SET UsedAt=SYSUTCDATETIME()
                OUTPUT INSERTED.RegistrationTicketId
                WHERE Email=@e AND TicketHash=@hash AND UsedAt IS NULL AND ExpiresAt>SYSUTCDATETIME()`);
      if(!ticket.recordset[0]) {
        await transaction.rollback();
        return res.status(400).json({error:'Email verification expired. Request a new code.'});
      }
      r2 = await new sql.Request(transaction)
      .input('ti',sql.NVarChar,title||null)
      .input('fn',sql.NVarChar,firstName).input('ln',sql.NVarChar,lastName)
      .input('em',sql.NVarChar,email).input('ph',sql.NVarChar,encryptValue(phone))
      .input('dc',sql.NVarChar,dialCode||null).input('ha',sql.NVarChar,hash)
      .input('pp',sql.NVarChar,profilePicture)
      .input('cc',sql.Char,countryCode).input('cu',sql.Char,currencyCode)
      .input('sy',sql.NVarChar,currencySymbol)
      .input('sx',sql.NVarChar,sex||null).input('db',sql.Date,birthDate)
      .input('oc',sql.NVarChar,occupation||null).input('ad',sql.NVarChar,encryptValue(address))
      .input('bi',sql.NVarChar,bio||null)
      .input('mc',sql.Bit,String(marketingConsent).toLowerCase()==='true')
      .query(`INSERT INTO Users(Title,FirstName,LastName,Email,Phone,DialCode,PasswordHash,ProfilePicture,CountryCode,CurrencyCode,CurrencySymbol,Sex,DateOfBirth,Occupation,Address,Bio,SystemRole,IsEmailVerified,OnboardingDone,TermsAcceptedAt,MarketingConsent)
              OUTPUT INSERTED.UserId,INSERTED.FirstName,INSERTED.LastName,INSERTED.Email,INSERTED.ProfilePicture,INSERTED.CurrencySymbol,INSERTED.SystemRole
              VALUES(@ti,@fn,@ln,@em,@ph,@dc,@ha,@pp,@cc,@cu,@sy,@sx,@db,@oc,@ad,@bi,'Member',1,1,SYSUTCDATETIME(),@mc)`);
      await transaction.commit();
    } catch(error) { await transaction.rollback().catch(()=>{}); throw error; }
    const user = decryptRecord(r2.recordset[0], ['Phone','Address','BankName','BankAccountNumber','BankAccountName','BankRoutingCode']);
    setAuthCookie(res, user);
    res.status(201).json({ user });
  } catch(e){
    console.error('Registration failed', e);
    if (e?.number === 2627 || e?.number === 2601) {
      return res.status(409).json({ error:'Email already registered' });
    }
    if (e?.number === 8152 || e?.number === 2628) {
      return res.status(400).json({ error:'One of your onboarding fields is too long. Please shorten it and try again.' });
    }
    res.status(500).json({ error:'Registration failed' });
  }
});
/* POST /api/auth/login */
r.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || typeof password !== 'string') return res.status(400).json({ error:'Email and password are required' });
    if (isRetiredDemoEmail(email)) return res.status(401).json({ error:'Invalid email or password' });
    const pool = await getPool();
    await finalizeExpiredAccountDeletions(pool);
    const r2 = await pool.request().input('e',sql.NVarChar,email)
      .query('SELECT * FROM Users WHERE Email=@e');
    let user = r2.recordset[0];
    if (user?.LockedUntil && new Date(user.LockedUntil) > new Date()) {
      return res.status(423).json({ error:'Account temporarily locked. Please try again later.' });
    }
    if (!user || !(await bcrypt.compare(password,user.PasswordHash))) {
      if (user) {
        await pool.request().input('id',sql.Int,user.UserId)
          .query(`UPDATE Users SET FailedLoginCount=FailedLoginCount+1,
                  LockedUntil=CASE WHEN FailedLoginCount+1>=5 THEN DATEADD(minute,15,SYSUTCDATETIME()) ELSE LockedUntil END
                  WHERE UserId=@id`);
      }
      return res.status(401).json({ error:'Invalid email or password' });
    }

    await pool.request().input('id',sql.Int,user.UserId).input('ip',sql.NVarChar,String(req.ip||req.socket?.remoteAddress||'').slice(0,64))
      .query(`UPDATE Users SET FailedLoginCount=0,LockedUntil=NULL,LastLoginAt=SYSUTCDATETIME(),LastLoginIp=@ip WHERE UserId=@id`);

    if (!user.IsActive) {
      const dueAt = user.AccountDeletionDueAt ? new Date(user.AccountDeletionDueAt) : null;
      const recoverableStatuses = new Set(['PendingSelfDelete','PendingAdminApproval','Approved']);
      const canRecover = recoverableStatuses.has(user.AccountDeletionStatus) && (!dueAt || dueAt > new Date());
      if (!canRecover) return res.status(401).json({ error:'This account has been deleted' });
      await pool.request().input('id', sql.Int, user.UserId)
        .query(`UPDATE Users
                SET IsActive=1,
                    AccountDeletionStatus='Recovered',
                    AccountDeletionDueAt=NULL,
                    AccountDeletionApprovedAt=NULL,
                    UpdatedAt=SYSUTCDATETIME()
                WHERE UserId=@id`);
      await pool.request().input('id', sql.Int, user.UserId)
        .query(`UPDATE AccountDeletionRequests SET Status='Recovered',RespondedAt=SYSUTCDATETIME() WHERE UserId=@id AND Status='Pending'`);
      const refreshed = await pool.request().input('id', sql.Int, user.UserId).query('SELECT * FROM Users WHERE UserId=@id');
      user = refreshed.recordset[0] || user;
    }

    const rounds = bcrypt.getRounds(user.PasswordHash);
    if (rounds < PASSWORD_ROUNDS) {
      const strongerHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
      await pool.request().input('id',sql.Int,user.UserId).input('h',sql.NVarChar,strongerHash)
        .query('UPDATE Users SET PasswordHash=@h,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@id');
    }
    if (user.MfaEnabled && user.SystemRole !== 'SuperAdmin') {
      const mfaTicket = jwt.sign(
        { purpose:'mfa-login', userId:user.UserId, tokenVersion:user.TokenVersion || 1 },
        JWT_SECRET,
        { algorithm:'HS256', expiresIn:'5m' }
      );
      return res.json({ mfaRequired:true, mfaTicket });
    }
    user.MfaVerified=false;
    user.MfaVerifiedAt=null;
    delete user.PasswordHash;
    Object.assign(user, decryptRecord(user, ['Phone','Address','BankName','BankAccountNumber','BankAccountName','BankRoutingCode']));
    setAuthCookie(res, user);
    res.json({ user, recovered: user.AccountDeletionStatus === 'Recovered' });
  } catch(e){ console.error(e); res.status(500).json({ error:'Login failed' }); }
});
/* GET /api/auth/me */
r.get('/me', requirePendingAuth, async (req, res) => {
  const pool = await getPool();
  const r2 = await pool.request().input('id',sql.Int,req.user.userId)
    .query(`SELECT UserId,FirstName,LastName,Title,Email,Phone,DialCode,ProfilePicture,Sex,Address,
            Occupation,CountryCode,CurrencyCode,CurrencySymbol,Language,AvatarColor,Bio,DateOfBirth,
            BankName,BankAccountNumber,BankAccountName,BankRoutingCode,
            SystemRole,IsProtectedAccount,OrganizerStatus,CanCreateGroups,MfaEnabled,IsEmailVerified,OnboardingDone,
            NotifPayment,NotifPayout,NotifMember,NotifChat,AdminGroupMembersAnonymous,AccountDeletionStatus,AccountDeletionRequestedAt,AccountDeletionDueAt,CreatedAt
            FROM Users WHERE UserId=@id`);
  const responseUser=decryptRecord(r2.recordset[0], ['Phone','Address','BankName','BankAccountNumber','BankAccountName','BankRoutingCode']);
  if(req.user?.mfaVerifiedAt) responseUser.MfaVerifiedAt=req.user.mfaVerifiedAt;
  res.json(responseUser);
});

r.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ loggedOut:true });
});

/* POST /api/auth/otp - send email verify OTP */
r.post('/otp', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const code = genOtp();
    const expires = new Date(Date.now() + 10*60*1000);
    await replaceActiveOtp(pool,{email:req.user.email,purpose:'EmailVerify',code,expiresAt:expires,userId:req.user.userId});
    await sendOtp(req.user.email, code, 'EmailVerify');
    res.json({ sent: true });
  } catch(e){ console.error(e); res.status(500).json({ error:'Failed to send OTP' }); }
});

/* POST /api/auth/otp/verify */
r.post('/otp/verify', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const pool = await getPool();
    const verified=await verifyActiveOtp(pool,{email:req.user.email,purpose:'EmailVerify',code});
    if(!verified.ok) return res.status(verified.locked?429:400).json({error:verified.locked?'Too many incorrect attempts. Request a new code.':'Invalid or expired code'});
    await pool.request().input('uid',sql.Int,req.user.userId).query('UPDATE Users SET IsEmailVerified=1 WHERE UserId=@uid');
    res.json({ verified: true });
  } catch(e){ console.error(e); res.status(500).json({ error:'Verification failed' }); }
});

/* POST /api/auth/password-reset/otp */
r.post('/password-reset/otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const pool = await getPool();
    const r2 = await pool.request().input('e',sql.NVarChar,email).query('SELECT UserId FROM Users WHERE Email=@e AND IsActive=1');
    if (!r2.recordset.length) return res.json({ sent: true }); // don't reveal
    const code = genOtp();
    const expires = new Date(Date.now() + 10*60*1000);
    await replaceActiveOtp(pool,{email,purpose:'PasswordReset',code,expiresAt:expires});
    await sendOtp(email, code, 'PasswordReset');
    res.json({ sent: true });
  } catch(e){ console.error(e); res.status(500).json({ error:'Failed to send reset code' }); }
});

/* POST /api/auth/reset-password */
r.post('/reset-password', async (req, res) => {
  try {
    const email=normalizeEmail(req.body.email); const { code, newPassword } = req.body;
    if (!email||!code||typeof newPassword!=='string'||newPassword.length<12||newPassword.length>128) return res.status(400).json({ error:'Password must be between 12 and 128 characters' });
    const pool = await getPool();
    const verified=await verifyActiveOtp(pool,{email,purpose:'PasswordReset',code});
    if(!verified.ok) return res.status(verified.locked?429:400).json({error:verified.locked?'Too many incorrect attempts. Request a new code.':'Invalid or expired code'});
    const hash = await bcrypt.hash(newPassword, PASSWORD_ROUNDS);
    await pool.request().input('e',sql.NVarChar,email).input('h',sql.NVarChar,hash)
      .query('UPDATE Users SET PasswordHash=@h,TokenVersion=TokenVersion+1 WHERE Email=@e');
    res.json({ reset: true });
  } catch(e){ console.error(e); res.status(500).json({ error:'Reset failed' }); }
});

r.get('/me/delete-info', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    await finalizeExpiredAccountDeletions(pool);
    const context = await getDeletionContext(pool, req.user.userId);
    res.json(context);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load account deletion checks' });
  }
});

r.post('/mfa/setup', requirePendingAuth, async (req,res) => {
  try {
    const pool=await getPool();
    const account=await pool.request().input('uid',sql.Int,req.user.userId)
      .query('SELECT PasswordHash,MfaEnabled FROM dbo.Users WHERE UserId=@uid AND IsActive=1');
    const current=account.recordset[0];
    if(!current || !current.PasswordHash || !await bcrypt.compare(String(req.body?.password||''),current.PasswordHash)) {
      return res.status(401).json({error:'Password confirmation failed',code:'PASSWORD_CONFIRMATION_FAILED'});
    }
    if(current.MfaEnabled) return res.status(409).json({error:'MFA is already enabled'});
    const secret=generateMfaSecret();
    await pool.request().input('uid',sql.Int,req.user.userId).input('secret',sql.NVarChar,encryptMfaValue(secret))
      .query(`UPDATE dbo.Users SET MfaPendingSecret=@secret,UpdatedAt=SYSUTCDATETIME()
              WHERE UserId=@uid AND IsActive=1`);
    const uri=authenticatorUri(secret,req.user.email);
    const qrCode=await authenticatorQrDataUrl(secret,req.user.email);
    res.json({secret,uri,qrCode});
  } catch(error) { console.error(error); res.status(500).json({error:'Could not start MFA enrolment'}); }
});

r.post('/mfa/enable', requirePendingAuth, async (req,res) => {
  try {
    const pool=await getPool();
    const found=await pool.request().input('uid',sql.Int,req.user.userId)
      .query('SELECT MfaPendingSecret FROM dbo.Users WHERE UserId=@uid AND IsActive=1');
    const pending=found.recordset[0]?.MfaPendingSecret;
    if(!pending) return res.status(409).json({error:'Start MFA enrolment first'});
    const secret=decryptMfaValue(pending);
    if(!verifyTotp(secret,req.body?.code)) return res.status(400).json({error:'Invalid authenticator code'});
    const recoveryCodes=generateRecoveryCodes();
    const recoveryHashes=JSON.stringify(recoveryCodes.map(hashRecoveryCode));
    const updated=await pool.request().input('uid',sql.Int,req.user.userId)
      .input('secret',sql.NVarChar,encryptMfaValue(secret)).input('recovery',sql.NVarChar(sql.MAX),recoveryHashes)
      .query(`UPDATE dbo.Users
              SET MfaSecret=@secret,MfaPendingSecret=NULL,MfaRecoveryCodes=@recovery,MfaEnabled=1,
                  MfaEnrolledAt=SYSUTCDATETIME(),TokenVersion=TokenVersion+1,UpdatedAt=SYSUTCDATETIME()
              WHERE UserId=@uid AND IsActive=1`);
    if(!updated.rowsAffected?.[0]) return res.status(409).json({error:'MFA enrolment could not be completed'});
    const refreshed=await pool.request().input('uid',sql.Int,req.user.userId).query('SELECT * FROM dbo.Users WHERE UserId=@uid');
    const user=refreshed.recordset[0];
    user.MfaVerified=true;
    user.MfaVerifiedAt=new Date().toISOString();
    delete user.PasswordHash;
    setAuthCookie(res,user);
    res.json({enabled:true,recoveryCodes});
  } catch(error) { console.error(error); res.status(500).json({error:'Could not enable MFA'}); }
});

r.post('/mfa/login/verify', async (req,res) => {
  try {
    const claims=jwt.verify(String(req.body?.mfaTicket||''),JWT_SECRET,{algorithms:['HS256']});
    if(!['mfa-login','mfa-admin-switch'].includes(claims.purpose)) return res.status(401).json({error:'Invalid MFA challenge'});
    const pool=await getPool();
    const found=await pool.request().input('uid',sql.Int,claims.userId)
      .query(`SELECT * FROM dbo.Users WHERE UserId=@uid AND IsActive=1
              AND (LockedUntil IS NULL OR LockedUntil<=SYSUTCDATETIME())`);
    const user=found.recordset[0];
    if(!user || !user.MfaEnabled || Number(user.TokenVersion)!==Number(claims.tokenVersion)) {
      return res.status(401).json({error:'MFA challenge has expired',code:'SESSION_REVOKED'});
    }
    const secret=decryptMfaValue(user.MfaSecret);
    let verified=verifyTotp(secret,req.body?.code);
    if(!verified && req.body?.recoveryCode) {
      const remaining=consumeRecoveryCode(user.MfaRecoveryCodes,req.body.recoveryCode);
      if(remaining!==null) {
        const consumed=await pool.request().input('uid',sql.Int,user.UserId)
          .input('current',sql.NVarChar(sql.MAX),user.MfaRecoveryCodes).input('remaining',sql.NVarChar(sql.MAX),remaining)
          .query('UPDATE dbo.Users SET MfaRecoveryCodes=@remaining WHERE UserId=@uid AND MfaRecoveryCodes=@current');
        verified=Number(consumed.rowsAffected?.[0]||0)===1;
      }
    }
    if(!verified) return res.status(401).json({error:'Invalid authenticator or recovery code'});
    user.MfaVerified=true;
    user.MfaVerifiedAt=new Date().toISOString();
    delete user.PasswordHash;
    setAuthCookie(res,user);
    res.json({user:decryptRecord(user,['Phone','Address','BankName','BankAccountNumber','BankAccountName','BankRoutingCode'])});
  } catch(error) {
    if(error?.name==='JsonWebTokenError'||error?.name==='TokenExpiredError') return res.status(401).json({error:'Invalid or expired MFA challenge'});
    console.error(error); res.status(500).json({error:'Could not verify MFA'});
  }
});

r.post('/mfa/admin/challenge', requireAuth, async (req,res) => {
  try {
    const pool=await getPool();
    const found=await pool.request().input('uid',sql.Int,req.user.userId)
      .query(`SELECT * FROM dbo.Users WHERE UserId=@uid AND IsActive=1
              AND (LockedUntil IS NULL OR LockedUntil<=SYSUTCDATETIME())`);
    const user=found.recordset[0];
    if(!user || user.SystemRole!=='SuperAdmin') {
      return res.status(403).json({error:'Super administrator only',code:'SUPER_ADMIN_ONLY'});
    }
    if(!user.MfaEnabled) {
      return res.status(403).json({error:'MFA enrolment is required',code:'MFA_ENROLLMENT_REQUIRED'});
    }
    user.MfaVerified=false;
    user.MfaVerifiedAt=null;
    setAuthCookie(res,user);
    const mfaTicket=jwt.sign(
      {purpose:'mfa-admin-switch',userId:user.UserId,tokenVersion:user.TokenVersion||1},
      JWT_SECRET,
      {algorithm:'HS256',expiresIn:'5m'}
    );
    res.json({mfaRequired:true,mfaTicket});
  } catch(error) {
    console.error(error);
    res.status(500).json({error:'Could not start Super Admin verification'});
  }
});

r.post('/mfa/disable', requireAuth, async (req,res) => {
  try {
    const pool=await getPool();
    const found=await pool.request().input('uid',sql.Int,req.user.userId).query('SELECT * FROM dbo.Users WHERE UserId=@uid');
    const user=found.recordset[0];
    if(user?.IsProtectedAccount || user?.SystemRole==='SuperAdmin') {
      return res.status(403).json({error:'MFA cannot be disabled on the protected SuperAdmin account',code:'PROTECTED_ACCOUNT'});
    }
    if(!user || !await bcrypt.compare(String(req.body?.password||''),user.PasswordHash)) {
      return res.status(401).json({error:'Password confirmation failed'});
    }
    let verified=verifyTotp(decryptMfaValue(user.MfaSecret),req.body?.code);
    if(!verified && req.body?.recoveryCode) verified=consumeRecoveryCode(user.MfaRecoveryCodes,req.body.recoveryCode)!==null;
    if(!verified) return res.status(401).json({error:'MFA confirmation failed'});
    await pool.request().input('uid',sql.Int,user.UserId)
      .query(`UPDATE dbo.Users SET MfaEnabled=0,MfaSecret=NULL,MfaPendingSecret=NULL,MfaRecoveryCodes=NULL,
              MfaEnrolledAt=NULL,TokenVersion=TokenVersion+1,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@uid`);
    clearAuthCookie(res);
    res.json({disabled:true,reauthenticate:true});
  } catch(error) { console.error(error); res.status(500).json({error:'Could not disable MFA'}); }
});

r.post('/sign-out-all', requireAuth, async (req,res) => {
  const pool=await getPool();
  await pool.request().input('uid',sql.Int,req.user.userId)
    .query('UPDATE dbo.Users SET TokenVersion=TokenVersion+1,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@uid');
  clearAuthCookie(res);
  res.json({signedOut:true});
});

async function deleteCurrentAccount(req, res) {
  try {
    const { feedback, rating, confirmName } = req.body || {};
    const pool = await getPool();
    await finalizeExpiredAccountDeletions(pool);
    const r2 = await pool.request()
      .input('id', sql.Int, req.user.userId)
      .query(`SELECT UserId,Email,FirstName,LastName,SystemRole,IsProtectedAccount
              FROM dbo.Users WHERE UserId=@id AND IsActive=1`);
    if (!r2.recordset.length) return res.status(404).json({ error: 'Account not found' });

    const user = r2.recordset[0];
    if (user.IsProtectedAccount || user.SystemRole === 'SuperAdmin') {
      return res.status(403).json({
        error: 'This protected SuperAdmin account cannot be deleted',
        code: 'PROTECTED_ACCOUNT'
      });
    }
    const expectedName = [user.FirstName, user.LastName].filter(Boolean).join(' ').trim();
    const typedName = String(confirmName || '').trim();
    if (!typedName || typedName.toLowerCase() !== expectedName.toLowerCase()) {
      return res.status(400).json({ error: 'Type your full name to confirm account deletion' });
    }

    const context = await getDeletionContext(pool, req.user.userId);
    if (context.adminGroups.length) {
      return res.status(409).json({
        error: 'Resolve all members in your created groups before deleting your admin account',
        adminGroups: context.adminGroups
      });
    }

    try { await sendDeletionFeedback(user.Email, feedback || '', rating || 0); } catch {}

    const memberGroups = context.memberships.filter(group => group.Role !== 'Admin');
    if (!memberGroups.length) {
      await pool.request()
        .input('id', sql.Int, req.user.userId)
        .input('reason', sql.NVarChar, encryptValue(feedback || null))
        .input('rating', sql.Int, Number(rating) || null)
        .query(`UPDATE Users
                SET IsActive=0,
                    AccountDeletionStatus='PendingSelfDelete',
                    AccountDeletionRequestedAt=SYSUTCDATETIME(),
                    AccountDeletionDueAt=DATEADD(hour,24,SYSUTCDATETIME()),
                    AccountDeletionReason=@reason,
                    AccountDeletionRating=@rating,
                    UpdatedAt=SYSUTCDATETIME()
                WHERE UserId=@id AND IsActive=1`);
      clearAuthCookie(res);
      return res.json({ pendingDeletion: true, requiresAdminApproval: false, message: 'Your account is inactive and scheduled for deletion in 24 hours. Sign in within 24 hours to recover it.' });
    }

    await pool.request()
      .input('id', sql.Int, req.user.userId)
      .input('reason', sql.NVarChar, encryptValue(feedback || null))
      .input('rating', sql.Int, Number(rating) || null)
      .query(`UPDATE Users
              SET IsActive=0,
                  AccountDeletionStatus='PendingAdminApproval',
                  AccountDeletionRequestedAt=SYSUTCDATETIME(),
                  AccountDeletionDueAt=NULL,
                  AccountDeletionReason=@reason,
                  AccountDeletionRating=@rating,
                  UpdatedAt=SYSUTCDATETIME()
              WHERE UserId=@id AND IsActive=1`);

    for (const group of memberGroups) {
      const existing = await pool.request()
        .input('uid', sql.Int, user.UserId)
        .input('gid', sql.Int, group.GroupId)
        .query(`SELECT TOP 1 RequestId FROM AccountDeletionRequests WHERE UserId=@uid AND GroupId=@gid AND Status='Pending' ORDER BY RequestedAt DESC`);
      const requestId = existing.recordset[0]?.RequestId || (await pool.request()
        .input('uid', sql.Int, user.UserId)
        .input('gid', sql.Int, group.GroupId)
        .input('aid', sql.Int, group.AdminUserId)
        .query(`INSERT INTO AccountDeletionRequests(UserId,GroupId,AdminUserId,Status)
                OUTPUT INSERTED.RequestId
                VALUES(@uid,@gid,@aid,'Pending')`)).recordset[0].RequestId;
      const body = `ACCOUNT_DELETE_REQUEST:${requestId}|${deletionMessageText(user, group.GroupName)}`;
      await pool.request()
        .input('gid', sql.Int, group.GroupId)
        .input('sid', sql.Int, user.UserId)
        .input('rid', sql.Int, group.AdminUserId)
        .input('b', sql.NVarChar, encryptValue(body))
        .query(`INSERT INTO Messages(GroupId,SenderId,RecipientId,Body,IsPrivate) VALUES(@gid,@sid,@rid,@b,1)`);
      await pool.request()
        .input('uid', sql.Int, group.AdminUserId)
        .input('gid', sql.Int, group.GroupId)
        .input('b', sql.NVarChar, `${expectedName} requested account deletion approval for ${group.GroupName}.`)
        .query(`INSERT INTO Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,'AccountDeletionRequest','Account Deletion Request',@b)`);
      await sendPushToUser(pool, sql, group.AdminUserId, { type:'AccountDeletionRequest', title:'Account Deletion Request', body:`${expectedName} requested account deletion approval.`, url:`/group/${group.GroupId}/chat` });
    }

    clearAuthCookie(res);
    res.json({ pendingDeletion: true, requiresAdminApproval: true, message: 'Your account is inactive while group admin approval is requested. If approved, deletion completes 24 hours after approval. Sign in to recover before completion.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Deletion failed' });
  }
}

r.post('/account-deletion-requests/:requestId/accept', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    await finalizeExpiredAccountDeletions(pool);
    const requestId = parseInt(req.params.requestId, 10);
    const request = await pool.request()
      .input('id', sql.Int, requestId)
      .input('admin', sql.Int, req.user.userId)
      .query(`SELECT adr.*,u.FirstName,u.LastName,u.SystemRole,u.IsProtectedAccount,g.GroupName
              FROM AccountDeletionRequests adr
              JOIN Users u ON u.UserId=adr.UserId
              JOIN AjoGroups g ON g.GroupId=adr.GroupId
              WHERE adr.RequestId=@id AND adr.AdminUserId=@admin AND adr.Status='Pending'`);
    const row = request.recordset[0];
    if (!row) return res.status(404).json({ error: 'Deletion request not found' });
    if (row.IsProtectedAccount || row.SystemRole === 'SuperAdmin') {
      return res.status(403).json({ error:'This protected SuperAdmin account cannot be deactivated', code:'PROTECTED_ACCOUNT' });
    }
    await pool.request().input('id', sql.Int, requestId)
      .query(`UPDATE AccountDeletionRequests SET Status='Accepted',RespondedAt=SYSUTCDATETIME() WHERE RequestId=@id`);
    const pending = await pool.request().input('uid', sql.Int, row.UserId)
      .query(`SELECT COUNT(*) AS PendingCount FROM AccountDeletionRequests WHERE UserId=@uid AND Status='Pending'`);
    if (!pending.recordset[0].PendingCount) {
      await pool.request().input('uid', sql.Int, row.UserId)
        .query(`UPDATE Users
                SET IsActive=0,
                    AccountDeletionStatus='Approved',
                    AccountDeletionApprovedAt=SYSUTCDATETIME(),
                    AccountDeletionDueAt=DATEADD(hour,24,SYSUTCDATETIME()),
                    UpdatedAt=SYSUTCDATETIME()
                WHERE UserId=@uid AND AccountDeletionStatus='PendingAdminApproval'`);
    }
    const body = `Your account deletion request for ${row.GroupName} was approved. Your account will be fully deleted after 24 hours unless you sign in to recover it.`;
    await pool.request().input('gid', sql.Int, row.GroupId).input('sid', sql.Int, req.user.userId).input('rid', sql.Int, row.UserId).input('b', sql.NVarChar, encryptValue(body))
      .query(`INSERT INTO Messages(GroupId,SenderId,RecipientId,Body,IsPrivate) VALUES(@gid,@sid,@rid,@b,1)`);
    res.json({ accepted: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not accept deletion request' });
  }
});

r.post('/account-deletion-requests/:requestId/decline', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const requestId = parseInt(req.params.requestId, 10);
    const request = await pool.request()
      .input('id', sql.Int, requestId)
      .input('admin', sql.Int, req.user.userId)
      .query(`SELECT adr.*,u.FirstName,u.LastName,g.GroupName
              FROM AccountDeletionRequests adr
              JOIN Users u ON u.UserId=adr.UserId
              JOIN AjoGroups g ON g.GroupId=adr.GroupId
              WHERE adr.RequestId=@id AND adr.AdminUserId=@admin AND adr.Status='Pending'`);
    const row = request.recordset[0];
    if (!row) return res.status(404).json({ error: 'Deletion request not found' });
    await pool.request().input('id', sql.Int, requestId)
      .query(`UPDATE AccountDeletionRequests SET Status='Declined',RespondedAt=SYSUTCDATETIME(),ResponseNote='Declined by group admin' WHERE RequestId=@id`);
    await pool.request().input('uid', sql.Int, row.UserId)
      .query(`UPDATE Users SET IsActive=1,AccountDeletionStatus='Declined',AccountDeletionDueAt=NULL,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@uid`);
    const body = `Your account deletion request for ${row.GroupName} was declined. Please contact the group admin for clarification before trying again.`;
    await pool.request().input('gid', sql.Int, row.GroupId).input('sid', sql.Int, req.user.userId).input('rid', sql.Int, row.UserId).input('b', sql.NVarChar, encryptValue(body))
      .query(`INSERT INTO Messages(GroupId,SenderId,RecipientId,Body,IsPrivate) VALUES(@gid,@sid,@rid,@b,1)`);
    res.json({ declined: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not decline deletion request' });
  }
});

/* Account deletion */
r.delete('/me', requireAuth, deleteCurrentAccount);
r.post('/me/delete', requireAuth, deleteCurrentAccount);

export default r;






