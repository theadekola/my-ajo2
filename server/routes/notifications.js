import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth } from '../middleware.js';
const r = Router();
r.use(requireAuth);
r.get('/', async (req,res) => {
  const p=await getPool();
  const result=await p.request().input('uid',sql.Int,req.user.userId)
    .query(`SELECT TOP 50 n.*,g.GroupName FROM Notifications n
            LEFT JOIN AjoGroups g ON g.GroupId=n.GroupId
            WHERE n.UserId=@uid ORDER BY n.CreatedAt DESC`);
  res.json(result.recordset);
});
r.put('/:id/read', async (req,res) => {
  const p=await getPool();
  await p.request().input('id',sql.Int,parseInt(req.params.id))
    .input('uid',sql.Int,req.user.userId)
    .query('UPDATE Notifications SET IsRead=1 WHERE NotificationId=@id AND UserId=@uid');
  res.json({read:true});
});
r.put('/read-all', async (req,res) => {
  const p=await getPool();
  await p.request().input('uid',sql.Int,req.user.userId)
    .query('UPDATE Notifications SET IsRead=1 WHERE UserId=@uid');
  res.json({read:true});
});
export default r;
