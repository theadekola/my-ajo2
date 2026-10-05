import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getPool, sql } from '../db.js';
import { legacyUploadRoot, privateChatUploadRoot, privateUploadRoot, requireAuth } from '../middleware.js';

const r=Router();
r.use(requireAuth);

const contentTypes=new Map([
  ['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.png','image/png'],['.webp','image/webp'],
  ['.heic','image/heic'],['.heif','image/heif'],['.pdf','application/pdf'],
  ['.webm','audio/webm'],['.m4a','audio/mp4'],['.mp4','audio/mp4'],['.mp3','audio/mpeg'],['.ogg','audio/ogg'],['.wav','audio/wav'],
]);

function resolveStoredFile(stored) {
  const value=String(stored||'');
  const filename=path.basename(value.startsWith('private:')?value.slice(8):value.startsWith('chat:')?value.slice(5):value);
  if(!filename || filename==='.' || filename==='..') return null;
  const root=value.startsWith('chat:')?privateChatUploadRoot:value.startsWith('private:')?privateUploadRoot:legacyUploadRoot;
  const absolute=path.resolve(root,filename);
  if(path.dirname(absolute)!==path.resolve(root)) return null;
  return absolute;
}

r.get('/:fileId',async(req,res,next)=>{
  try {
    const match=String(req.params.fileId||'').match(/^(contribution|payout|message)-(\d+)$/);
    if(!match) return res.status(404).json({error:'Private file not found'});
    const [,kind,idText]=match;
    const pool=await getPool();
    let result;
    if(kind==='contribution') {
      result=await pool.request().input('id',sql.Int,Number(idText)).input('uid',sql.Int,req.user.userId)
        .query(`SELECT c.ReceiptUrl AS StoredPath FROM Contributions c
                JOIN GroupMembers viewer ON viewer.GroupId=c.GroupId AND viewer.UserId=@uid AND viewer.Status='Approved'
                WHERE c.ContributionId=@id AND c.ReceiptUrl IS NOT NULL
                  AND (c.UserId=@uid OR viewer.Role='Admin')`);
    } else if(kind==='payout') {
      result=await pool.request().input('id',sql.Int,Number(idText)).input('uid',sql.Int,req.user.userId)
        .query(`SELECT p.EvidenceUrl AS StoredPath FROM Payouts p
                JOIN GroupMembers viewer ON viewer.GroupId=p.GroupId AND viewer.UserId=@uid AND viewer.Status='Approved'
                WHERE p.PayoutId=@id AND p.EvidenceUrl IS NOT NULL
                  AND (p.RecipientId=@uid OR viewer.Role='Admin')`);
    } else {
      result=await pool.request().input('id',sql.BigInt,Number(idText)).input('uid',sql.Int,req.user.userId)
        .query(`SELECT m.AttachmentUrl AS StoredPath FROM Messages m
                JOIN GroupMembers viewer ON viewer.GroupId=m.GroupId AND viewer.UserId=@uid AND viewer.Status='Approved'
                WHERE m.MessageId=@id AND m.AttachmentUrl IS NOT NULL AND m.DeletedAt IS NULL
                  AND (m.IsPrivate=0 OR m.SenderId=@uid OR m.RecipientId=@uid)`);
    }
    const filePath=resolveStoredFile(result.recordset[0]?.StoredPath);
    if(!filePath) return res.status(404).json({error:'Private file not found'});
    await fs.promises.access(filePath,fs.constants.R_OK);
    const contentType=contentTypes.get(path.extname(filePath).toLowerCase());
    if(!contentType) return res.status(415).json({error:'Unsupported private file type'});
    res.setHeader('Content-Type',contentType);
    res.setHeader('Content-Disposition',`inline; filename="${path.basename(filePath).replace(/["\\]/g,'')}"`);
    res.setHeader('Cache-Control','no-store, private');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.sendFile(filePath,error=>{ if(error && !res.headersSent) next(error); });
  } catch(error) {
    if(error?.code==='ENOENT') return res.status(404).json({error:'Private file not found'});
    next(error);
  }
});

export default r;
