import { withTransaction, positiveInt, fail } from '../utils/operations.js';
import { enqueuePush, deliverPushOutbox } from '../services/pushOutbox.js';
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getPool, sql } from '../db.js';
import { financialUpload, privateUploadRoot, requireAuth, validateFileBuffer, validateUploadedFile } from '../middleware.js';
import { sendPushToUser } from '../utils/push.js';
import { decryptRecords, encryptValue } from '../utils/fieldCrypto.js';
import { normalizeIconRecords } from '../utils/iconValues.js';
import { createActivity } from '../services/activityService.js';
import { cacheDeletePattern } from '../services/redisService.js';
const r = Router();
r.use(requireAuth);

async function recordActivity(event) {
  try { return await createActivity(event); }
  catch (error) { console.error('Activity event could not be recorded', error?.message || error); return null; }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = privateUploadRoot;
const receiptTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/heic', '.heic'],
  ['image/heif', '.heif'],
  ['application/pdf', '.pdf'],
]);
const receiptExtensionPattern = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;

async function saveReceiptDataUrl({ dataUrl, fileName, mimeType }) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw Object.assign(new Error('Receipt evidence could not be read. Please choose the file again.'), { status: 400, code: 'INVALID_RECEIPT_DATA' });
  const detectedType = String(match[1] || mimeType || '').toLowerCase();
  const extFromName = path.extname(String(fileName || '')).toLowerCase();
  const expectedExt=receiptTypes.get(detectedType);
  const ext = expectedExt && receiptExtensionPattern.test(extFromName) && (extFromName===expectedExt || (expectedExt==='.jpg' && extFromName==='.jpeg')) ? extFromName : '';
  if (!ext) throw Object.assign(new Error('Upload a JPG, PNG, WebP, HEIC, HEIF, or PDF receipt.'), { status: 400, code: 'INVALID_RECEIPT_TYPE' });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw Object.assign(new Error('Receipt evidence could not be read. Please choose the file again.'), { status: 400, code: 'INVALID_RECEIPT_DATA' });
  if (buffer.length > 5 * 1024 * 1024) throw Object.assign(new Error('Receipt upload must be 5 MB or smaller.'), { status: 400, code: 'RECEIPT_TOO_LARGE' });
  if (!validateFileBuffer(buffer.subarray(0,32),ext)) throw Object.assign(new Error('Receipt content does not match its file type.'), { status:400, code:'INVALID_RECEIPT_SIGNATURE' });
  await fs.promises.mkdir(uploadDir, { recursive: true });
  const safeName = `${crypto.randomUUID()}${ext}`;
  await fs.promises.writeFile(path.join(uploadDir, safeName), buffer);
  return `private:${safeName}`;
}

const receiptUpload = financialUpload.single('receipt');
function runReceiptUpload(req, res) {
  return new Promise((resolve, reject) => {
    receiptUpload(req, res, err => err ? reject(err) : resolve());
  });
}

function uploadErrorResponse(error) {
  if (!error) return null;
  if (error.name === 'MulterError') {
    return error.code === 'LIMIT_FILE_SIZE'
      ? 'Upload must be 5 MB or smaller'
      : 'Upload must be a JPG, PNG, WebP, HEIC, HEIF, or PDF file';
  }
  const message = String(error.message || '');
  if (/unexpected end of form|multipart|part terminated|boundary/i.test(message)) {
    return 'The receipt upload was interrupted. Please choose the file again and retry.';
  }
  if (['EACCES', 'EPERM', 'ENOENT'].includes(error.code)) {
    return 'Could not save the uploaded file. Please contact support if this continues.';
  }
  return null;
}

r.get('/', async (req,res) => {
  const pool=await getPool();
  const result=await pool.request().input('uid',sql.Int,req.user.userId)
    .query(`SELECT TOP 200 c.*,g.GroupName,g.Icon,
            CASE WHEN g.GroupMembersAnonymous=1 AND viewer.Role<>'Admin' AND c.UserId<>@uid
              THEN 'Anonymous Member'
              ELSE u.FirstName+' '+u.LastName
            END AS MemberName,
            CASE WHEN g.GroupMembersAnonymous=1 AND viewer.Role<>'Admin' AND c.UserId<>@uid
              THEN '#2D5040' ELSE u.AvatarColor
            END AS AvatarColor
            FROM Contributions c JOIN AjoGroups g ON g.GroupId=c.GroupId
            JOIN Users u ON u.UserId=c.UserId
            JOIN GroupMembers viewer ON viewer.GroupId=c.GroupId AND viewer.UserId=@uid AND viewer.Status='Approved'
            WHERE c.GroupId IN(SELECT GroupId FROM GroupMembers WHERE UserId=@uid AND Status='Approved')
            ORDER BY c.PaidAt DESC`);
  const records=normalizeIconRecords(decryptRecords(result.recordset, ['ReferenceNo','Note']));
  res.json(records.map(item=>({...item,ReceiptUrl:item.ReceiptUrl?`/api/private-files/contribution-${item.ContributionId}`:null})));
});

