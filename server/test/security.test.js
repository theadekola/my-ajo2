import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'b'.repeat(64);
process.env.OTP_PEPPER = 'c'.repeat(64);
process.env.MFA_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.MFA_ENCRYPTION_KEY_VERSION = '1';

const { decryptMfaValue, decryptValue, encryptMfaValue, encryptValue, hashOtp } = await import('../utils/fieldCrypto.js');
const { validateFileBuffer,requireAuth,requireMfa,requireSuperAdmin,setAuthUserLoaderForTests,signToken } = await import('../middleware.js');
const { AUTH_COOKIE_NAME } = await import('../config.js');

test('verified SuperAdmin MFA session reaches the protected overview',async()=>{
  setAuthUserLoaderForTests(async()=>({UserId:2,Email:'owner@example.test',FirstName:'Owner',LastName:'Admin',SystemRole:'SuperAdmin',IsProtectedAccount:true,MfaEnabled:true,TokenVersion:3,IsActive:true,IsEmailVerified:true,OnboardingDone:true,LockedUntil:null}));
  const token=signToken({UserId:2,Email:'owner@example.test',FirstName:'Owner',LastName:'Admin',SystemRole:'SuperAdmin',TokenVersion:3,IsEmailVerified:true,OnboardingDone:true,MfaVerified:true,MfaVerifiedAt:new Date().toISOString()});
  const req={headers:{cookie:`${AUTH_COOKIE_NAME}=${token}`},socket:{},get:()=>'',originalUrl:'/api/system-admin/overview'};
  let responseStatus=200;const res={status(code){responseStatus=code;return this;},json(){return this;}};
  await new Promise(resolve=>requireAuth(req,res,resolve));
  requireMfa(req,res,()=>requireSuperAdmin(req,res,()=>{}));
  assert.equal(responseStatus,200);
  assert.equal(req.user.mfaVerified,true);
});

test('ordinary database field values are stored as plaintext', () => {
  const first = encryptValue('12345678');
  assert.equal(first, '12345678');
  assert.equal(decryptValue(first), '12345678');
});

test('MFA secrets retain randomized authenticated encryption', () => {
  const first = encryptMfaValue('JBSWY3DPEHPK3PXP');
  const second = encryptMfaValue('JBSWY3DPEHPK3PXP');
  assert.match(first, /^enc:v1:/);
  assert.notEqual(first, second);
  assert.equal(decryptMfaValue(first), 'JBSWY3DPEHPK3PXP');
  assert.throws(() => decryptMfaValue('plaintext-secret'));
});

test('OTP hashes are stable, scoped, and do not expose the code', () => {
  const value = hashOtp('user@example.com', 'PasswordReset', '123456');
  assert.equal(value.length, 64);
  assert.equal(value, hashOtp('USER@example.com', 'PasswordReset', '123456'));
  assert.notEqual(value, hashOtp('user@example.com', 'EmailVerify', '123456'));
  assert.ok(!value.includes('123456'));
});

test('web authentication does not return or persist bearer tokens', () => {
  const authRoute = fs.readFileSync(new URL('../routes/auth.js', import.meta.url), 'utf8');
  const webClient = fs.readFileSync(new URL('../../client/src/api/appClient.js', import.meta.url), 'utf8');
  assert.doesNotMatch(authRoute, /token\s*:\s*signToken/);
  assert.doesNotMatch(webClient, /localStorage\.setItem/);
  assert.doesNotMatch(webClient, /headers\.Authorization/);
});

