import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth } from '../middleware.js';
import crypto from 'crypto';
const r = Router();
r.use(requireAuth);

async function requireGroupAdmin(pool, groupId, userId) {
  const result=await pool.request().input('gid',sql.Int,groupId).input('uid',sql.Int,userId)
    .query("SELECT Role FROM GroupMembers WHERE GroupId=@gid AND UserId=@uid AND Status='Approved'");
  return result.recordset[0]?.Role==='Admin';
}

r.get('/:groupId', async (req,res) => {
  const pool=await getPool();
  const gid=parseInt(req.params.groupId);
  if(!await requireGroupAdmin(pool,gid,req.user.userId)) return res.status(403).json({error:'Group admin only'});
  const result=await pool.request().input('gid',sql.Int,gid)
    .query('SELECT * FROM InviteCodes WHERE GroupId=@gid ORDER BY CreatedAt DESC');
  res.json(result.recordset);
});

r.post('/:groupId', async (req,res) => {
  const { maxUses, expiresAt } = req.body;
  const gid = parseInt(req.params.groupId);
  const pool=await getPool();
  if(!await requireGroupAdmin(pool,gid,req.user.userId)) return res.status(403).json({error:'Group admin only'});
  const g=await pool.request().input('gid',sql.Int,gid).query('SELECT GroupName FROM AjoGroups WHERE GroupId=@gid');
  if(!g.recordset.length) return res.status(404).json({error:'Group not found'});
  const code=g.recordset[0].GroupName.slice(0,6).toUpperCase().replace(/[^A-Z]/g,'X')+'-'+crypto.randomBytes(6).toString('base64url').toUpperCase();
  await pool.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
    .input('c',sql.NVarChar,code)
    .input('mu',sql.Int,maxUses||null).input('ex',sql.DateTime2,expiresAt||null)
    .query('INSERT INTO InviteCodes(GroupId,CreatedBy,Code,MaxUses,ExpiresAt) VALUES(@gid,@uid,@c,@mu,@ex)');
  res.status(201).json({code});
});

r.delete('/:codeId', async (req,res) => {
  const pool=await getPool();
  const id=parseInt(req.params.codeId);
  const access=await pool.request().input('id',sql.Int,id).input('uid',sql.Int,req.user.userId)
    .query("SELECT gm.Role FROM InviteCodes ic JOIN GroupMembers gm ON gm.GroupId=ic.GroupId AND gm.UserId=@uid AND gm.Status='Approved' WHERE ic.InviteCodeId=@id");
  if(access.recordset[0]?.Role!=='Admin') return res.status(403).json({error:'Group admin only'});
  await pool.request().input('id',sql.Int,id).query('UPDATE InviteCodes SET IsActive=0 WHERE InviteCodeId=@id');
  res.json({revoked:true});
});
export default r;
