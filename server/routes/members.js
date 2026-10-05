// members.js
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth } from '../middleware.js';
import { sendPushToUser } from '../utils/push.js';
import { decryptRecord } from '../utils/fieldCrypto.js';
const r = Router();
r.use(requireAuth);

async function memberAdminAccess(pool, memberId, userId) {
  const result = await pool.request().input('id',sql.Int,memberId).input('uid',sql.Int,userId)
    .query("SELECT target.UserId,target.GroupId,target.Role,target.Status FROM GroupMembers target JOIN GroupMembers admin ON admin.GroupId=target.GroupId AND admin.UserId=@uid AND admin.Status='Approved' AND admin.Role='Admin' WHERE target.MemberId=@id");
  return result.recordset[0];
}

async function payoutDateAlreadyAssigned(pool, groupId, memberId, payoutDate) {
  const existing = await pool.request()
    .input('gid', sql.Int, groupId)
    .input('id', sql.Int, memberId)
    .input('d', sql.Date, payoutDate)
    .query(`SELECT TOP 1 MemberId FROM GroupMembers
            WHERE GroupId=@gid
              AND MemberId<>@id
              AND Status IN ('Approved','Pending')
              AND PayoutDate=@d`);
  return existing.recordset.length > 0;
}

r.get('/:groupId', async (req,res) => {
  const pool=await getPool();
  const gid=parseInt(req.params.groupId);
  const group=await pool.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
    .query(`SELECT g.GroupMembersAnonymous, gm.Role AS ViewerRole
            FROM AjoGroups g
            LEFT JOIN GroupMembers gm ON gm.GroupId=g.GroupId AND gm.UserId=@uid AND gm.Status='Approved'
            WHERE g.GroupId=@gid`);
  const anonymousOn=group.recordset[0]?.GroupMembersAnonymous === true || group.recordset[0]?.GroupMembersAnonymous === 1;
  const viewerIsAdmin=group.recordset[0]?.ViewerRole === 'Admin';
  if(!group.recordset[0]?.ViewerRole) return res.status(403).json({error:'Group membership required'});
  const basic=await pool.request().input('gid',sql.Int,gid)
    .query(`SELECT m.MemberId,m.GroupId,m.UserId,m.SlotNumber,m.Role,m.Status,m.PayoutDate,m.JoinedAt,m.ApprovedAt,
            u.FirstName,u.LastName,u.ProfilePicture,u.AvatarColor,u.Occupation
            FROM GroupMembers m JOIN Users u ON u.UserId=m.UserId
            WHERE m.GroupId=@gid ORDER BY m.Status,m.SlotNumber`);
  const management=viewerIsAdmin
    ? await pool.request().input('gid',sql.Int,gid)
      .query(`SELECT m.UserId,u.Title,u.Email,u.Phone,u.Sex,u.DateOfBirth,u.Address,u.CountryCode,
              u.IsActive AS UserIsActive,u.AccountDeletionStatus,u.AccountDeletionDueAt,
              u.BankName,u.BankAccountNumber,u.BankAccountName,u.BankRoutingCode
              FROM GroupMembers m JOIN Users u ON u.UserId=m.UserId WHERE m.GroupId=@gid`)
    : {recordset:[]};
  const own=await pool.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
    .query(`SELECT m.UserId,u.Title,u.Email,u.Phone,u.Sex,u.DateOfBirth,u.Address,u.CountryCode,
            u.IsActive AS UserIsActive,u.AccountDeletionStatus,u.AccountDeletionDueAt,
            u.BankName,u.BankAccountNumber,u.BankAccountName,u.BankRoutingCode
            FROM GroupMembers m JOIN Users u ON u.UserId=m.UserId
            WHERE m.GroupId=@gid AND m.UserId=@uid`);
  const privateByUser=new Map([...management.recordset,...own.recordset].map(row=>[
    row.UserId,decryptRecord(row,['Phone','Address','BankName','BankAccountNumber','BankAccountName','BankRoutingCode'])
  ]));
  const rows = basic.recordset.map(raw => {
    const m = { ...raw, ...(privateByUser.get(raw.UserId)||{}) };
    if (!anonymousOn || viewerIsAdmin || m.UserId === req.user.userId || m.Role === 'Admin') return {
      ...m,
      IsAnonymous: 0
    };
    return {
      ...m,
      FirstName: 'Anonymous',
      LastName: `Member #${m.SlotNumber || ''}`.trim(),
      Role: 'Member',
      Email: '',
      Phone: '',
      ProfilePicture: null,
      AvatarColor: '#2D5040',
      Occupation: 'Member',
      CountryCode: '',
      BankName: null,
      BankAccountNumber: null,
      BankAccountName: null,
      BankRoutingCode: null,
      IsAnonymous: 1
    };
  });
  res.json(rows);
});