r.get('/group/:groupId', async (req,res) => {
  const pool=await getPool();
  const gid=parseInt(req.params.groupId);
  // admin sees all, member sees own
  const m=await pool.request().input('uid',sql.Int,req.user.userId).input('gid',sql.Int,gid)
    .query('SELECT Role FROM GroupMembers WHERE UserId=@uid AND GroupId=@gid AND Status=\'Approved\'');
  const isAdmin=m.recordset[0]?.Role==='Admin';
  if(!m.recordset.length) return res.status(403).json({error:'Group membership required'});
  let q=`SELECT c.*,u.FirstName+' '+u.LastName AS MemberName,u.AvatarColor,u.ProfilePicture
          FROM Contributions c JOIN Users u ON u.UserId=c.UserId WHERE c.GroupId=@gid`;
  if(!isAdmin) q+=` AND c.UserId=${req.user.userId}`;
  q+=' ORDER BY c.PaidAt DESC';
  const result=await pool.request().input('gid',sql.Int,gid).query(q);
  const records=normalizeIconRecords(decryptRecords(result.recordset, ['ReferenceNo','Note']));
  res.json(records.map(item=>({...item,ReceiptUrl:item.ReceiptUrl?`/api/private-files/contribution-${item.ContributionId}`:null})));
});

r.post('/', async (req,res) => {
  try {
    if (req.is('multipart/form-data')) await runReceiptUpload(req, res);
    const {groupId,amount,method='BankTransfer',referenceNo,note,receiptDataUrl,receiptFileName,receiptMimeType}=req.body;
    if(!groupId||!amount) return res.status(400).json({error:'groupId and amount required'});
    const numericAmount = Number(amount);
    if(!Number.isFinite(numericAmount)||numericAmount<=0) return res.status(400).json({error:'Enter a valid payment amount'});
    if(req.file && !await validateUploadedFile(req.file)) return res.status(400).json({error:'Receipt content does not match its file type'});
    const receiptUrl=req.file?`private:${req.file.filename}`:await saveReceiptDataUrl({ dataUrl: receiptDataUrl, fileName: receiptFileName, mimeType: receiptMimeType });
    const pool=await getPool();
    const membership=await pool.request().input('gid',sql.Int,parseInt(groupId)).input('uid',sql.Int,req.user.userId)
      .query("SELECT 1 AS Allowed FROM GroupMembers WHERE GroupId=@gid AND UserId=@uid AND Status='Approved'");
    if(!membership.recordset.length) return res.status(403).json({error:'Group membership required'});
    const g=await pool.request().input('gid',sql.Int,parseInt(groupId))
      .query('SELECT AdminUserId,GroupName,CurrentCycle FROM AjoGroups WHERE GroupId=@gid');
    if(!g.recordset.length) return res.status(404).json({error:'Group not found'});
    const payInfo=await pool.request().input('gid',sql.Int,parseInt(groupId))
      .query(`SELECT TOP 1 PaymentInfoId FROM GroupPaymentInfo
              WHERE GroupId=@gid
                AND NULLIF(LTRIM(RTRIM(BankName)),'') IS NOT NULL
                AND NULLIF(LTRIM(RTRIM(AccountNumber)),'') IS NOT NULL
                AND NULLIF(LTRIM(RTRIM(AccountName)),'') IS NOT NULL`);
    if(!payInfo.recordset.length) return res.status(400).json({error:'Payment details are not available yet. Please wait for the group admin to add bank details.'});
    const {AdminUserId,GroupName,CurrentCycle}=g.recordset[0];
    const result=await pool.request()
      .input('gid',sql.Int,parseInt(groupId)).input('uid',sql.Int,req.user.userId)
      .input('cy',sql.Int,CurrentCycle).input('am',sql.Decimal(18,2),numericAmount)
      .input('me',sql.NVarChar,method).input('re',sql.NVarChar,encryptValue(referenceNo))
      .input('ru',sql.NVarChar,receiptUrl||null).input('no',sql.NVarChar,encryptValue(note))
      .query(`INSERT INTO Contributions(GroupId,UserId,CycleNumber,Amount,Method,ReferenceNo,ReceiptUrl,Note)
              OUTPUT INSERTED.ContributionId VALUES(@gid,@uid,@cy,@am,@me,@re,@ru,@no)`);
    const body = `A member submitted a payment of ${amount} for ${GroupName}`;
    try {
      await pool.request().input('uid',sql.Int,AdminUserId).input('gid',sql.Int,parseInt(groupId))
        .input('b',sql.NVarChar,body)
        .query(`INSERT INTO Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,'PaymentSubmitted','New Payment',@b)`);
      await sendPushToUser(pool, sql, AdminUserId, { type:'PaymentSubmitted', title:'New Payment', body, url:`/group/${groupId}/payments` });
    } catch (notifyError) {
      console.error('Contribution notification failed', notifyError?.message || notifyError);
    }
    const contributionId=result.recordset[0].ContributionId;
    await recordActivity({ eventType:'contribution.created', category:'contributions', title:'Contribution submitted',
      description:`A contribution was submitted to ${GroupName}`, userId:req.user.userId,
      groupId:parseInt(groupId), entityId:contributionId, entityType:'Contribution', amount:numericAmount,
      severity:'info' });
    await cacheDeletePattern('dashboard:user:*');
    res.status(201).json({contributionId});
  } catch(e){
    console.error('Contribution submit failed', e);
    if (e?.status) return res.status(e.status).json({error:e.message, code:e.code || 'CONTRIBUTION_RECEIPT_INVALID'});
    const uploadMessage = uploadErrorResponse(e);
    if (uploadMessage) return res.status(e?.code === 'EACCES' || e?.code === 'EPERM' || e?.code === 'ENOENT' ? 500 : 400).json({error:uploadMessage, code:'CONTRIBUTION_UPLOAD_FAILED'});
    const message = String(e?.message || '');
    if (e?.number === 2628 || e?.number === 8152 || /truncated/i.test(message)) {
      return res.status(400).json({error:'One of the payment fields is too long. Please shorten the reference or note and try again.', code:'CONTRIBUTION_FIELD_TOO_LONG'});
    }
    if (/Invalid object name|Invalid column name/i.test(message)) {
      return res.status(500).json({error:'The payment database is missing a required update. Please restart the server and try again.', code:'CONTRIBUTION_SCHEMA_MISSING'});
    }
    res.status(500).json({error:'Failed to record contribution', code:'CONTRIBUTION_RECORD_FAILED'});
  }
});

