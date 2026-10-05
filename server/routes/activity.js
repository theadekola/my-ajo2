import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth } from '../middleware.js';
import { canReceiveActivity, subscribeToActivity } from '../services/activityService.js';

const r = Router();
r.use(requireAuth);

r.get('/', async (req, res) => {
  const pool = await getPool();
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
  const request = pool.request().input('uid', sql.Int, req.user.userId).input('limit', sql.Int, limit);
  const where = [];
  if (req.user.systemRole !== 'Admin') {
    where.push(`e.IsAdminOnly=0 AND (e.IsPublic=1 OR e.UserId=@uid OR e.GroupId IN
      (SELECT GroupId FROM dbo.GroupMembers WHERE UserId=@uid AND Status='Approved'))`);
  }
  if (req.query.category) { request.input('category', sql.NVarChar(50), String(req.query.category)); where.push('e.Category=@category'); }
  if (req.query.groupId) { request.input('groupId', sql.Int, parseInt(req.query.groupId, 10)); where.push('e.GroupId=@groupId'); }
  if (req.query.severity) { request.input('severity', sql.NVarChar(20), String(req.query.severity)); where.push('e.Severity=@severity'); }
  const result = await request.query(`SELECT TOP (@limit) e.*, g.GroupName
    FROM dbo.ActivityEvents e LEFT JOIN dbo.AjoGroups g ON g.GroupId=e.GroupId
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY e.CreatedAt DESC`);
  res.json({ items: result.recordset });
});

r.get('/stream', async (req, res) => {
  const requestedGroupId = req.query.groupId ? parseInt(req.query.groupId, 10) : null;
  let groupViewerIsAdmin = false;
  if (requestedGroupId) {
    const pool = await getPool();
    const membership = await pool.request().input('uid',sql.Int,req.user.userId).input('gid',sql.Int,requestedGroupId)
      .query(`SELECT Role FROM dbo.GroupMembers WHERE UserId=@uid AND GroupId=@gid AND Status='Approved'`);
    if (!membership.recordset[0] && req.user.systemRole !== 'Admin') return res.status(403).json({error:'Group membership required'});
    groupViewerIsAdmin = req.user.systemRole === 'Admin' || membership.recordset[0]?.Role === 'Admin';
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`);
  const unsubscribe = subscribeToActivity(event => {
    const belongsToRequestedGroup = !requestedGroupId || Number(event.GroupId) === requestedGroupId;
    const visibleInRequestedGroup = requestedGroupId && belongsToRequestedGroup && (!event.IsAdminOnly || groupViewerIsAdmin);
    if (belongsToRequestedGroup && (visibleInRequestedGroup || canReceiveActivity(event, req.user))) {
      res.write(`event: activity\ndata: ${JSON.stringify(event)}\n\n`);
    }
  });
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
});

export default r;
