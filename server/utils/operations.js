import { sql } from '../db.js';
export function fail(status, message, code) { return Object.assign(new Error(message), { status, code }); }
export function positiveInt(value) { const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null; }
export function dateOnly(value) { return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value; }
export function validateGroup(body) {
  if(typeof body.groupName!=='string'||!body.groupName.trim()||body.groupName.length>100) throw fail(400,'Enter a group name of 1 to 100 characters');
  if(!Number.isFinite(Number(body.contributionAmount))||Number(body.contributionAmount)<=0||Number(body.contributionAmount)>999999999) throw fail(400,'Enter a positive contribution amount');
  if(!positiveInt(body.maxMembers??10)||Number(body.maxMembers??10)<2||Number(body.maxMembers??10)>200) throw fail(400,'Choose between 2 and 200 members');
  if(!['Weekly','Monthly'].includes(body.frequency||'Monthly')) throw fail(400,'Frequency must be Weekly or Monthly');
  if((body.payoutOrder||'Fixed')!=='Fixed') throw fail(400,'Only fixed payout order is available');
  if(!dateOnly(body.startDate)) throw fail(400,'Choose a valid start date');
  const day=Number((body.frequency||'Monthly')==='Weekly'?body.paymentDayOfWeek:body.paymentDayOfMonth);
  if(!Number.isInteger(day)||day<((body.frequency||'Monthly')==='Weekly'?0:1)||day>((body.frequency||'Monthly')==='Weekly'?6:28)) throw fail(400,'Choose a valid payment day');
}
export async function withTransaction(pool, operation) {
  const transaction=new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const connection={request:()=>new sql.Request(transaction)};
  try { const value=await operation(connection);await transaction.commit();return value; }
  catch(error){if(!transaction._aborted)await transaction.rollback().catch(()=>{});throw error;}
}