async function reviewContribution(req,res,next,status){
  try {
    const id=positiveInt(req.params.id);if(!id)throw fail(400,'Invalid contribution ID');
    const pool=await getPool();
    const item=await withTransaction(pool,async connection=>{
      const access=await connection.request().input('id',sql.Int,id).input('uid',sql.Int,req.user.userId)
        .query("SELECT gm.Role FROM Contributions c JOIN GroupMembers gm ON gm.GroupId=c.GroupId AND gm.UserId=@uid AND gm.Status='Approved' WHERE c.ContributionId=@id");
      if(access.recordset[0]?.Role!=='Admin')throw fail(403,'Group admin only');
      const changed=await connection.request().input('id',sql.Int,id).input('rid',sql.Int,req.user.userId).input('status',sql.NVarChar,status)
        .query(`UPDATE Contributions SET Status=@status,ReviewedBy=@rid,ReviewedAt=SYSUTCDATETIME()
          OUTPUT INSERTED.UserId,INSERTED.GroupId,INSERTED.Amount WHERE ContributionId=@id AND Status='Pending'`);
      const row=changed.recordset[0];if(!row)throw fail(409,'This contribution has already been reviewed');
      const title=status==='Confirmed'?'Payment confirmed':'Payment rejected';
      const body=status==='Confirmed'?'Your contribution has been confirmed by the admin.':'Your contribution was rejected. Please contact the group admin.';
      await connection.request().input('uid',sql.Int,row.UserId).input('gid',sql.Int,row.GroupId).input('type',sql.NVarChar,'Payment'+status).input('title',sql.NVarChar,title).input('body',sql.NVarChar,body)
        .query('INSERT Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,@type,@title,@body)');
      await enqueuePush(connection,row.UserId,{type:'Payment'+status,title,body,url:`/group/${row.GroupId}/contributions`});
      return row;
    });
    await recordActivity({eventType:status==='Confirmed'?'contribution.confirmed':'contribution.failed',category:'contributions',title:'Contribution '+status.toLowerCase(),userId:item.UserId,groupId:item.GroupId,entityId:id,entityType:'Contribution',amount:item.Amount});
    await cacheDeletePattern('dashboard:user:*').catch(()=>{});
    void deliverPushOutbox(pool);
    res.json({status});
  }catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error);}
}
r.put('/:id/confirm',(req,res,next)=>reviewContribution(req,res,next,'Confirmed'));
r.put('/:id/reject',(req,res,next)=>reviewContribution(req,res,next,'Rejected'));
export default r;
