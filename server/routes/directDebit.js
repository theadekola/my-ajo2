import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth } from '../middleware.js';
import { decryptRecord, encryptValue } from '../utils/fieldCrypto.js';
const r = Router();
r.use(requireAuth);
r.get('/group/:groupId', async (req,res) => {
  const p=await getPool();
  const result=await p.request().input('gid',sql.Int,parseInt(req.params.groupId)).input('uid',sql.Int,req.user.userId)
    .query(`SELECT dd.DirectDebitId,dd.GroupId,dd.UserId,dd.Status,dd.CreatedAt,
            dd.BankName,dd.AccountNumber,dd.AccountName,viewer.Role AS ViewerRole,
            CASE WHEN g.GroupMembersAnonymous=1 AND viewer.Role<>'Admin' AND dd.UserId<>@uid
              THEN 'Anonymous Member'
              ELSE u.FirstName+' '+u.LastName
            END AS MemberName
            FROM DirectDebitPayments dd
            JOIN Users u ON u.UserId=dd.UserId
            JOIN AjoGroups g ON g.GroupId=dd.GroupId
            JOIN GroupMembers viewer ON viewer.GroupId=dd.GroupId AND viewer.UserId=@uid AND viewer.Status='Approved'
            WHERE dd.GroupId=@gid AND dd.Status='Active'
              AND (dd.UserId=@uid OR viewer.Role='Admin')`);
  const rows=result.recordset.map(raw=>{
    const record=decryptRecord(raw,['BankName','AccountNumber','AccountName']);
    const own=record.UserId===req.user.userId;
    const digits=String(record.AccountNumber||'');
    const names=String(record.AccountName||'').trim().split(/\s+/).filter(Boolean);
    return {
      ...record,
      ViewerRole:undefined,
      AccountNumber:own?record.AccountNumber:`******${digits.slice(-4)}`,
      AccountName:own?record.AccountName:(names.length?`${names[0][0]}. ${names.at(-1)}`:null),
      IsMasked:!own
    };
  });
  res.json(rows);
});
r.post('/group/:groupId', async (req,res) => {
  try {
    const {bankName,accountNumber,accountName}=req.body;
    const gid=parseInt(req.params.groupId);
    const p=await getPool();
    const access=await p.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
      .query("SELECT 1 AS Allowed FROM GroupMembers WHERE GroupId=@gid AND UserId=@uid AND Status='Approved'");
    if(!access.recordset.length) return res.status(403).json({error:'Group membership required'});
    await p.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
      .query('UPDATE DirectDebitPayments SET Status=\'Cancelled\' WHERE GroupId=@gid AND UserId=@uid AND Status=\'Active\'');
    await p.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
      .input('bn',sql.NVarChar,encryptValue(bankName)).input('an',sql.NVarChar,encryptValue(accountNumber)).input('ana',sql.NVarChar,encryptValue(accountName))
      .query('INSERT INTO DirectDebitPayments(GroupId,UserId,BankName,AccountNumber,AccountName) VALUES(@gid,@uid,@bn,@an,@ana)');
    res.json({setup:true});
  } catch(e){console.error(e);res.status(500).json({error:'Failed to setup direct debit'});}
});
export default r;
