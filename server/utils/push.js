import webpush from 'web-push';
import crypto from 'node:crypto';
import http2 from 'node:http2';

const publicKey = process.env.VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || process.env.APP_BASE_URL || 'mailto:support@myajo.app';

export let pushConfigured = false;

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    pushConfigured = true;
  } catch (error) {
    console.error(`Web push disabled: ${error.message}`);
  }
}

export async function ensurePushTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.PushSubscriptions') IS NULL
    CREATE TABLE dbo.PushSubscriptions (
      PushSubscriptionId INT IDENTITY(1,1) PRIMARY KEY,
      UserId INT NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
      Endpoint NVARCHAR(1000) NOT NULL,
      P256dh NVARCHAR(255) NOT NULL,
      Auth NVARCHAR(255) NOT NULL,
      UserAgent NVARCHAR(300) NULL,
      Enabled BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    IF COL_LENGTH('dbo.PushSubscriptions', 'SubscriptionType') IS NULL
      ALTER TABLE dbo.PushSubscriptions ADD SubscriptionType NVARCHAR(20) NOT NULL CONSTRAINT DF_PushSubscriptions_SubscriptionType DEFAULT 'web';

    IF COL_LENGTH('dbo.PushSubscriptions', 'Platform') IS NULL
      ALTER TABLE dbo.PushSubscriptions ADD Platform NVARCHAR(30) NULL;

    IF COL_LENGTH('dbo.PushSubscriptions', 'DeviceToken') IS NULL
      ALTER TABLE dbo.PushSubscriptions ADD DeviceToken NVARCHAR(1000) NULL;
  `);
}

function prefColumn(type) {
  if (['PaymentSubmitted', 'PaymentConfirmed', 'PaymentRejected'].includes(type)) return 'NotifPayment';
  if (['PayoutScheduled', 'PayoutPaid', 'PayoutCancelled'].includes(type)) return 'NotifPayout';
  if (['MemberJoined', 'MemberApproved', 'MemberRejected'].includes(type)) return 'NotifMember';
  if (type === 'Chat') return 'NotifChat';
  return null;
}

export async function sendPushToUser(pool, sql, userId, payload) {
  if (!userId) return;

  await ensurePushTable(pool);

  const pref = prefColumn(payload.type);
  const prefCheck = pref ? `AND u.${pref}=1` : '';
  const result = await pool.request()
    .input('uid', sql.Int, userId)
    .query(`
      SELECT ps.PushSubscriptionId, ps.Endpoint, ps.P256dh, ps.Auth
      FROM PushSubscriptions ps
      JOIN Users u ON u.UserId=ps.UserId
      WHERE ps.UserId=@uid AND ps.Enabled=1 AND ISNULL(ps.SubscriptionType,'web')='web' ${prefCheck}
    `);

  if (pushConfigured) await Promise.all(result.recordset.map(async row => {
    try {
      await webpush.sendNotification({
        endpoint: row.Endpoint,
        keys: { p256dh: row.P256dh, auth: row.Auth }
      }, JSON.stringify({
        title: payload.title || 'My Ajo',
        body: payload.body || '',
        url: payload.url || payload.link || '/notifications',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        type: payload.type || 'Default'
      }));
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) {
        await pool.request()
          .input('id', sql.Int, row.PushSubscriptionId)
          .query('UPDATE PushSubscriptions SET Enabled=0,UpdatedAt=SYSUTCDATETIME() WHERE PushSubscriptionId=@id');
      } else {
        console.error('Push send failed', error.message);
      }
    }
  }));

  await sendNativePushToUser(pool, sql, userId, payload, prefCheck);
}

async function sendNativePushToUser(pool, sql, userId, payload, prefCheck) {
  const projectId = String(process.env.FCM_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.FCM_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const fcmConfigured = Boolean(projectId && clientEmail && privateKey);
  const apnsConfigured = Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY);
  if (!fcmConfigured && !apnsConfigured) return;

  const result = await pool.request()
    .input('uid', sql.Int, userId)
    .query(`
      SELECT ps.PushSubscriptionId, ps.Platform, ps.DeviceToken
      FROM PushSubscriptions ps
      JOIN Users u ON u.UserId=ps.UserId
      WHERE ps.UserId=@uid
        AND ps.Enabled=1
        AND ps.SubscriptionType='native'
        AND ps.DeviceToken IS NOT NULL
        ${prefCheck}
    `);

  await Promise.all(result.recordset.map(async row => {
    try {
      if (String(row.Platform).toLowerCase() === 'ios') {
        if (!apnsConfigured) return;
        await sendApnsNotification(row.DeviceToken, payload);
        return;
      }
      if (!fcmConfigured) return;
      const accessToken = await getFirebaseAccessToken({ clientEmail, privateKey });
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: row.DeviceToken,
            notification: {
              title: payload.title || 'My Ajo',
              body: payload.body || '',
            },
            data: {
              url: String(payload.url || payload.link || '/notifications'),
              type: String(payload.type || 'Default'),
            },
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`FCM ${response.status} ${text}`.trim());
      }
    } catch (error) {
      console.error('Native push send failed', error.message);
    }
  }));
}

let apnsTokenCache = { value: '', expiresAt: 0 };

function getApnsToken() {
  if (apnsTokenCache.value && apnsTokenCache.expiresAt > Date.now() + 60_000) return apnsTokenCache.value;
  const keyId = String(process.env.APNS_KEY_ID || '').trim();
  const teamId = String(process.env.APNS_TEAM_ID || '').trim();
  const privateKey = String(process.env.APNS_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (!keyId || !teamId || !privateKey) throw new Error('APNs credentials are not configured');
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = base64Url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign('sha256', Buffer.from(unsigned), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  apnsTokenCache = { value: `${unsigned}.${signature}`, expiresAt: Date.now() + 50 * 60_000 };
  return apnsTokenCache.value;
}

async function sendApnsNotification(deviceToken, payload) {
  const origin = String(process.env.APNS_PRODUCTION || '').toLowerCase() === 'true'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';
  const bundleId = String(process.env.APNS_BUNDLE_ID || 'com.myajo.app').trim();
  const client = http2.connect(origin);
  await new Promise((resolve, reject) => {
    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${encodeURIComponent(deviceToken)}`,
      authorization: `bearer ${getApnsToken()}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });
    let responseBody = '';
    let status = 0;
    request.setEncoding('utf8');
    request.on('response', headers => { status = Number(headers[':status'] || 0); });
    request.on('data', chunk => { responseBody += chunk; });
    request.on('end', () => status >= 200 && status < 300 ? resolve() : reject(new Error(`APNs ${status} ${responseBody}`.trim())));
    request.on('error', reject);
    request.end(JSON.stringify({
      aps: { alert: { title: payload.title || 'My Ajo', body: payload.body || '' }, sound: 'default' },
      url: String(payload.url || payload.link || '/notifications'),
      type: String(payload.type || 'Default'),
    }));
  }).finally(() => client.close());
}

let firebaseTokenCache = { value: '', expiresAt: 0 };

const base64Url = value => Buffer.from(value).toString('base64url');

async function getFirebaseAccessToken({ clientEmail, privateKey }) {
  if (firebaseTokenCache.value && firebaseTokenCache.expiresAt > Date.now() + 60_000) return firebaseTokenCache.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error(result.error_description || 'Could not authenticate with Firebase Cloud Messaging');
  firebaseTokenCache = { value: result.access_token, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 };
  return firebaseTokenCache.value;
}
