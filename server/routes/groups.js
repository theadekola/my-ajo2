import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth, requireVerifiedEmail } from '../middleware.js';
import { sendPushToUser } from '../utils/push.js';
import { decryptRecord } from '../utils/fieldCrypto.js';
import { normalizeIconRecord, normalizeIconRecords, normalizeIconValue } from '../utils/iconValues.js';
import crypto from 'crypto';
import { cacheDeletePattern } from '../services/redisService.js';
const r = Router();
r.use(requireAuth);
r.use((req,res,next)=>{ if(['POST','PUT','PATCH','DELETE'].includes(req.method)) res.on('finish',()=>{ if(res.statusCode<400) cacheDeletePattern('dashboard:user:*'); }); next(); });

r.get('/', async (req,res) => {
  const pool = await getPool();
  const result = await pool.request().input('uid',sql.Int,req.user.userId)
    .query(`SELECT s.*,m.SlotNumber,m.Role,m.Status AS MemberStatus,m.PayoutDate
            FROM vw_GroupSummary s JOIN GroupMembers m ON m.GroupId=s.GroupId
            WHERE m.UserId=@uid ORDER BY s.GroupName`);
  res.json(normalizeIconRecords(result.recordset));
});

r.get('/preview/:code', async (req,res) => {
  const pool = await getPool();
  const result = await pool.request().input('c',sql.NVarChar,req.params.code.toUpperCase())
    .query(`SELECT g.*,u.FirstName+' '+u.LastName AS AdminName,
            (SELECT COUNT(*) FROM GroupMembers WHERE GroupId=g.GroupId AND Status='Approved') AS MemberCount
            FROM InviteCodes ic JOIN AjoGroups g ON g.GroupId=ic.GroupId
            JOIN Users u ON u.UserId=g.AdminUserId
            WHERE ic.Code=@c AND ic.IsActive=1`);
  if (!result.recordset.length) return res.status(404).json({ error:'Invalid invite code' });
  res.json(normalizeIconRecord(result.recordset[0]));
});

r.get('/:id', async (req,res) => {
  const pool = await getPool();
  const gid = parseInt(req.params.id);
  const [g,m,pi,viewer] = await Promise.all([
    pool.request().input('gid',sql.Int,gid)
      .query(`SELECT g.GroupId,g.GroupName,g.Icon,g.Frequency,g.Status,g.CountryCode,
              g.CurrencyCode,g.CurrencySymbol,g.ContributionAmount,g.CurrentCycle,
              g.MaxMembers,g.StartDate,g.AdminUserId,
              (SELECT COUNT(*) FROM GroupMembers m WHERE m.GroupId=g.GroupId AND m.Status='Approved') AS MemberCount,
              (SELECT COUNT(DISTINCT c.UserId) FROM Contributions c WHERE c.GroupId=g.GroupId AND c.Status='Confirmed' AND c.CycleNumber=g.CurrentCycle) AS PaidCount,
              ISNULL((SELECT SUM(c.Amount) FROM Contributions c WHERE c.GroupId=g.GroupId AND c.Status='Confirmed' AND c.CycleNumber=g.CurrentCycle),0) AS CollectedThisCycle,
              ISNULL((SELECT SUM(c.Amount) FROM Contributions c WHERE c.GroupId=g.GroupId AND c.Status='Confirmed'),0) AS TotalCollected
              FROM AjoGroups g WHERE g.GroupId=@gid`),
    pool.request().input('gid',sql.Int,gid)
      .query(`SELECT m.MemberId,m.GroupId,m.UserId,m.SlotNumber,m.Role,m.Status,m.PayoutDate,m.JoinedAt,m.ApprovedAt,
              u.FirstName,u.LastName,u.ProfilePicture,u.AvatarColor
              FROM GroupMembers m JOIN Users u ON u.UserId=m.UserId WHERE m.GroupId=@gid ORDER BY m.SlotNumber`),
    pool.request().input('gid',sql.Int,gid).query('SELECT * FROM GroupPaymentInfo WHERE GroupId=@gid'),
    pool.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
      .query(`SELECT g.GroupMembersAnonymous, gm.Role AS ViewerRole
              FROM AjoGroups g
              LEFT JOIN GroupMembers gm ON gm.GroupId=g.GroupId AND gm.UserId=@uid AND gm.Status='Approved'
              WHERE g.GroupId=@gid`)
  ]);
  if (!g.recordset.length) return res.status(404).json({ error:'Group not found' });
  if (!viewer.recordset[0]?.ViewerRole) return res.status(403).json({ error:'Group membership required' });
  const anonymousOn=viewer.recordset[0]?.GroupMembersAnonymous === true || viewer.recordset[0]?.GroupMembersAnonymous === 1;
  const viewerIsAdmin=viewer.recordset[0]?.ViewerRole === 'Admin';
  const members=m.recordset.map(row => {
    if (!anonymousOn || viewerIsAdmin || row.UserId === req.user.userId || row.Role === 'Admin') return { ...row, IsAnonymous: 0 };
    return {
      ...row,
      FirstName: 'Anonymous',
      LastName: `Member #${row.SlotNumber || ''}`.trim(),
      Role: 'Member',
      Email: '',
      ProfilePicture: null,
      AvatarColor: '#2D5040',
      IsAnonymous: 1
    };
  });
  res.json({
    ...normalizeIconRecord(g.recordset[0]),
    GroupMembersAnonymous: anonymousOn,
    members,
    paymentInfo:decryptRecord(pi.recordset[0], ['BankName','AccountNumber','AccountName','RoutingCode','Instructions'])
  });
});

