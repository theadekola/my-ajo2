import { cacheDeletePattern } from '../services/redisService.js';
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth } from '../middleware.js';
const r = Router();
r.use(requireAuth);
r.get('/', async (req,res) => {
  const p=await getPool();
  const offset=Math.max(0,Math.min(1000000,parseInt(req.query.offset,10)||0));
  const result=await p.request().input('uid',sql.Int,req.user.userId).input('offset',sql.Int,offset)
    .query(`SELECT n.*,g.GroupName FROM Notifications n
            LEFT JOIN AjoGroups g ON g.GroupId=n.GroupId
            WHERE n.UserId=@uid ORDER BY n.CreatedAt DESC,n.NotificationId DESC OFFSET @offset ROWS FETCH NEXT 50 ROWS ONLY;
            SELECT COUNT(*) Unread FROM Notifications WHERE UserId=@uid AND IsRead=0`);
  if(req.query.paged==='1')return res.json({items:result.recordsets[0],unread:Number(result.recordsets[1][0].Unread),hasMore:result.recordsets[0].length===50});
  res.json(result.recordsets[0]);
});
r.put('/:id/read', async (req,res) => {
  const p=await getPool();
  await p.request().input('id',sql.Int,parseInt(req.params.id))
    .input('uid',sql.Int,req.user.userId)
    .query('UPDATE Notifications SET IsRead=1 WHERE NotificationId=@id AND UserId=@uid');
  await cacheDeletePattern(`dashboard:user:${req.user.userId}`).catch(()=>{});
  res.json({read:true});
});
r.put('/read-all', async (req,res) => {
  const p=await getPool();
  await p.request().input('uid',sql.Int,req.user.userId)
    .query('UPDATE Notifications SET IsRead=1 WHERE UserId=@uid');
  await cacheDeletePattern(`dashboard:user:${req.user.userId}`).catch(()=>{});
  res.json({read:true});
});
export default r;
