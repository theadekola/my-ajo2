import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth } from '../middleware.js';
import { ensurePushTable, pushConfigured, sendPushToUser } from '../utils/push.js';

const r = Router();
r.use(requireAuth);

r.get('/public-key', (_req, res) => {
  const nativePlatforms = [];
  if (process.env.FCM_PROJECT_ID && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY) nativePlatforms.push('android');
  if (process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY) nativePlatforms.push('ios');
  res.json({
    enabled: pushConfigured,
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    nativeEnabled: nativePlatforms.length > 0,
    nativePlatforms,
  });
});

r.post('/subscribe', async (req, res) => {
  if (!pushConfigured) return res.status(400).json({ error: 'Push is not configured on the server.' });
  const { subscription, userAgent } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid push subscription.' });
  }

  const pool = await getPool();
  await ensurePushTable(pool);
  await pool.request()
    .input('uid', sql.Int, req.user.userId)
    .input('ep', sql.NVarChar, subscription.endpoint)
    .input('p256dh', sql.NVarChar, subscription.keys.p256dh)
    .input('auth', sql.NVarChar, subscription.keys.auth)
    .input('ua', sql.NVarChar, (userAgent || '').slice(0, 300))
    .query(`
      UPDATE PushSubscriptions SET Enabled=0,UpdatedAt=SYSUTCDATETIME()
      WHERE UserId=@uid AND Endpoint=@ep;

      INSERT INTO PushSubscriptions(UserId,Endpoint,P256dh,Auth,UserAgent,Enabled,SubscriptionType)
      VALUES(@uid,@ep,@p256dh,@auth,@ua,1,'web');
    `);
  res.json({ subscribed: true });
});

r.post('/native-subscribe', async (req, res) => {
  const { token, platform, userAgent } = req.body || {};
  const deviceToken = String(token || '').trim();
  if (!deviceToken) return res.status(400).json({ error: 'Invalid device token.' });

  const pool = await getPool();
  await ensurePushTable(pool);
  await pool.request()
    .input('uid', sql.Int, req.user.userId)
    .input('token', sql.NVarChar, deviceToken)
    .input('platform', sql.NVarChar, String(platform || '').slice(0, 30))
    .input('endpoint', sql.NVarChar, `native:${String(platform || 'app')}:${deviceToken}`)
    .input('ua', sql.NVarChar, (userAgent || '').slice(0, 300))
    .query(`
      UPDATE PushSubscriptions SET Enabled=0,UpdatedAt=SYSUTCDATETIME()
      WHERE UserId=@uid AND SubscriptionType='native' AND DeviceToken=@token;

      INSERT INTO PushSubscriptions(UserId,Endpoint,P256dh,Auth,UserAgent,Enabled,SubscriptionType,Platform,DeviceToken)
      VALUES(@uid,@endpoint,'','',@ua,1,'native',@platform,@token);
    `);
  res.json({ subscribed: true });
});

r.post('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body || {};
  const pool = await getPool();
  await ensurePushTable(pool);
  await pool.request()
    .input('uid', sql.Int, req.user.userId)
    .input('ep', sql.NVarChar, endpoint || '')
    .query('UPDATE PushSubscriptions SET Enabled=0,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@uid AND (@ep=\'\' OR Endpoint=@ep)');
  res.json({ unsubscribed: true });
});

r.post('/native-unsubscribe', async (req, res) => {
  const { token, platform } = req.body || {};
  const pool = await getPool();
  await ensurePushTable(pool);
  await pool.request()
    .input('uid', sql.Int, req.user.userId)
    .input('token', sql.NVarChar, String(token || '').trim())
    .input('platform', sql.NVarChar, String(platform || '').slice(0, 30))
    .query(`
      UPDATE PushSubscriptions SET Enabled=0,UpdatedAt=SYSUTCDATETIME()
      WHERE UserId=@uid
        AND SubscriptionType='native'
        AND (@token='' OR DeviceToken=@token)
        AND (@platform='' OR Platform=@platform)
    `);
  res.json({ unsubscribed: true });
});

r.post('/test', async (req, res) => {
  const pool = await getPool();
  await sendPushToUser(pool, sql, req.user.userId, {
    type: 'Default',
    title: 'My Ajo notifications are on',
    body: 'You will receive alerts for the settings you enabled.',
    url: '/notifications'
  });
  res.json({ sent: true });
});

export default r;
