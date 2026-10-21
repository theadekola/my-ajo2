import { sql } from '../db.js';
import { sendPushToUser } from '../utils/push.js';
let delivering=false;
export async function enqueuePush(connection,userId,payload){
  await connection.request().input('uid',sql.Int,userId).input('payload',sql.NVarChar(sql.MAX),JSON.stringify(payload)).query('INSERT dbo.PushOutbox(UserId,Payload) VALUES(@uid,@payload)');
}
export async function deliverPushOutbox(pool){
  if(delivering)return;delivering=true;
  try {
    // A lease prevents concurrent workers from delivering the same claim.
    const batch=await pool.request().query(`UPDATE TOP (20) dbo.PushOutbox WITH (UPDLOCK,READPAST,ROWLOCK)
      SET NextAttemptAt=DATEADD(minute,2,SYSUTCDATETIME()),Attempts=Attempts+1
      OUTPUT INSERTED.OutboxId,INSERTED.UserId,INSERTED.Payload
      WHERE DeliveredAt IS NULL AND NextAttemptAt<=SYSUTCDATETIME()`);
    for(const row of batch.recordset){
      try {await sendPushToUser(pool,sql,row.UserId,JSON.parse(row.Payload),{throwOnFailure:true});await pool.request().input('id',sql.BigInt,row.OutboxId).query('UPDATE dbo.PushOutbox SET DeliveredAt=SYSUTCDATETIME(),LastError=NULL WHERE OutboxId=@id');}
      catch(error){await pool.request().input('id',sql.BigInt,row.OutboxId).input('error',sql.NVarChar(500),String(error.message).slice(0,500)).query('UPDATE dbo.PushOutbox SET LastError=@error,NextAttemptAt=DATEADD(minute,15,SYSUTCDATETIME()) WHERE OutboxId=@id');}
    }
  } catch(error){console.error('Push delivery deferred',error.message);} finally{delivering=false;}
}
