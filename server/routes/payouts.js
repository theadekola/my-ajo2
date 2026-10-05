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
r.post('/', requireMfa, financialUpload.single('evidence'), async (req,res) => {
  try {
    const {groupId,recipientId,amount,scheduledFor,cycleNumber=1,note}=req.body;
    const grossAmount=Number(amount);
    const adminCharge=Math.max(0,Number(req.body.adminCharge||0));
    if(!Number.isFinite(grossAmount)||grossAmount<=0) return res.status(400).json({error:'Enter a valid payout amount'});
    if(!Number.isFinite(adminCharge)||adminCharge>grossAmount) return res.status(400).json({error:'Admin charge cannot exceed the payout amount'});
    const totalPayout=grossAmount-adminCharge;
    const instant=req.body.instant===true||req.body.instant==='true'||req.body.instant==='1';
    if(instant&&!req.file) return res.status(400).json({error:'Attach payment evidence for an instant payout'});
    if(req.file && !await validateUploadedFile(req.file)) return res.status(400).json({error:'Evidence content does not match its file type'});
    const evidenceUrl=req.file?`private:${req.file.filename}`:null;
    const p=await getPool();
    const access=await p.request().input('gid',sql.Int,groupId).input('uid',sql.Int,req.user.userId)
      .query("SELECT Role FROM GroupMembers WHERE GroupId=@gid AND UserId=@uid AND Status='Approved'");
    if(access.recordset[0]?.Role!=='Admin') return res.status(403).json({error:'Group admin only'});
    const recipient=await p.request().input('gid',sql.Int,groupId).input('rid',sql.Int,recipientId)
      .query(`SELECT u.BankName,u.BankAccountNumber,u.BankAccountName
              FROM Users u WHERE u.UserId=@rid
              AND EXISTS(SELECT 1 FROM GroupMembers WHERE GroupId=@gid AND UserId=@rid AND Status='Approved')`);
    if(!recipient.recordset[0]) return res.status(400).json({error:'Payout recipient must be an approved member of this group'});
    const recipientBank=decryptRecord(recipient.recordset[0],['BankName','BankAccountNumber','BankAccountName']);
    const bankName=String(recipientBank.BankName||'').trim();
    const accountNumber=String(recipientBank.BankAccountNumber||'').trim();
    const accountName=String(recipientBank.BankAccountName||'').trim();
    if(!bankName||!accountNumber||!accountName) return res.status(400).json({error:'This member must save complete bank details before payout'});
    const result=await p.request()
      .input('gid',sql.Int,groupId).input('rid',sql.Int,recipientId)
      .input('rb',sql.Int,req.user.userId).input('cy',sql.Int,cycleNumber)
      .input('am',sql.Decimal(18,2),grossAmount).input('charge',sql.Decimal(18,2),adminCharge)
      .input('total',sql.Decimal(18,2),totalPayout).input('sf',sql.Date,scheduledFor)
      .input('instant',sql.Bit,instant?1:0)
      .input('bn',sql.NVarChar,encryptValue(bankName)).input('an',sql.NVarChar,encryptValue(accountNumber))
      .input('ana',sql.NVarChar,encryptValue(accountName)).input('no',sql.NVarChar,encryptValue(note))
      .input('evidence',sql.NVarChar,evidenceUrl)
      .query(`INSERT INTO Payouts(GroupId,RecipientId,RecordedBy,CycleNumber,Amount,AdminCharge,TotalPayout,ScheduledFor,BankName,AccountNumber,AccountName,Note,EvidenceUrl,Status,PaidAt)
              OUTPUT INSERTED.PayoutId
              VALUES(@gid,@rid,@rb,@cy,@am,@charge,@total,@sf,@bn,@an,@ana,@no,@evidence,
                CASE WHEN @instant=1 THEN 'Paid' ELSE 'Scheduled' END,
                CASE WHEN @instant=1 THEN SYSUTCDATETIME() ELSE NULL END)`);
    const title = instant ? 'Instant Payout Recorded' : 'Payout Scheduled';
    const type = instant ? 'PayoutPaid' : 'PayoutScheduled';
    const body = instant ? `An instant payout of ${totalPayout} has been recorded for you` : `You are scheduled to receive ${totalPayout} on ${scheduledFor}`;
    await p.request().input('uid',sql.Int,recipientId).input('gid',sql.Int,groupId)
      .input('b',sql.NVarChar,body)
      .input('type',sql.NVarChar,type).input('title',sql.NVarChar,title)
      .query(`INSERT INTO Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,@type,@title,@b)`);
    await sendPushToUser(p, sql, recipientId, { type, title, body, url:`/group/${groupId}/disbursement` });
    if(instant){
      const chatBody=`Payment confirmed: your payout of ${totalPayout.toLocaleString()} has been disbursed. Please open the attached receipt for payment evidence.`;
      await sendMyAjoAiPrivateMessage(p,{groupId:Number(groupId),senderId:req.user.userId,recipientId:Number(recipientId),body:chatBody,attachmentUrl:`/api/private-files/payout-${result.recordset[0].PayoutId}`});
    }
    res.status(201).json(result.recordset[0]);
  } catch(e){console.error(e);res.status(500).json({error:'Failed to schedule payout'});}
});
r.put('/:id/paid', requireMfa, async (req,res) => {
  const p=await getPool();
  const id=parseInt(req.params.id);
  const access=await p.request().input('id',sql.Int,id).input('uid',sql.Int,req.user.userId)
    .query("SELECT gm.Role,p.GroupId,p.RecipientId,p.TotalPayout,p.Amount,p.EvidenceUrl FROM Payouts p JOIN GroupMembers gm ON gm.GroupId=p.GroupId AND gm.UserId=@uid AND gm.Status='Approved' WHERE p.PayoutId=@id");
  if(access.recordset[0]?.Role!=='Admin') return res.status(403).json({error:'Group admin only'});
  const updated=await p.request().input('id',sql.Int,id)
    .query(`UPDATE Payouts SET Status='Paid',PaidAt=SYSUTCDATETIME()
            OUTPUT INSERTED.PayoutId
            WHERE PayoutId=@id AND Status='Scheduled'`);
  if(!updated.recordset[0]) return res.status(409).json({error:'Payout is already paid or cannot be updated'});
  const payout=access.recordset[0];
  const body=`Payment confirmed: your payout of ${Number(payout.TotalPayout??payout.Amount).toLocaleString()} has been marked as paid.${payout.EvidenceUrl?' The payment receipt is attached.':''}`;
  await sendMyAjoAiPrivateMessage(p,{groupId:payout.GroupId,senderId:req.user.userId,recipientId:payout.RecipientId,body,attachmentUrl:payout.EvidenceUrl?`/api/private-files/payout-${id}`:null});
  await p.request().input('uid',sql.Int,payout.RecipientId).input('gid',sql.Int,payout.GroupId).input('body',sql.NVarChar,body)
    .query("INSERT INTO Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,'PayoutPaid','Payout confirmed',@body)");
  await sendPushToUser(p,sql,payout.RecipientId,{type:'PayoutPaid',title:'Payout confirmed',body,url:`/group/${payout.GroupId}/chat`});
  res.json({paid:true});
});
export default r;
