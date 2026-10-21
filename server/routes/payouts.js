import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { withTransaction, fail, positiveInt, dateOnly } from '../utils/operations.js';
import { enqueuePush, deliverPushOutbox } from '../services/pushOutbox.js';
// payouts.js
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth, requireMfa } from '../middleware.js';
import { sendPushToUser } from '../utils/push.js';
import { decryptRecord, decryptValue, encryptValue } from '../utils/fieldCrypto.js';
import { financialUpload, validateUploadedFile } from '../middleware.js';
import { cacheDeletePattern } from '../services/redisService.js';
import { sendMyAjoAiPrivateMessage } from '../services/automationService.js';
const r = Router();
r.use(requireAuth);
r.use((req,res,next)=>{ if(['POST','PUT','PATCH','DELETE'].includes(req.method)) res.on('finish',()=>{ if(res.statusCode<400) cacheDeletePattern('dashboard:user:*'); }); next(); });

function decryptPayoutRecords(records) {
  const fields=['BankName','AccountNumber','AccountName','Note'];
  return records.map(record=>{
    const safe={...record};
    for(const field of fields){
      try { safe[field]=decryptValue(safe[field]); }
      catch {
        safe[field]=null;
        console.warn('Unreadable legacy payout field omitted',{payoutId:record.PayoutId,field});
      }
    }
    safe.EvidenceUrl=safe.EvidenceUrl?`/api/private-files/payout-${safe.PayoutId}`:null;
    return safe;
  });
}
r.get('/', async (req,res) => {
  const p=await getPool();
  const result=await p.request().input('uid',sql.Int,req.user.userId)
    .query(`SELECT p.PayoutId,p.GroupId,p.RecipientId,p.RecordedBy,p.CycleNumber,p.Amount,
            p.AdminCharge,p.TotalPayout,p.ScheduledFor,p.Status,p.PaidAt,p.CreatedAt,
            CASE WHEN viewer.Role='Admin' OR p.RecipientId=@uid THEN p.BankName END AS BankName,
            CASE WHEN viewer.Role='Admin' OR p.RecipientId=@uid THEN p.AccountNumber END AS AccountNumber,
            CASE WHEN viewer.Role='Admin' OR p.RecipientId=@uid THEN p.AccountName END AS AccountName,
            CASE WHEN viewer.Role='Admin' OR p.RecipientId=@uid THEN p.Note END AS Note,
            CASE WHEN viewer.Role='Admin' OR p.RecipientId=@uid THEN p.EvidenceUrl END AS EvidenceUrl,
            g.GroupName,g.Icon,
            CASE WHEN g.GroupMembersAnonymous=1 AND viewer.Role<>'Admin' AND p.RecipientId<>@uid
              THEN 'Anonymous Member'
              ELSE u.FirstName+' '+u.LastName
            END AS RecipientName,
            CASE WHEN g.GroupMembersAnonymous=1 AND viewer.Role<>'Admin' AND p.RecipientId<>@uid
              THEN '#2D5040' ELSE u.AvatarColor
            END AS AvatarColor
            FROM Payouts p JOIN AjoGroups g ON g.GroupId=p.GroupId
            JOIN Users u ON u.UserId=p.RecipientId
            JOIN GroupMembers viewer ON viewer.GroupId=p.GroupId AND viewer.UserId=@uid AND viewer.Status='Approved'
            WHERE p.GroupId IN(SELECT GroupId FROM GroupMembers WHERE UserId=@uid AND Status='Approved')
            ORDER BY p.ScheduledFor`);
  res.json(decryptPayoutRecords(result.recordset));
});
r.get('/group/:groupId', async (req,res) => {
  const p=await getPool();
  const result=await p.request().input('gid',sql.Int,parseInt(req.params.groupId)).input('uid',sql.Int,req.user.userId)
    .query(`SELECT p.PayoutId,p.GroupId,p.RecipientId,p.RecordedBy,p.CycleNumber,p.Amount,
            p.AdminCharge,p.TotalPayout,p.ScheduledFor,p.Status,p.PaidAt,p.CreatedAt,
            CASE WHEN viewer.Role='Admin' OR p.RecipientId=@uid THEN p.BankName END AS BankName,
            CASE WHEN viewer.Role='Admin' OR p.RecipientId=@uid THEN p.AccountNumber END AS AccountNumber,
            CASE WHEN viewer.Role='Admin' OR p.RecipientId=@uid THEN p.AccountName END AS AccountName,
            CASE WHEN viewer.Role='Admin' OR p.RecipientId=@uid THEN p.Note END AS Note,
            CASE WHEN viewer.Role='Admin' OR p.RecipientId=@uid THEN p.EvidenceUrl END AS EvidenceUrl,
            CASE WHEN g.GroupMembersAnonymous=1 AND viewer.Role<>'Admin' AND p.RecipientId<>@uid
              THEN 'Anonymous Member'
              ELSE u.FirstName+' '+u.LastName
            END AS RecipientName,
            CASE WHEN g.GroupMembersAnonymous=1 AND viewer.Role<>'Admin' AND p.RecipientId<>@uid
              THEN '#2D5040' ELSE u.AvatarColor
            END AS AvatarColor
            FROM Payouts p JOIN Users u ON u.UserId=p.RecipientId
            JOIN AjoGroups g ON g.GroupId=p.GroupId
            JOIN GroupMembers viewer ON viewer.GroupId=p.GroupId AND viewer.UserId=@uid AND viewer.Status='Approved'
            WHERE p.GroupId=@gid ORDER BY p.ScheduledFor`);
  res.json(decryptPayoutRecords(result.recordset));
});
r.get('/member/:groupId', async (req,res) => {
  const p=await getPool();
  const groupId=parseInt(req.params.groupId);
  const membership=await p.request().input('gid',sql.Int,groupId).input('uid',sql.Int,req.user.userId)
    .query(`SELECT gm.PayoutDate,gm.SlotNumber,g.GroupName
            FROM GroupMembers gm JOIN AjoGroups g ON g.GroupId=gm.GroupId
            WHERE gm.GroupId=@gid AND gm.UserId=@uid AND gm.Status='Approved'`);
  if(!membership.recordset.length) return res.status(403).json({error:'Group membership required'});
  const result=await p.request().input('gid',sql.Int,groupId).input('uid',sql.Int,req.user.userId)
    .query(`SELECT p.*,admin.FirstName+' '+admin.LastName AS AdminName
            FROM Payouts p JOIN Users admin ON admin.UserId=p.RecordedBy
            WHERE p.GroupId=@gid AND p.RecipientId=@uid
            ORDER BY COALESCE(p.PaidAt,CAST(p.ScheduledFor AS DATETIME2)) DESC`);
  const member=membership.recordset[0];
  res.json({groupName:member.GroupName,slotNumber:member.SlotNumber,assignedDate:member.PayoutDate,payouts:decryptPayoutRecords(result.recordset)});
});

