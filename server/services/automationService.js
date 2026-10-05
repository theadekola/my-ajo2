import { getPool, sql } from '../db.js';
import { encryptValue } from '../utils/fieldCrypto.js';
import { sendPushToUser } from '../utils/push.js';

const DAY_MS=24*60*60*1000;
let running=false;

async function claim(pool,key){
  try {
    await pool.request().input('key',sql.NVarChar,key).query('INSERT INTO AutomationRuns(AutomationKey) VALUES(@key)');
    return true;
  } catch(error){
    if(Number(error?.number)===2627||Number(error?.number)===2601) return false;
    throw error;
  }
}

export async function sendMyAjoAiPrivateMessage(pool,{groupId,senderId,recipientId,body,attachmentUrl=null}){
  await pool.request().input('gid',sql.Int,groupId).input('sid',sql.Int,senderId).input('rid',sql.Int,recipientId)
    .input('body',sql.NVarChar,encryptValue(body)).input('attachment',sql.NVarChar,attachmentUrl)
    .query(`INSERT INTO Messages(GroupId,SenderId,RecipientId,Body,IsPrivate,SenderNameOverride,AttachmentUrl)
            VALUES(@gid,@sid,@rid,@body,1,'My Ajo AI',@attachment)`);
}

function paymentDueOn(group,date){
  const start=new Date(group.StartDate); start.setUTCHours(0,0,0,0);
  if(Number.isNaN(start.getTime())||date<start) return false;
  if(group.Frequency==='Monthly') return date.getUTCDate()===Number(group.PaymentDayOfMonth);
  if(group.Frequency==='Weekly') return date.getUTCDay()===Number(group.PaymentDayOfWeek);
  if(group.Frequency==='Bi-weekly'){
    const firstDue=new Date(start);
    firstDue.setUTCDate(firstDue.getUTCDate()+(Number(group.PaymentDayOfWeek)-firstDue.getUTCDay()+7)%7);
    const days=Math.floor((date-firstDue)/DAY_MS);
    return days>=0&&days%14===0;
  }
  return false;
}

async function sendPaymentReminders(pool,now){
  const today=new Date(now); today.setUTCHours(0,0,0,0);
  const reminderDate=new Date(today); reminderDate.setUTCDate(reminderDate.getUTCDate()+2);
  const groups=await pool.request().query(`SELECT GroupId,GroupName,AdminUserId,Frequency,PaymentDayOfWeek,PaymentDayOfMonth,StartDate,ContributionAmount,CurrencySymbol,CurrentCycle
    FROM AjoGroups WHERE Status='Active' AND (PaymentDayOfWeek IS NOT NULL OR PaymentDayOfMonth IS NOT NULL)`);
  for(const group of groups.recordset){
    const members=await pool.request().input('gid',sql.Int,group.GroupId).input('cycle',sql.Int,group.CurrentCycle||1)
      .query(`SELECT gm.UserId FROM GroupMembers gm
              WHERE gm.GroupId=@gid AND gm.Status='Approved'
                AND NOT EXISTS(SELECT 1 FROM Contributions c WHERE c.GroupId=gm.GroupId AND c.UserId=gm.UserId AND c.CycleNumber=@cycle AND c.Status='Confirmed')`);
    const events=[];
    if(paymentDueOn(group,reminderDate)) events.push({kind:'reminder',date:reminderDate,title:'Payment due in 48 hours',type:'PaymentReminder'});
    if(paymentDueOn(group,today)) events.push({kind:'due',date:today,title:'Payment is due today',type:'PaymentDue'});
    const yesterday=new Date(today); yesterday.setUTCDate(yesterday.getUTCDate()-1);
    if(paymentDueOn(group,yesterday)) events.push({kind:'overdue',date:yesterday,title:'Payment overdue',type:'PaymentOverdue'});
    for(const event of events){
      const dueKey=event.date.toISOString().slice(0,10);
      for(const member of members.recordset){
        if(!await claim(pool,`payment-${event.kind}:${group.GroupId}:${member.UserId}:${group.CurrentCycle||1}:${dueKey}`)) continue;
        const amount=`${group.CurrencySymbol||''}${Number(group.ContributionAmount||0).toLocaleString()}`;
        const formattedDate=event.date.toLocaleDateString('en-GB',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'});
        const body=event.kind==='reminder'
          ? `Payment reminder: your ${amount} contribution for ${group.GroupName} is due on ${formattedDate}. This reminder was sent 48 hours before the payment date.`
          : event.kind==='due'
            ? `Payment due today: your ${amount} contribution for ${group.GroupName} is due today, ${formattedDate}. Please make your payment and submit the payment evidence.`
            : `Payment overdue: your ${amount} contribution for ${group.GroupName}, due on ${formattedDate}, has not been confirmed. Please make the payment and submit evidence, or contact your group admin if you have already paid.`;
        await sendMyAjoAiPrivateMessage(pool,{groupId:group.GroupId,senderId:group.AdminUserId,recipientId:member.UserId,body});
        await pool.request().input('uid',sql.Int,member.UserId).input('gid',sql.Int,group.GroupId).input('body',sql.NVarChar,body).input('type',sql.NVarChar,event.type).input('title',sql.NVarChar,event.title)
          .query('INSERT INTO Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,@type,@title,@body)');
        await sendPushToUser(pool,sql,member.UserId,{type:event.type,title:event.title,body,url:`/group/${group.GroupId}/chat`});
      }
    }
  }
}

async function cleanupMonthlyNotifications(pool,now){
  const tomorrow=new Date(now); tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  if(tomorrow.getUTCDate()!==1||now.getUTCHours()<23) return;
  const month=now.toISOString().slice(0,7);
  if(!await claim(pool,`notification-cleanup:${month}`)) return;
  await pool.request().query('DELETE FROM Notifications');
}

export async function runAutomations(){
  if(running) return;
  running=true;
  try { const pool=await getPool(); const now=new Date(); await sendPaymentReminders(pool,now); await cleanupMonthlyNotifications(pool,now); }
  catch(error){ console.error('Scheduled automation failed',error?.message||error); }
  finally { running=false; }
}

export function startAutomations(){
  runAutomations();
  const timer=setInterval(runAutomations,15*60*1000); timer.unref();
}