r.post('/', requireVerifiedEmail, async (req,res) => {
  try {
    const { groupName,description,contributionAmount,frequency='Monthly',paymentDayOfWeek,paymentDayOfMonth,maxMembers=10,payoutOrder='Fixed',startDate,icon='home' } = req.body;
    if (!groupName||!contributionAmount) return res.status(400).json({ error:'groupName and contributionAmount required' });
    if (!['Weekly','Monthly'].includes(frequency)) return res.status(400).json({ error:'Frequency must be Weekly or Monthly' });
    if (!startDate || Number.isNaN(Date.parse(startDate))) return res.status(400).json({ error:'Choose a valid start date' });
    const pool = await getPool();
    const admin = await pool.request().input('uid',sql.Int,req.user.userId)
      .query('SELECT CountryCode,CurrencyCode,CurrencySymbol FROM Users WHERE UserId=@uid');
    const { CountryCode,CurrencyCode,CurrencySymbol } = admin.recordset[0];
    const code = groupName.slice(0,6).toUpperCase().replace(/[^A-Z]/g,'X')+'-'+crypto.randomBytes(6).toString('base64url').toUpperCase();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await new sql.Request(transaction)
        .input('n',sql.NVarChar,groupName).input('d',sql.NVarChar,description||null)
        .input('a',sql.Int,req.user.userId).input('cc',sql.Char,CountryCode)
        .input('cu',sql.Char,CurrencyCode).input('sy',sql.NVarChar,CurrencySymbol)
        .input('am',sql.Decimal(18,2),contributionAmount).input('fr',sql.NVarChar,frequency)
        .input('pdw',sql.TinyInt,frequency==='Monthly'?null:Number(paymentDayOfWeek))
        .input('pdm',sql.TinyInt,frequency==='Monthly'?Number(paymentDayOfMonth):null)
        .input('mx',sql.Int,maxMembers).input('po',sql.NVarChar,payoutOrder)
        .input('sd',sql.Date,startDate||new Date()).input('ic',sql.NVarChar,normalizeIconValue(icon, 'home'))
        .input('anon',sql.Bit,0)
        .query(`INSERT INTO AjoGroups(GroupName,Description,AdminUserId,CountryCode,CurrencyCode,CurrencySymbol,ContributionAmount,Frequency,PaymentDayOfWeek,PaymentDayOfMonth,MaxMembers,PayoutOrder,StartDate,Icon,GroupMembersAnonymous)
                OUTPUT INSERTED.GroupId VALUES(@n,@d,@a,@cc,@cu,@sy,@am,@fr,@pdw,@pdm,@mx,@po,@sd,@ic,@anon)`);
      const gid = result.recordset[0].GroupId;
      await new sql.Request(transaction).input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
        .query(`INSERT INTO GroupMembers(GroupId,UserId,SlotNumber,Role,Status,ApprovedAt) VALUES(@gid,@uid,1,'Admin','Approved',SYSUTCDATETIME())`);
      await new sql.Request(transaction).input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId).input('c',sql.NVarChar,code)
        .query('INSERT INTO InviteCodes(GroupId,CreatedBy,Code) VALUES(@gid,@uid,@c)');
      await transaction.commit();
      res.status(201).json({ GroupId:gid, InviteCode:code });
    } catch (error) {
      if (transaction._aborted !== true) await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch(e){ console.error(e); res.status(500).json({ error:'Failed to create group' }); }
});