async function notifyPayout(connection,payout,actorId){
  const paid=payout.Status==='Paid';
  const title=paid?'Payout confirmed':'Payout scheduled';
  const body=paid?`A payout of ${payout.TotalPayout} has been recorded as paid.`:`A payout of ${payout.TotalPayout} is scheduled for ${String(payout.ScheduledFor).slice(0,10)}.`;
  await connection.request().input('uid',sql.Int,payout.RecipientId).input('gid',sql.Int,payout.GroupId).input('type',sql.NVarChar,paid?'PayoutPaid':'PayoutScheduled').input('title',sql.NVarChar,title).input('body',sql.NVarChar,body)
    .query('INSERT Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,@type,@title,@body)');
  await sendMyAjoAiPrivateMessage(connection,{groupId:payout.GroupId,senderId:actorId,recipientId:payout.RecipientId,body,attachmentUrl:payout.EvidenceUrl?`/api/private-files/payout-${payout.PayoutId}`:null});
  await enqueuePush(connection,payout.RecipientId,{type:paid?'PayoutPaid':'PayoutScheduled',title,body,url:`/group/${payout.GroupId}/payout-date`});
  if(paid)await connection.request().input('gid',sql.Int,payout.GroupId).input('uid',sql.Int,payout.RecipientId).query('UPDATE GroupMembers SET HasReceived=1 WHERE GroupId=@gid AND UserId=@uid');
}
r.post('/', requireMfa, financialUpload.single('evidence'), async (req,res,next) => {
  let committed=false;
  try {
    const groupId=positiveInt(req.body.groupId),recipientId=positiveInt(req.body.recipientId),cycleNumber=positiveInt(req.body.cycleNumber);
    const grossAmount=Number(req.body.amount),adminCharge=Number(req.body.adminCharge||0);
    const scheduledFor=req.body.scheduledFor;
    const instant=req.body.instant===true||req.body.instant==='true'||req.body.instant==='1';
    const note=String(req.body.note||'').trim();
    const requestKey=String(req.body.requestKey||'');
    if(!groupId||!recipientId||!cycleNumber||!dateOnly(scheduledFor))throw fail(400,'Choose a valid group, recipient, cycle and date');
    if(!Number.isFinite(grossAmount)||grossAmount<=0||grossAmount>999999999||!Number.isFinite(adminCharge)||adminCharge<0||adminCharge>grossAmount)throw fail(400,'Enter a positive payout amount and a charge between zero and the amount');
    if(!/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey))throw fail(400,'A payout request key is required. Refresh the page and retry.');
    if(note.length>4000)throw fail(400,'Payout note must not exceed 4000 characters');
    if(instant&&!req.file)throw fail(400,'Attach payment evidence for an instant payout');
    if(req.file&&!await validateUploadedFile(req.file))throw fail(400,'Evidence content does not match its file type');
    const evidenceHash=req.file?crypto.createHash('sha256').update(await fs.readFile(req.file.path)).digest('hex'):null;
    const hash=crypto.createHash('sha256').update(JSON.stringify({groupId,recipientId,cycleNumber,grossAmount,adminCharge,scheduledFor,instant,note,evidenceHash})).digest('hex');
    const pool=await getPool();
    const result=await withTransaction(pool,async connection=>{
      const access=await connection.request().input('gid',sql.Int,groupId).input('uid',sql.Int,req.user.userId)
        .query("SELECT gm.Role,g.CurrentCycle,g.Status FROM GroupMembers gm JOIN AjoGroups g ON g.GroupId=gm.GroupId WHERE gm.GroupId=@gid AND gm.UserId=@uid AND gm.Status='Approved'");
      if(access.recordset[0]?.Role!=='Admin')throw fail(403,'Group admin only');
      const existing=await connection.request().input('uid',sql.Int,req.user.userId).input('key',sql.NVarChar(100),requestKey)
        .query('SELECT PayoutId,RequestHash FROM Payouts WITH(UPDLOCK,HOLDLOCK) WHERE RecordedBy=@uid AND RequestKey=@key');
      if(existing.recordset[0]){
        if(existing.recordset[0].RequestHash!==hash)throw fail(409,'This request key was already used with different payout details');
        return {PayoutId:existing.recordset[0].PayoutId,replayed:true};
      }
      if(access.recordset[0].Status!=='Active')throw fail(409,'This group is not active');
      if(Number(access.recordset[0].CurrentCycle)!==cycleNumber)throw fail(409,'The group cycle has changed. Reload before recording this payout.');
      const duplicate=await connection.request().input('gid',sql.Int,groupId).input('cycle',sql.Int,cycleNumber)
        .query("SELECT PayoutId FROM Payouts WITH(UPDLOCK,HOLDLOCK) WHERE GroupId=@gid AND CycleNumber=@cycle AND Status IN ('Scheduled','Paid')");
      if(duplicate.recordset.length)throw fail(409,'This cycle already has a scheduled or paid payout');
      const nextRecipient=await connection.request().input('gid',sql.Int,groupId).query("SELECT TOP 1 gm.UserId FROM GroupMembers gm WHERE gm.GroupId=@gid AND gm.Status='Approved' AND NOT EXISTS(SELECT 1 FROM Payouts p WHERE p.GroupId=@gid AND p.RecipientId=gm.UserId AND p.Status='Paid') ORDER BY gm.SlotNumber,gm.MemberId");
      if(Number(nextRecipient.recordset[0]?.UserId)!==recipientId)throw fail(409,'Choose the next unpaid member in slot order');
      const recipient=await connection.request().input('gid',sql.Int,groupId).input('rid',sql.Int,recipientId)
        .query("SELECT u.BankName,u.BankAccountNumber,u.BankAccountName,gm.HasReceived FROM Users u JOIN GroupMembers gm ON gm.UserId=u.UserId WHERE gm.GroupId=@gid AND u.UserId=@rid AND gm.Status='Approved'");
      if(!recipient.recordset[0])throw fail(400,'Payout recipient must be an approved member of this group');
      if(recipient.recordset[0].HasReceived)throw fail(409,'This member has already received a payout in this savings round');
      const bank=decryptRecord(recipient.recordset[0],['BankName','BankAccountNumber','BankAccountName']);
      if(![bank.BankName,bank.BankAccountNumber,bank.BankAccountName].every(value=>String(value||'').trim()))throw fail(400,'This member must save complete bank details before payout');
      const totalPayout=grossAmount-adminCharge;
      const evidenceUrl=req.file?`private:${req.file.filename}`:null;
      const added=await connection.request().input('gid',sql.Int,groupId).input('rid',sql.Int,recipientId).input('rb',sql.Int,req.user.userId).input('cy',sql.Int,cycleNumber)
        .input('am',sql.Decimal(18,2),grossAmount).input('charge',sql.Decimal(18,2),adminCharge).input('total',sql.Decimal(18,2),totalPayout).input('sf',sql.Date,scheduledFor)
        .input('instant',sql.Bit,instant?1:0).input('bn',sql.NVarChar,encryptValue(bank.BankName)).input('an',sql.NVarChar,encryptValue(bank.BankAccountNumber)).input('ana',sql.NVarChar,encryptValue(bank.BankAccountName)).input('no',sql.NVarChar,encryptValue(note)).input('evidence',sql.NVarChar,evidenceUrl)
        .input('key',sql.NVarChar(100),requestKey).input('hash',sql.Char(64),hash)
        .query(`INSERT INTO Payouts(GroupId,RecipientId,RecordedBy,CycleNumber,Amount,AdminCharge,TotalPayout,ScheduledFor,BankName,AccountNumber,AccountName,Note,EvidenceUrl,Status,PaidAt,RequestKey,RequestHash)
          OUTPUT INSERTED.PayoutId VALUES(@gid,@rid,@rb,@cy,@am,@charge,@total,@sf,@bn,@an,@ana,@no,@evidence,CASE WHEN @instant=1 THEN 'Paid' ELSE 'Scheduled' END,CASE WHEN @instant=1 THEN SYSUTCDATETIME() ELSE NULL END,@key,@hash)`);
      const payout={PayoutId:added.recordset[0].PayoutId,GroupId:groupId,RecipientId:recipientId,TotalPayout:totalPayout,ScheduledFor:scheduledFor,Status:instant?'Paid':'Scheduled',EvidenceUrl:evidenceUrl};
      await notifyPayout(connection,payout,req.user.userId);
      return {PayoutId:payout.PayoutId};
    });
    committed=!result.replayed;
    if(result.replayed&&req.file)await fs.unlink(req.file.path).catch(()=>{});
    void deliverPushOutbox(pool);
    res.status(result.replayed?200:201).json(result);
  }catch(error){
    if(!committed&&req.file)await fs.unlink(req.file.path).catch(()=>{});
    if(error.status)return res.status(error.status).json({error:error.message,code:error.code});
    next(error);
  }
});
r.put('/:id/paid', requireMfa, async (req,res,next)=>{
  try{
    const id=positiveInt(req.params.id);if(!id)throw fail(400,'Invalid payout ID');
    const pool=await getPool();
    await withTransaction(pool,async connection=>{
      const access=await connection.request().input('id',sql.Int,id).input('uid',sql.Int,req.user.userId)
        .query("SELECT gm.Role FROM Payouts p JOIN GroupMembers gm ON gm.GroupId=p.GroupId AND gm.UserId=@uid AND gm.Status='Approved' WHERE p.PayoutId=@id");
      if(access.recordset[0]?.Role!=='Admin')throw fail(403,'Group admin only');
      const changed=await connection.request().input('id',sql.Int,id).query(`UPDATE Payouts SET Status='Paid',PaidAt=SYSUTCDATETIME() OUTPUT INSERTED.* WHERE PayoutId=@id AND Status='Scheduled'`);
      if(!changed.recordset[0])throw fail(409,'Payout is already paid or cannot be updated');
      await notifyPayout(connection,changed.recordset[0],req.user.userId);
    });
    void deliverPushOutbox(pool);res.json({paid:true});
  }catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error);}
});
export default r;