r.put('/:memberId/approve', async (req,res) => {
  const pool=await getPool();
  const memberId=parseInt(req.params.memberId);
  const payoutDate=String(req.body?.payoutDate||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(payoutDate)) return res.status(400).json({error:'Assign a valid payout date before approving this member'});
  const target=await memberAdminAccess(pool,memberId,req.user.userId);
  if(!target) return res.status(403).json({error:'Group admin only'});
  if(await payoutDateAlreadyAssigned(pool,target.GroupId,memberId,payoutDate)) return res.status(409).json({error:'This payout date has already been assigned to another member'});
  await pool.request().input('id',sql.Int,memberId).input('d',sql.Date,payoutDate)
    .query(`UPDATE GroupMembers SET Status='Approved',PayoutDate=@d,ApprovedAt=SYSUTCDATETIME() WHERE MemberId=@id`);
  const m=await pool.request().input('id',sql.Int,memberId)
    .query('SELECT UserId,GroupId FROM GroupMembers WHERE MemberId=@id');
  if(m.recordset.length){
    const {UserId,GroupId}=m.recordset[0];
    const g=await pool.request().input('gid',sql.Int,GroupId).query('SELECT GroupName FROM AjoGroups WHERE GroupId=@gid');
    const assignedDate = new Date(payoutDate+'T00:00:00Z').toLocaleDateString('en-GB');
    const body = `Your request to join "${g.recordset[0]?.GroupName}" has been approved! Your payout date is ${assignedDate}.`;
    await pool.request().input('uid',sql.Int,UserId).input('gid',sql.Int,GroupId)
      .input('b',sql.NVarChar,body)
      .query(`INSERT INTO Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,'MemberApproved','Membership Approved',@b)`);
    await sendPushToUser(pool, sql, UserId, { type:'MemberApproved', title:'Membership Approved', body, url:`/group/${GroupId}` });
  }
  res.json({approved:true});
});

r.put('/:memberId/reject', async (req,res) => {
  const pool=await getPool();
  const memberId=parseInt(req.params.memberId);
  const target=await memberAdminAccess(pool,memberId,req.user.userId);
  if(!target) return res.status(403).json({error:'Group admin only'});
  const m=await pool.request().input('id',sql.Int,memberId)
    .query('SELECT UserId,GroupId FROM GroupMembers WHERE MemberId=@id');
  await pool.request().input('id',sql.Int,memberId)
    .query(`UPDATE GroupMembers SET Status='Rejected' WHERE MemberId=@id`);
  if(m.recordset.length){
    const {UserId,GroupId}=m.recordset[0];
    await pool.request().input('uid',sql.Int,UserId).input('gid',sql.Int,GroupId)
      .query(`INSERT INTO Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,'MemberRejected','Request Declined','Your membership request was not approved.')`);
    await sendPushToUser(pool, sql, UserId, { type:'MemberRejected', title:'Request Declined', body:'Your membership request was not approved.', url:'/groups' });
  }
  res.json({rejected:true});
});

r.delete('/:memberId', async (req,res) => {
  const pool=await getPool();
  const memberId=parseInt(req.params.memberId);
  const confirmName=(req.body?.confirmName||'').trim().toLowerCase();
  const target=await pool.request().input('id',sql.Int,memberId)
    .query(`SELECT m.MemberId,m.UserId,m.GroupId,m.Role,m.Status,u.FirstName,u.LastName
            FROM GroupMembers m JOIN Users u ON u.UserId=m.UserId
            WHERE m.MemberId=@id`);
  if(!target.recordset.length) return res.status(404).json({error:'Member not found'});

  const member=target.recordset[0];
  const admin=await pool.request().input('uid',sql.Int,req.user.userId).input('gid',sql.Int,member.GroupId)
    .query(`SELECT Role FROM GroupMembers WHERE UserId=@uid AND GroupId=@gid AND Status='Approved'`);
  if(admin.recordset[0]?.Role!=='Admin') return res.status(403).json({error:'Only group admins can remove members'});
  if(member.Role==='Admin') return res.status(400).json({error:'Group admin cannot be removed'});
  if(member.UserId===req.user.userId) return res.status(400).json({error:'You cannot remove yourself'});

  const expected=`${member.FirstName||''} ${member.LastName||''}`.trim().toLowerCase();
  if(confirmName!==expected) return res.status(400).json({error:'Type the member name exactly to confirm'});

  await pool.request().input('id',sql.Int,memberId)
    .query(`UPDATE GroupMembers SET Status='Removed' WHERE MemberId=@id`);
  await pool.request().input('uid',sql.Int,member.UserId).input('gid',sql.Int,member.GroupId)
    .query(`INSERT INTO Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,'MemberRemoved','Removed from Group','You have been removed from this group.')`);
  await sendPushToUser(pool, sql, member.UserId, { type:'MemberRemoved', title:'Removed from Group', body:'You have been removed from this group.', url:'/groups' });
  res.json({removed:true});
});

r.put('/:memberId/payout-date', async (req,res) => {
  const pool=await getPool();
  const memberId=parseInt(req.params.memberId);
  const target=await memberAdminAccess(pool,memberId,req.user.userId);
  if(!target) return res.status(403).json({error:'Group admin only'});
  const payoutDate=String(req.body?.payoutDate||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(payoutDate)) return res.status(400).json({error:'Choose a valid payout date'});
  if(await payoutDateAlreadyAssigned(pool,target.GroupId,memberId,payoutDate)) return res.status(409).json({error:'This payout date has already been assigned to another member'});
  await pool.request().input('id',sql.Int,memberId).input('d',sql.Date,payoutDate)
    .query('UPDATE GroupMembers SET PayoutDate=@d WHERE MemberId=@id');
  const body=`Your payout date has been assigned for ${new Date(payoutDate+'T00:00:00Z').toLocaleDateString('en-GB')}`;
  await pool.request().input('uid',sql.Int,target.UserId).input('gid',sql.Int,target.GroupId).input('b',sql.NVarChar,body)
    .query(`INSERT INTO Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,'PayoutDateAssigned','Payout Date Assigned',@b)`);
  await sendPushToUser(pool,sql,target.UserId,{type:'PayoutDateAssigned',title:'Payout Date Assigned',body,url:`/group/${target.GroupId}`});
  res.json({updated:true});
});
export default r;
