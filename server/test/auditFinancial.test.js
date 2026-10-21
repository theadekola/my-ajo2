import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./fixtures/db-loader.mjs',import.meta.url);
process.env.NODE_ENV='test';process.env.JWT_SECRET='b'.repeat(64);process.env.OTP_PEPPER='c'.repeat(64);process.env.MFA_ENCRYPTION_KEY='a'.repeat(64);
const {configureDatabase}=await import('./fixtures/mockDatabase.mjs');
const contributions=(await import('../routes/contributions.js')).default;
const payouts=(await import('../routes/payouts.js')).default;
function handler(router,path,method){return router.stack.find(layer=>layer.route?.path===path&&layer.route.methods[method]).route.stack.at(-1).handle;}
function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
async function invoke(fn,body,params={id:'1'}){const res=response();await fn({body,params,user:{userId:3}},res,error=>{throw error;});return res;}
function database({notificationFailure=false}={}){
  let state={contribution:'Pending',payouts:[],notifications:[],messages:[],outbox:[]},snapshot;
  configureDatabase({begin(){snapshot=structuredClone(state);},commit(){snapshot=null;},rollback(){state=snapshot;},async query(text,v){
    let rows=[];
    if(/SELECT gm.Role FROM Contributions/.test(text))rows=[{Role:'Admin'}];
    else if(/UPDATE Contributions SET Status=/.test(text)){
      if(!/Status='Pending'/.test(text)||state.contribution==='Pending'){state.contribution=v.status;rows=[{UserId:7,GroupId:2,Amount:100}];}
    }else if(/SELECT gm.Role,g.CurrentCycle,g.Status/.test(text))rows=[{Role:'Admin',CurrentCycle:1,Status:'Active'}];
    else if(/SELECT PayoutId,RequestHash/.test(text))rows=state.payouts.filter(row=>row.RequestKey===v.key);
    else if(/SELECT PayoutId FROM Payouts/.test(text))rows=state.payouts.filter(row=>row.GroupId===v.gid&&row.CycleNumber===v.cycle);
    else if(/SELECT TOP 1 gm.UserId/.test(text))rows=[{UserId:7}];
    else if(/SELECT u.BankName/.test(text))rows=[{BankName:'Test bank',BankAccountNumber:'1234567890',BankAccountName:'Member',HasReceived:false}];
    else if(/INSERT INTO Payouts/.test(text)){
      const row={PayoutId:state.payouts.length+1,RequestKey:v.key,RequestHash:v.hash,GroupId:v.gid,CycleNumber:v.cy,Status:v.instant?'Paid':'Scheduled'};
      state.payouts.push(row);rows=[{PayoutId:row.PayoutId}];
    }else if(/INSERT (?:INTO )?Notifications/.test(text)){
      if(notificationFailure)throw new Error('Injected notification storage failure');
      state.notifications.push(v);
    }else if(/INSERT INTO Messages/.test(text))state.messages.push(v);
    else if(/INSERT dbo.PushOutbox/.test(text))state.outbox.push(v);
    else if(/SELECT gm.Role FROM Payouts/.test(text))rows=[{Role:'Admin'}];
    else if(/UPDATE Payouts SET Status='Paid'/.test(text)){
      const row=state.payouts.find(row=>row.PayoutId===v.id&&row.Status==='Scheduled');
      if(row){row.Status='Paid';rows=[{...row,RecipientId:7,TotalPayout:100}];}
    }
    return {recordset:rows,recordsets:[rows],rowsAffected:[rows.length]};
  }});
  return ()=>state;
}
const body={groupId:2,recipientId:7,cycleNumber:1,amount:100,adminCharge:0,scheduledFor:'2026-10-25',instant:false,requestKey:'payout_test_request_123'};
test('review changes a pending contribution once and rejects repeated or conflicting actions',async()=>{
  const state=database();const confirm=handler(contributions,'/:id/confirm','put');const reject=handler(contributions,'/:id/reject','put');
  assert.equal((await invoke(confirm,{})).statusCode,200);
  assert.equal((await invoke(confirm,{})).statusCode,409);
  assert.equal((await invoke(reject,{})).statusCode,409);
  assert.equal(state().contribution,'Confirmed');assert.equal(state().notifications.length,1);assert.equal(state().outbox.length,1);
});
test('failed durable notification rolls contribution review back',async()=>{
  const state=database({notificationFailure:true});
  await assert.rejects(invoke(handler(contributions,'/:id/confirm','put'),{}),/Injected/);
  assert.equal(state().contribution,'Pending');assert.equal(state().notifications.length,0);
});
test('a payout retry returns its original record without extra notification or message',async()=>{
  const state=database();const create=handler(payouts,'/','post');
  const first=await invoke(create,body);const retry=await invoke(create,body);
  assert.equal(first.statusCode,201);assert.equal(retry.statusCode,200);assert.equal(retry.body.replayed,true);assert.equal(first.body.PayoutId,retry.body.PayoutId);
  assert.equal(state().payouts.length,1);assert.equal(state().notifications.length,1);assert.equal(state().messages.length,1);assert.equal(state().outbox.length,1);
  assert.equal((await invoke(create,{...body,amount:200})).statusCode,409);
});
test('a notification failure rolls payout creation back before a retry',async()=>{
  const state=database({notificationFailure:true});
  await assert.rejects(invoke(handler(payouts,'/','post'),body),/Injected/);
  assert.equal(state().payouts.length,0);assert.equal(state().messages.length,0);
});
test('a second request key cannot create a second payout for the same cycle',async()=>{
  const state=database();const create=handler(payouts,'/','post');await invoke(create,body);
  assert.equal((await invoke(create,{...body,requestKey:'another_request_key_123'})).statusCode,409);assert.equal(state().payouts.length,1);
});
test('marking paid is atomic and a repeated call cannot create extra notifications',async()=>{
  const state=database();await invoke(handler(payouts,'/','post'),body);
  const paid=handler(payouts,'/:id/paid','put');assert.equal((await invoke(paid,{})).statusCode,200);assert.equal((await invoke(paid,{})).statusCode,409);
  assert.equal(state().payouts[0].Status,'Paid');assert.equal(state().notifications.length,2);
});
test('invalid payout date, amount, cycle and missing request key are rejected before writes',async()=>{
  const state=database();for(const change of [{scheduledFor:'2026-02-31'},{amount:-1},{adminCharge:-1},{cycleNumber:1.5},{requestKey:''}])assert.equal((await invoke(handler(payouts,'/','post'),{...body,...change})).statusCode,400);
  assert.equal(state().payouts.length,0);
});
