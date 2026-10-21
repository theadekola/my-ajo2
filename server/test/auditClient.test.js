import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { nativeBackRoute,routeFromUrl } from '../../client/src/utils/appRoutes.js';
import { dayKey,mergePayoutDates,upcomingPayouts } from '../../client/src/utils/calendarEvents.js';
import { fetchWithDeadline } from '../../client/src/utils/request.js';
process.env.NODE_ENV='test';process.env.JWT_SECRET='b'.repeat(64);process.env.OTP_PEPPER='c'.repeat(64);process.env.MFA_ENCRYPTION_KEY='a'.repeat(64);
const {validateGroup,dateOnly}=await import('../utils/operations.js');
const {requiredPermission}=await import('../utils/adminAccess.js');
test('native back resolves hash routes, nested history and primary tab dashboard fallback',()=>{
  assert.equal(nativeBackRoute('#/group/2/pay',true),'back');assert.equal(nativeBackRoute('#/groups',true),'/dashboard');assert.equal(nativeBackRoute('#/dashboard',true),'minimize');assert.equal(nativeBackRoute('#/group/2',false),'/dashboard');
});
test('push destinations stay local and preserve both legacy and hash routes',()=>{
  const origin='https://my-ajo.org';assert.equal(routeFromUrl('/group/2/chat',origin),'/group/2/chat');assert.equal(routeFromUrl('/#/invite/CODE',origin),'/invite/CODE');assert.equal(routeFromUrl('https://other.example/path',origin),'/notifications');assert.equal(routeFromUrl('javascript:alert(1)',origin),'/notifications');
});
test('calendar merges assigned dates without repeating a recorded payout and includes today unpaid',()=>{
  const assigned={GroupId:2,RecipientId:7,CycleNumber:1,Status:'Assigned',ScheduledFor:'2026-10-21'};
  const paid={...assigned,Status:'Paid'};
  assert.equal(mergePayoutDates([paid],[assigned]).length,1);
  assert.deepEqual(upcomingPayouts([paid,assigned,{...assigned,ScheduledFor:'2026-10-20'}],'2026-10-21'),[assigned]);assert.equal(dayKey('2026-10-21T00:00:00.000Z'),'2026-10-21');
});
test('group input accepts only implemented order and bounded schedules and amounts',()=>{
  const input={groupName:'Family',contributionAmount:100,maxMembers:10,startDate:'2026-10-21',frequency:'Weekly',paymentDayOfWeek:1,payoutOrder:'Fixed'};
  assert.doesNotThrow(()=>validateGroup(input));for(const change of [{contributionAmount:-1},{maxMembers:2.2},{maxMembers:201},{paymentDayOfWeek:7},{payoutOrder:'Bidding'},{startDate:'2026-02-31'}])assert.throws(()=>validateGroup({...input,...change}));assert.equal(dateOnly('2026-02-31'),false);
});
test('permission policy does not turn ordinary administrators into platform owners',()=>{
  assert.equal(requiredPermission('/users/2/action','POST'),'Manage users');assert.equal(requiredPermission('/administrators','POST'),'SuperAdmin');assert.equal(requiredPermission('/groups/2/action','POST'),'Suspend groups');assert.equal(requiredPermission('/reports','GET'),'Handle support tickets');
});
test('deadline remains active while reading a stalled response body',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(_url,{signal})=>({text:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))});
  try{await assert.rejects(fetchWithDeadline('https://test.invalid',{},res=>res.text(),10),/server did not respond/);}finally{globalThis.fetch=original;}
});
test('API refreshes a rejected CSRF token once and retains error payload metadata',async()=>{
  let source=await fs.readFile(new URL('../../client/src/api/appClient.js',import.meta.url),'utf8');
  const requestUrl=new URL('../../client/src/utils/request.js',import.meta.url).href;
  source=source.replace("'../utils/request.js'",JSON.stringify(requestUrl)).replace('import.meta.env.VITE_API_BASE_URL',"''");
  const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const original=globalThis.fetch;let csrf=0,posts=0;
  globalThis.fetch=async(url,options)=>{
    if(url==='/api/csrf')return new Response(JSON.stringify({csrfToken:'token-'+(++csrf)}));
    posts++;return posts===1?new Response(JSON.stringify({code:'CSRF_TOKEN_INVALID',error:'Expired'}),{status:403}):new Response(JSON.stringify({ok:true}));
  };
  try{assert.deepEqual(await api.apiPost('/groups',{}),{ok:true});assert.equal(csrf,2);assert.equal(posts,2);api.resetApiSecurity();await api.apiPost('/groups',{});assert.equal(csrf,3);}finally{globalThis.fetch=original;}
});
