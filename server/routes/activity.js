import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth } from '../middleware.js';
import { canReceiveActivity, subscribeToActivity, redactActivity } from '../services/activityService.js';

const r = Router();
r.use(requireAuth);

r.get('/', async (req, res) => {
  const pool = await getPool();
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
  const request = pool.request().input('uid', sql.Int, req.user.userId).input('limit', sql.Int, limit);
  const where = [];
  {
    where.push(`e.IsAdminOnly=0 AND (e.IsPublic=1 OR e.UserId=@uid OR e.GroupId IN
      (SELECT GroupId FROM dbo.GroupMembers WHERE UserId=@uid AND Status='Approved'))`);
  }
  if (req.query.category) { request.input('category', sql.NVarChar(50), String(req.query.category)); where.push('e.Category=@category'); }
  if (req.query.groupId) { request.input('groupId', sql.Int, parseInt(req.query.groupId, 10)); where.push('e.GroupId=@groupId'); }
  if (req.query.severity) { request.input('severity', sql.NVarChar(20), String(req.query.severity)); where.push('e.Severity=@severity'); }
  const result = await request.query(`SELECT TOP (@limit) e.*, g.GroupName,g.GroupMembersAnonymous,viewer.Role ViewerRole
    FROM dbo.ActivityEvents e LEFT JOIN dbo.AjoGroups g ON g.GroupId=e.GroupId LEFT JOIN dbo.GroupMembers viewer ON viewer.GroupId=e.GroupId AND viewer.UserId=@uid AND viewer.Status='Approved'
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY e.CreatedAt DESC`);
  res.json({items:result.recordset.map(({GroupMembersAnonymous,ViewerRole,...event})=>redactActivity(event,req.user.userId,{anonymous:!!GroupMembersAnonymous,groupAdmin:ViewerRole==='Admin'}))});
});

r.get('/stream', async (req, res) => {
  const requestedGroupId = req.query.groupId ? parseInt(req.query.groupId, 10) : null;
  let groupViewerIsAdmin = false;
  let anonymous=false;
  if (requestedGroupId) {
    const pool = await getPool();
    const membership = await pool.request().input('uid',sql.Int,req.user.userId).input('gid',sql.Int,requestedGroupId)
      .query(`SELECT gm.Role,g.GroupMembersAnonymous FROM dbo.GroupMembers gm JOIN dbo.AjoGroups g ON g.GroupId=gm.GroupId WHERE gm.UserId=@uid AND gm.GroupId=@gid AND gm.Status='Approved'`);
    if (!membership.recordset[0]) return res.status(403).json({error:'Group membership required'});
    groupViewerIsAdmin = membership.recordset[0]?.Role === 'Admin';
    anonymous=!!membership.recordset[0]?.GroupMembersAnonymous;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`);
  const unsubscribe = subscribeToActivity(event => {
    const belongsToRequestedGroup = !requestedGroupId || Number(event.GroupId) === requestedGroupId;
    const visibleInRequestedGroup = requestedGroupId && belongsToRequestedGroup && !event.IsAdminOnly;
    if (belongsToRequestedGroup && (visibleInRequestedGroup || canReceiveActivity(event, req.user))) {
      res.write(`event: activity\ndata: ${JSON.stringify(redactActivity(event,req.user.userId,{anonymous,groupAdmin:groupViewerIsAdmin}))}\n\n`);
    }
  });
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
});

export default r;