r.put('/:id/privacy', async (req,res) => {
  try {
    const gid = parseInt(req.params.id, 10);
    if (!Number.isInteger(gid)) return res.status(400).json({ error:'Invalid group' });
    const enabled = req.body?.groupMembersAnonymous ? 1 : 0;
    const pool = await getPool();
    const result = await pool.request()
      .input('gid',sql.Int,gid)
      .input('uid',sql.Int,req.user.userId)
      .input('enabled',sql.Bit,enabled)
      .query(`UPDATE AjoGroups
              SET GroupMembersAnonymous=@enabled
              OUTPUT INSERTED.GroupMembersAnonymous
              WHERE GroupId=@gid AND AdminUserId=@uid`);
    if (!result.recordset.length) {
      return res.status(403).json({ error:'Only this group\'s admin can change its privacy setting' });
    }
    res.json({ updated:true, groupMembersAnonymous: !!result.recordset[0].GroupMembersAnonymous });
  } catch(e){ console.error(e); res.status(500).json({ error:'Could not update group privacy' }); }
});

r.post('/join', async (req,res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('InviteCode',sql.NVarChar,req.body.inviteCode?.trim().toUpperCase())
      .input('UserId',sql.Int,req.user.userId).execute('sp_JoinGroup');
    const row = result.recordset[0];
    // Notify group admin
    const g = await pool.request().input('gid',sql.Int,row.GroupId).query('SELECT AdminUserId FROM AjoGroups WHERE GroupId=@gid');
    if (g.recordset.length) {
      const adminUserId = g.recordset[0].AdminUserId;
      const body = `${req.user.name} wants to join "${row.GroupName}"`;
      await pool.request().input('uid',sql.Int,g.recordset[0].AdminUserId)
        .input('gid',sql.Int,row.GroupId)
        .input('t',sql.NVarChar,'New join request')
        .input('b',sql.NVarChar,body)
        .query('INSERT INTO Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,\'MemberJoined\',@t,@b)');
      await sendPushToUser(pool, sql, adminUserId, { type:'MemberJoined', title:'New join request', body, url:`/group/${row.GroupId}/members` });
    }
    res.json({ joined:true, ...row });
  } catch(e){
    const n=e.number;
    if(n===50010) return res.status(404).json({ error:e.message, code:'INVALID_CODE' });
    if(n===50012) return res.status(403).json({ error:e.message, code:'COUNTRY_MISMATCH' });
    if(n===50014) return res.status(409).json({ error:e.message, code:'ALREADY_MEMBER' });
    if(n===50016) return res.status(409).json({ error:e.message, code:'GROUP_FULL' });
    console.error(e); res.status(500).json({ error:'Failed to join group' });
  }
});

