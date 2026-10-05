import { EventEmitter } from 'events';
import { getPool, sql } from '../db.js';
import { publishActivity, subscribeActivity } from './redisService.js';

const stream = new EventEmitter();
stream.setMaxListeners(500);

export async function createActivity({
  eventType, category, title, description = null, userId = null, groupId = null,
  entityId = null, entityType = null, amount = null, currency = null,
  severity = 'info', isPublic = false, isAdminOnly = false,
}) {
  const pool = await getPool();
  const result = await pool.request()
    .input('eventType', sql.NVarChar(100), eventType)
    .input('category', sql.NVarChar(50), category)
    .input('title', sql.NVarChar(200), title)
    .input('description', sql.NVarChar(500), description)
    .input('userId', sql.Int, userId)
    .input('groupId', sql.Int, groupId)
    .input('entityId', sql.BigInt, entityId)
    .input('entityType', sql.NVarChar(100), entityType)
    .input('amount', sql.Decimal(18, 2), amount)
    .input('currency', sql.NVarChar(10), currency)
    .input('severity', sql.NVarChar(20), severity)
    .input('isPublic', sql.Bit, !!isPublic)
    .input('isAdminOnly', sql.Bit, !!isAdminOnly)
    .query(`INSERT INTO dbo.ActivityEvents
      (EventType,Category,Title,Description,UserId,GroupId,RelatedEntityId,RelatedEntityType,Amount,Currency,Severity,IsPublic,IsAdminOnly)
      OUTPUT INSERTED.*
      VALUES (@eventType,@category,@title,@description,@userId,@groupId,@entityId,@entityType,@amount,@currency,@severity,@isPublic,@isAdminOnly)`);
  const event = result.recordset[0];
  stream.emit('activity', event);
  await publishActivity(event);
  return event;
}

subscribeActivity(event => stream.emit('activity', event)).catch(() => {});

export function subscribeToActivity(listener) {
  stream.on('activity', listener);
  return () => stream.off('activity', listener);
}

export function canReceiveActivity(event, user) {
  if (user.systemRole === 'Admin') return true;
  if (event.IsAdminOnly) return false;
  return event.IsPublic || Number(event.UserId) === Number(user.userId);
}
