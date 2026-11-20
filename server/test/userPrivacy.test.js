import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {readFile} from 'node:fs/promises';
register('./fixtures/db-loader.mjs',import.meta.url);
process.env.NODE_ENV='test';process.env.JWT_SECRET='b'.repeat(64);process.env.OTP_PEPPER='c'.repeat(64);process.env.MFA_ENCRYPTION_KEY='a'.repeat(64);
const {configureDatabase}=await import('./fixtures/mockDatabase.mjs');
const {requireAuth}=await import('../middleware.js');
const {sessionUser}=await import('../utils/userResponses.js');
const auth=(await import('../routes/auth.js')).default;
const users=(await import('../routes/users.js')).default;
const record={UserId:7,FirstName:'Test',LastName:'Member',Email:'private@example.invalid',Phone:'private-phone',
 Address:'private-address',DateOfBirth:'2000-01-01',Occupation:'Private occupation',BankName:'Private bank',BankAccountNumber:'123456789',
 SystemRole:'SuperAdmin',IsProtectedAccount:1,MfaEnabled:1,MfaVerifiedAt:'2026-11-20T00:00:00Z',IsEmailVerified:1,
 PasswordHash:'secret',MfaSecret:'secret',MfaRecoveryCodes:'secret',NewSensitiveColumn:'future-secret'};
function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function route(path){return auth.stack.find(layer=>layer.route?.path===path&&layer.route.methods.get).route;}
test('session response excludes contact, bank, internal and future columns while preserving MFA navigation',()=>{
 const result=sessionUser(record);
 for(const key of ['Email','Phone','Address','DateOfBirth','Occupation','BankName','BankAccountNumber','SystemRole','IsProtectedAccount','PasswordHash','MfaSecret','MfaRecoveryCodes','NewSensitiveColumn'])assert.equal(key in result,false,key);
 assert.equal(result.Capabilities.canAccessAdmin,true);assert.equal(result.Capabilities.canDeleteAccount,false);
 assert.equal(result.MfaVerifiedAt,record.MfaVerifiedAt);
 assert.deepEqual(sessionUser({...record,SystemRole:'Member',IsProtectedAccount:0}).Capabilities,{canAccessAdmin:false,canDeleteAccount:true});
});
test('default /me does not return private fields even if the database returns extra columns',async()=>{
 configureDatabase({query:async(sql,values)=>{assert.equal(values.id,7);assert.doesNotMatch(sql,/BankAccountNumber|DateOfBirth|Occupation/);return {recordset:[record]};}});
 const res=response();await route('/me').stack.at(-1).handle({user:{userId:7}},res);
 assert.deepEqual(res.body,sessionUser(record));
});
test('private account endpoints use the authenticated user ID and disjoint allowlists',async()=>{
 for(const [path,expected,excluded] of [['/me/profile','Email','BankAccountNumber'],['/me/bank-details','BankAccountNumber','Email']]){
  const target=route(path);assert.equal(target.stack[0].handle,requireAuth);
  configureDatabase({query:async(sql,values)=>{assert.equal(values.id,7);assert.match(sql,/WHERE UserId=@id/);return {recordset:[record]};}});
  const res=response();await target.stack.at(-1).handle({user:{userId:7},query:{userId:999}},res);
  assert.equal(res.body[expected],record[expected]);assert.equal(excluded in res.body,false);assert.equal('MfaSecret' in res.body,false);
 }
});
test('editing a profile does not overwrite separate bank details',async()=>{
 let statement='';configureDatabase({query:async sql=>{statement=sql;return {recordset:[{ProfileEditedAt:'2026-11-20'}]};}});
 const handler=users.stack.find(layer=>layer.route?.path==='/me'&&layer.route.methods.put).route.stack.at(-1).handle;
 const res=response();await handler({user:{userId:7},body:{firstName:'Test',lastName:'Member',title:'Mr',phone:'123',sex:'Male',address:'Address',occupation:'Teacher'}},res);
 assert.equal(res.statusCode,200);assert.doesNotMatch(statement,/BankAccountNumber\s*=/);
});
test('authenticated app neither loads analytics nor permits its collection destinations',async()=>{
 const html=await readFile(new URL('../../client/index.html',import.meta.url),'utf8');
 const analytics=await readFile(new URL('../../client/public/analytics.js',import.meta.url),'utf8');
 const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
 assert.doesNotMatch(html,/googletagmanager|analytics\.js/);assert.doesNotMatch(analytics,/gtag\(|dataLayer/);
 assert.doesNotMatch(server,/google-analytics\.com|analytics\.google\.com|googletagmanager/);
});

test('successful password login returns the allowlisted session rather than the database record',async()=>{
 const bcrypt=(await import('bcryptjs')).default;
 const account={...record,IsActive:1,MfaEnabled:0,PasswordHash:await bcrypt.hash('test-password',12)};
 configureDatabase({query:async sql=>({recordset:sql.includes('SELECT * FROM Users WHERE Email=@e')?[{...account}]:[],rowsAffected:[1]})});
 const handler=auth.stack.find(layer=>layer.route?.path==='/login').route.stack.at(-1).handle;
 const res={...response(),append(){},setHeader(){}};
 await handler({body:{email:account.Email,password:'test-password'},ip:'127.0.0.1'},res);
 assert.equal(res.statusCode,200);assert.ok(res.body.user);
 assert.equal('Email' in res.body.user,false);assert.equal('BankAccountNumber' in res.body.user,false);
 assert.equal('SystemRole' in res.body.user,false);assert.equal('NewSensitiveColumn' in res.body.user,false);
});