r.get('/:id/statistics', async (req,res) => {
  const pool = await getPool();
  const gid = parseInt(req.params.id);
  const viewer = await pool.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
    .query(`SELECT g.GroupMembersAnonymous, gm.Role AS ViewerRole
            FROM AjoGroups g
            LEFT JOIN GroupMembers gm ON gm.GroupId=g.GroupId AND gm.UserId=@uid AND gm.Status='Approved'
            WHERE g.GroupId=@gid`);
  if(!viewer.recordset[0]?.ViewerRole) return res.status(403).json({error:'Group membership required'});
  const anonymousOn=viewer.recordset[0]?.GroupMembersAnonymous === true || viewer.recordset[0]?.GroupMembersAnonymous === 1;
  const viewerIsAdmin=viewer.recordset[0]?.ViewerRole === 'Admin';
  const adminFlag = viewerIsAdmin ? 1 : 0;
  const [summary,ranking,cycles,contributionStatus,payoutStatus,payoutSummary,memberSummary] = await Promise.all([
    pool.request().input('gid',sql.Int,gid)
      .query(`SELECT g.GroupId,g.GroupName,g.Icon,g.Frequency,g.Status,g.CountryCode,
              g.CurrencyCode,g.CurrencySymbol,g.ContributionAmount,g.CurrentCycle,
              g.MaxMembers,g.StartDate,g.AdminUserId,
              (SELECT COUNT(*) FROM GroupMembers m WHERE m.GroupId=g.GroupId AND m.Status='Approved') AS MemberCount,
              (SELECT COUNT(DISTINCT c.UserId) FROM Contributions c WHERE c.GroupId=g.GroupId AND c.Status='Confirmed' AND c.CycleNumber=g.CurrentCycle) AS PaidCount,
              ISNULL((SELECT SUM(c.Amount) FROM Contributions c WHERE c.GroupId=g.GroupId AND c.Status='Confirmed' AND c.CycleNumber=g.CurrentCycle),0) AS CollectedThisCycle,
              ISNULL((SELECT SUM(c.Amount) FROM Contributions c WHERE c.GroupId=g.GroupId AND c.Status='Confirmed'),0) AS TotalCollected
              FROM AjoGroups g WHERE g.GroupId=@gid`),
    pool.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId).input('admin',sql.Bit,adminFlag)
      .query(`SELECT u.UserId,u.FirstName+' '+u.LastName AS Name,u.ProfilePicture,u.AvatarColor,gm.Role,
              COUNT(*) AS TotalPaid, SUM(c.Amount) AS TotalAmount
              FROM Contributions c JOIN Users u ON u.UserId=c.UserId
              LEFT JOIN GroupMembers gm ON gm.GroupId=c.GroupId AND gm.UserId=u.UserId AND gm.Status='Approved'
              WHERE c.GroupId=@gid AND c.Status='Confirmed' AND (@admin=1 OR c.UserId=@uid)
              GROUP BY u.UserId,u.FirstName,u.LastName,u.ProfilePicture,u.AvatarColor,gm.Role ORDER BY TotalAmount DESC`),
    pool.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId).input('admin',sql.Bit,adminFlag)
      .query(`SELECT CycleNumber,SUM(Amount) AS Total,COUNT(*) AS Count FROM Contributions
              WHERE GroupId=@gid AND Status='Confirmed' AND (@admin=1 OR UserId=@uid)
              GROUP BY CycleNumber ORDER BY CycleNumber`),
    pool.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId).input('admin',sql.Bit,adminFlag)
      .query(`SELECT Status,COUNT(*) AS Count,ISNULL(SUM(Amount),0) AS Total
              FROM Contributions WHERE GroupId=@gid AND (@admin=1 OR UserId=@uid)
              GROUP BY Status ORDER BY Status`),
    pool.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId).input('admin',sql.Bit,adminFlag)
      .query(`SELECT Status,COUNT(*) AS Count,ISNULL(SUM(COALESCE(TotalPayout,Amount)),0) AS Total
              FROM Payouts WHERE GroupId=@gid AND (@admin=1 OR RecipientId=@uid)
              GROUP BY Status ORDER BY Status`),
    pool.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId).input('admin',sql.Bit,adminFlag)
      .query(`SELECT COUNT(*) AS PayoutCount,ISNULL(SUM(COALESCE(TotalPayout,Amount)),0) AS TotalPayout
              FROM Payouts WHERE GroupId=@gid AND (@admin=1 OR RecipientId=@uid)`),
    pool.request().input('gid',sql.Int,gid).input('uid',sql.Int,req.user.userId)
      .query(`SELECT
                COUNT(CASE WHEN c.Status='Confirmed' AND c.CycleNumber=g.CurrentCycle THEN 1 END) AS PaidCount,
                ISNULL(SUM(CASE WHEN c.Status='Confirmed' AND c.CycleNumber=g.CurrentCycle THEN c.Amount END),0) AS CollectedThisCycle,
                ISNULL(SUM(CASE WHEN c.Status='Confirmed' THEN c.Amount END),0) AS TotalCollected
              FROM AjoGroups g
              LEFT JOIN Contributions c ON c.GroupId=g.GroupId AND c.UserId=@uid
              WHERE g.GroupId=@gid
              GROUP BY g.GroupId`)
  ]);
  const baseSummary = summary.recordset[0] || {};
  const payoutTotals = payoutSummary.recordset[0] || {};
  const ownSummary = memberSummary.recordset[0] || {};
  const summaryOut = viewerIsAdmin
    ? { ...baseSummary, Scope:'Group', IsAdmin:true, ViewerRole:'Admin', PayoutCount:payoutTotals.PayoutCount || 0, TotalPayout:payoutTotals.TotalPayout || 0 }
    : {
        ...baseSummary,
        Scope:'Member',
        IsAdmin:false,
        ViewerRole:viewer.recordset[0].ViewerRole,
        MemberCount:1,
        PaidCount:ownSummary.PaidCount || 0,
        CollectedThisCycle:ownSummary.CollectedThisCycle || 0,
        TotalCollected:ownSummary.TotalCollected || 0,
        PayoutCount:payoutTotals.PayoutCount || 0,
        TotalPayout:payoutTotals.TotalPayout || 0
      };
  const rankingRows=ranking.recordset.map((row, index) => {
    if (!anonymousOn || viewerIsAdmin || row.UserId === req.user.userId || row.Role === 'Admin') return row;
    return { ...row, Name: `Anonymous Member #${index + 1}`, ProfilePicture:null, AvatarColor: '#2D5040' };
  });
  res.json({
    summary: summaryOut,
    ranking: rankingRows,
    cycles: cycles.recordset,
    contributionStatus: contributionStatus.recordset,
    payoutStatus: payoutStatus.recordset
  });
});
export default r;
