import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'b'.repeat(64);
process.env.OTP_PEPPER = 'c'.repeat(64);
process.env.AUTH_COOKIE_SECURE = 'true';
process.env.MFA_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.NODE_ENV = 'test';

const { csrfProtection, issueCsrfToken, requireAuth, requirePendingAuth, setAuthCookie, setAuthUserLoaderForTests } = await import('../middleware.js');
setAuthUserLoaderForTests(async claims=>({
  UserId:claims.userId,Email:claims.email,FirstName:'Ajo',LastName:'Member',SystemRole:claims.systemRole,
  OrganizerStatus:'NotApplied',CanCreateGroups:0,MfaEnabled:0,TokenVersion:claims.tokenVersion,
  IsActive:1,IsEmailVerified:claims.isEmailVerified,OnboardingDone:claims.onboardingDone,LockedUntil:null
}));

function response() {
  const headers = new Map();
  return {
    statusCode:200,
    body:null,
    append(name,value) { headers.set(name,[...(headers.get(name)||[]),value]); },
    setHeader(name,value) { headers.set(name,value); },
    status(code) { this.statusCode=code; return this; },
    json(value) { this.body=value; return this; },
    headers,
  };
}

const user = { UserId:7, Email:'member@example.com', FirstName:'Ajo', LastName:'Member', SystemRole:'Member' };

test('authentication cookie is HttpOnly, Secure and SameSite=None for native clients', () => {
  const res=response();
  setAuthCookie(res,user);
  const cookie=res.headers.get('Set-Cookie')[0];
  assert.match(cookie,/^__Host-myajo_session=/);
  assert.match(cookie,/HttpOnly/);
  assert.match(cookie,/Secure/);
  assert.match(cookie,/SameSite=None/);
  assert.match(cookie,/Max-Age=3600/);
});

test('cookie authenticates while a bearer header alone does not', async () => {
  const issued=response();
  setAuthCookie(issued,user);
  const pair=issued.headers.get('Set-Cookie')[0].split(';')[0];
  const accepted=response();
  let nextCalled=false;
  await requireAuth({headers:{cookie:pair}},accepted,()=>{ nextCalled=true; });
  assert.equal(nextCalled,true);

  const rejected=response();
  await requireAuth({headers:{authorization:'Bearer ignored'}},rejected,()=>{});
  assert.equal(rejected.statusCode,401);
});

test('incomplete social accounts can only access onboarding authentication routes', async () => {
  const issued=response();
  setAuthCookie(issued,{ ...user, OnboardingDone:0 });
  const pair=issued.headers.get('Set-Cookie')[0].split(';')[0];

  const protectedResponse=response();
  let protectedNext=false;
  await requireAuth({headers:{cookie:pair}},protectedResponse,()=>{ protectedNext=true; });
  assert.equal(protectedNext,false);
  assert.equal(protectedResponse.statusCode,403);
  assert.equal(protectedResponse.body.code,'ONBOARDING_REQUIRED');

  const onboardingResponse=response();
  let onboardingNext=false;
  await requirePendingAuth({headers:{cookie:pair}},onboardingResponse,()=>{ onboardingNext=true; });
  assert.equal(onboardingNext,true);
});

test('cookie-authenticated mutations require a matching CSRF token and trusted origin', () => {
  const issued=response();
  setAuthCookie(issued,user);
  issueCsrfToken(issued);
  const pairs=issued.headers.get('Set-Cookie').map(cookie=>cookie.split(';')[0]);
  const csrfPair=pairs.find(pair=>pair.startsWith('__Host-myajo_csrf='));
  const csrfToken=decodeURIComponent(csrfPair.split('=')[1]);
  const protect=csrfProtection(['https://www.my-ajo.org']);

  const accepted=response();
  let nextCalled=false;
  protect({
    method:'POST', originalUrl:'/api/groups', headers:{cookie:pairs.join('; ')},
    get:name=>({origin:'https://www.my-ajo.org','x-csrf-token':csrfToken}[name.toLowerCase()] || '')
  },accepted,()=>{ nextCalled=true; });
  assert.equal(nextCalled,true);

  const rejected=response();
  protect({
    method:'DELETE', originalUrl:'/api/users/me', headers:{cookie:pairs.join('; ')},
    get:name=>({origin:'https://evil.example','x-csrf-token':csrfToken}[name.toLowerCase()] || '')
  },rejected,()=>{});
  assert.equal(rejected.statusCode,403);
  assert.equal(rejected.body.code,'CSRF_ORIGIN_REJECTED');
});

test('Paystack webhooks and bearer-authenticated native mutations bypass browser CSRF cookies', () => {
  const protect=csrfProtection(['https://www.my-ajo.org']);
  for (const request of [
    {method:'POST',originalUrl:'/api/paystack/webhook',headers:{},get:()=>''},
    {method:'POST',originalUrl:'/api/groups',headers:{authorization:'Bearer native-token'},get:()=>''}
  ]) {
    let nextCalled=false;
    protect(request,response(),()=>{ nextCalled=true; });
    assert.equal(nextCalled,true);
  }
});
