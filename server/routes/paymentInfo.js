// paymentInfo.js
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth } from '../middleware.js';
import { decryptRecord, encryptValue } from '../utils/fieldCrypto.js';
const r = Router();
r.use(requireAuth);
r.get('/:groupId', async (req,res) => {
  const p=await getPool();
  const gid=parseInt(req.params.groupId);
  const access=await p.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
    .query("SELECT Role FROM GroupMembers WHERE GroupId=@gid AND UserId=@uid AND Status='Approved'");
  if(!access.recordset.length) return res.status(403).json({error:'Group membership required'});
  const result=await p.request().input('gid',sql.Int,gid)
    .query('SELECT * FROM GroupPaymentInfo WHERE GroupId=@gid');
  res.json(decryptRecord(result.recordset[0], ['BankName','AccountNumber','AccountName','RoutingCode','Instructions']));
});
r.put('/:groupId', async (req,res) => {
  try {
    const {bankName,accountNumber,accountName,routingCode,instructions}=req.body;
    if (![bankName, accountNumber, accountName].every(value => String(value || '').trim())) {
      return res.status(400).json({error:'Bank name, account number, and account name are required'});
    }
    const gid=parseInt(req.params.groupId);
    const p=await getPool();
    const access=await p.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
      .query("SELECT Role FROM GroupMembers WHERE GroupId=@gid AND UserId=@uid AND Status='Approved'");
    if(access.recordset[0]?.Role!=='Admin') return res.status(403).json({error:'Group admin only'});
    const ex=await p.request().input('gid',sql.Int,gid).query('SELECT PaymentInfoId FROM GroupPaymentInfo WHERE GroupId=@gid');
    if(ex.recordset.length){
      await p.request().input('gid',sql.Int,gid).input('bn',sql.NVarChar,encryptValue(bankName))
        .input('an',sql.NVarChar,encryptValue(accountNumber)).input('ana',sql.NVarChar,encryptValue(accountName))
        .input('rc',sql.NVarChar,encryptValue(routingCode)).input('ins',sql.NVarChar,encryptValue(instructions))
        .query('UPDATE GroupPaymentInfo SET BankName=@bn,AccountNumber=@an,AccountName=@ana,RoutingCode=@rc,Instructions=@ins,UpdatedAt=SYSUTCDATETIME() WHERE GroupId=@gid');
    } else {
      await p.request().input('gid',sql.Int,gid).input('bn',sql.NVarChar,encryptValue(bankName))
        .input('an',sql.NVarChar,encryptValue(accountNumber)).input('ana',sql.NVarChar,encryptValue(accountName))
        .input('rc',sql.NVarChar,encryptValue(routingCode)).input('ins',sql.NVarChar,encryptValue(instructions))
        .query('INSERT INTO GroupPaymentInfo(GroupId,BankName,AccountNumber,AccountName,RoutingCode,Instructions) VALUES(@gid,@bn,@an,@ana,@rc,@ins)');
    }
    res.json({saved:true});
  } catch(e){console.error(e);res.status(500).json({error:'Failed to save payment info'});}
});
export default r;