test('OTP verification is hashed-only and registration uses expiring tickets', () => {
  const authRoute = fs.readFileSync(new URL('../routes/auth.js', import.meta.url), 'utf8');
  const migration = fs.readFileSync(new URL('../../database/migrations/006_otp_registration_tickets.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(authRoute, /Code\s+IN\s*\(/i);
  assert.doesNotMatch(authRoute, /@legacy/i);
  assert.match(authRoute, /FailedAttempts/);
  assert.match(authRoute, /DATEADD\(MINUTE,10,SYSUTCDATETIME\(\)\)/);
  assert.match(migration, /CREATE TABLE dbo\.RegistrationTickets/);
  assert.match(migration, /UPDATE dbo\.OtpCodes SET UsedAt=COALESCE/);
});

test('upload validation requires a matching file signature', () => {
  const png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const fake=Buffer.from('<script>alert(1)</script>');
  assert.equal(validateFileBuffer(png,'.png'),true);
  assert.equal(validateFileBuffer(fake,'.png'),false);
  assert.equal(validateFileBuffer(Buffer.from('%PDF-1.7'),'.pdf',{profileOnly:true}),false);
});

test('financial uploads are not exposed by a public static directory', () => {
  const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
  const files=fs.readFileSync(new URL('../routes/privateFiles.js',import.meta.url),'utf8');
  assert.doesNotMatch(server,/app\.use\('\/uploads',\s*express\.static/);
  assert.match(server,/app\.use\('\/api\/private-files'/);
  assert.match(files,/c\.UserId=@uid OR viewer\.Role='Admin'/);
  assert.match(files,/p\.RecipientId=@uid OR viewer\.Role='Admin'/);
});

test('Paystack confirmation decrypts a stored note before re-encrypting it once',()=>{
  const route=fs.readFileSync(new URL('../routes/paystack.js',import.meta.url),'utf8');
  assert.match(route,/const contributionNote = row\.Note \? decryptValue\(row\.Note\) : null/);
  assert.match(route,/contributionNote \? encryptValue\(contributionNote\) : null/);
  assert.doesNotMatch(route,/encryptValue\(row\.Note/);
});

test('payout creation validates group recipient and paid transition is idempotent',()=>{
  const route=fs.readFileSync(new URL('../routes/payouts.js',import.meta.url),'utf8');
  assert.match(route,/GroupId=@gid AND UserId=@rid AND Status='Approved'/);
  assert.match(route,/WHERE PayoutId=@id AND Status='Scheduled'/);
  assert.match(route,/if\(!updated\.recordset\[0\]\)/);
});

test('authenticated requests validate live account state and token version',()=>{
  const middleware=fs.readFileSync(new URL('../middleware.js',import.meta.url),'utf8');
  assert.match(middleware,/FROM dbo\.Users WHERE UserId=@uid/);
  assert.match(middleware,/Number\(user\.TokenVersion\) !== Number\(claims\.tokenVersion\)/);
  assert.match(middleware,/!user\.IsActive/);
  assert.match(middleware,/user\.LockedUntil/);
});

test('ordinary auth allows a SuperAdmin member session while privileged routes require MFA',()=>{
  const middleware=fs.readFileSync(new URL('../middleware.js',import.meta.url),'utf8');
  const requireAuthBlock=middleware.slice(middleware.indexOf('export function requireAuth'),middleware.indexOf('export function requireAdmin'));
  const systemAdmin=fs.readFileSync(new URL('../routes/systemAdmin.js',import.meta.url),'utf8');
  assert.doesNotMatch(requireAuthBlock,/MFA_REQUIRED|MFA_ENROLLMENT_REQUIRED/);
  assert.match(systemAdmin,/r\.use\(requireAuth,requireVerifiedEmail,requireMfa,requireSuperAdmin\)/);
});

test('SuperAdmin login defers MFA until an explicit administration switch',()=>{
  const auth=fs.readFileSync(new URL('../routes/auth.js',import.meta.url),'utf8');
  assert.match(auth,/user\.MfaEnabled && user\.SystemRole !== 'SuperAdmin'/);
  assert.match(auth,/r\.post\('\/mfa\/admin\/challenge', requireAuth/);
  assert.match(auth,/purpose:'mfa-admin-switch'/);
  assert.match(auth,/\['mfa-login','mfa-admin-switch'\]\.includes\(claims\.purpose\)/);
});

test('group membership and group creation use transactional protections',()=>{
  const groups=fs.readFileSync(new URL('../routes/groups.js',import.meta.url),'utf8');
  const migration=fs.readFileSync(new URL('../../database/migrations/007_mfa_and_group_concurrency.sql',import.meta.url),'utf8');
  assert.match(groups,/new sql\.Transaction\(pool\)/);
  assert.match(migration,/SERIALIZABLE/);
  assert.match(migration,/UQ_GroupSlot/);
  assert.match(migration,/@MemberCount>=@MaxMembers/);
  assert.match(migration,/UsageCount=UsageCount\+1/);
});

test('production database configuration has no sa or internal-IP fallback',()=>{
  const db=fs.readFileSync(new URL('../db.js',import.meta.url),'utf8');
  assert.doesNotMatch(db,/192\.168\.10\.101/);
  assert.doesNotMatch(db,/production \? undefined : 'sa'/);
  assert.match(db,/restricted application account, not sa/);
});

test('protected SuperAdmin accounts are enforced by database, API, and UI',()=>{
  const migration=fs.readFileSync(new URL('../../database/migrations/008_protected_superadmin.sql',import.meta.url),'utf8');
  const auth=fs.readFileSync(new URL('../routes/auth.js',import.meta.url),'utf8');
  const help=fs.readFileSync(new URL('../../client/src/pages/Help.jsx',import.meta.url),'utf8');
  assert.match(migration,/TR_Users_ProtectSystemAccount/);
  assert.match(migration,/i\.SystemRole<>'SuperAdmin'/);
  assert.match(migration,/i\.IsActive=0/);
  assert.match(auth,/code: 'PROTECTED_ACCOUNT'/);
  assert.match(auth,/SystemRole,IsProtectedAccount/);
  assert.match(help,/canDeleteAccount && showDelete/);
  assert.match(help,/Protected SuperAdmin account/);
});

test('system administration API requires live SuperAdmin and MFA middleware',()=>{
  const route=fs.readFileSync(new URL('../routes/systemAdmin.js',import.meta.url),'utf8');
  const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(route,/requireAuth,requireVerifiedEmail,requireMfa,requireSuperAdmin/);
  assert.match(route,/Monitoring only/);
  assert.match(route,/Secrets, encryption keys and credentials are never exposed/);
  assert.match(server,/app\.use\('\/api\/system-admin', systemAdminRoutes\)/);
  assert.match(route,/target\.IsProtectedAccount/);
  assert.match(route,/verifyTotp\(decryptMfaValue\(actor\.MfaSecret\)/);
  assert.match(route,/INSERT dbo\.AdminAuditLog/);
});

test('SuperAdmin MFA enrolment is reachable before MFA and requires password confirmation',()=>{
  const auth=fs.readFileSync(new URL('../routes/auth.js',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../../client/src/pages/SuperAdminMfaSetup.jsx',import.meta.url),'utf8');
  const dashboard=fs.readFileSync(new URL('../../client/src/pages/SystemAdmin.jsx',import.meta.url),'utf8');
  assert.match(auth,/r\.post\('\/mfa\/setup', requirePendingAuth/);
  assert.match(auth,/bcrypt\.compare\(String\(req\.body\?\.password/);
  assert.match(auth,/MfaPendingSecret=@secret/);
  assert.match(auth,/MfaEnabled=1/);
  assert.match(page,/Download codes/);
  assert.match(page,/refreshUser/);
  assert.match(dashboard,/if\(!mfaReady\)/);
  assert.doesNotMatch(auth,/UPDATE\s+(?:dbo\.)?Users[\s\S]{0,500}?OUTPUT INSERTED/i);
});

test('SuperAdmin operational controls are audited and exclude money-management actions',()=>{
  const route=fs.readFileSync(new URL('../routes/systemAdmin.js',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../../client/src/pages/SystemAdmin.jsx',import.meta.url),'utf8');
  const migration=fs.readFileSync(new URL('../../database/migrations/010_admin_investigations_support.sql',import.meta.url),'utf8');
  assert.match(route,/Only the protected SuperAdmin can appoint administrators/);
  assert.match(route,/new sql\.Transaction\(pool\)/);
  assert.match(route,/TransactionInvestigations/);
  assert.match(route,/SupportTickets/);
  assert.match(route,/AdminAuditLog ORDER BY CreatedAt DESC/);
  assert.match(page,/Create Admin/);
  assert.match(page,/Flag for investigation/);
  assert.doesNotMatch(page,/Assign investigator|Assign ticket|Record response|Request evidence|Retry failed webhook processing/);
  assert.match(page,/exportRows\(rows,config\.title,format\)/);
  assert.match(page,/View audit details/);
  assert.match(page,/Copy request ID/);
  assert.match(page,/config\.endpoint==='security'&&row\.SystemRole==='SuperAdmin'/);
  assert.doesNotMatch(page,/Send money|Release payout|Change recipient|Manually create a successful payment/);
  assert.match(migration,/AdminPermissions/);
  assert.match(migration,/RequestId UNIQUEIDENTIFIER/);
});

test('admin API requests fail visibly instead of loading forever',()=>{
  const client=fs.readFileSync(new URL('../../client/src/api/appClient.js',import.meta.url),'utf8');
  const detail=fs.readFileSync(new URL('../../client/src/pages/SystemAdminUserDetail.jsx',import.meta.url),'utf8');
  assert.match(client,/server did not respond within 20 seconds/);
  assert.match(client,/Could not establish request security: server timeout/);
  assert.match(detail,/Retry loading user/);
});

test('SuperAdmin navigation can be closed and reopened accessibly',()=>{
  const layout=fs.readFileSync(new URL('../../client/src/components/SuperAdminLayout.jsx',import.meta.url),'utf8');
  const styles=fs.readFileSync(new URL('../../client/src/styles.css',import.meta.url),'utf8');
  assert.match(layout,/aria-label="Close Super Admin navigation"/);
  assert.match(layout,/aria-label="Open Super Admin navigation"/);
  assert.match(layout,/sa-nav-collapsed/);
  assert.match(styles,/\.sa-shell\.sa-nav-collapsed/);
});
