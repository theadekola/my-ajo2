import { Router } from 'express';
import crypto from 'crypto';
import { getPool, sql } from '../db.js';
import { requireAuth } from '../middleware.js';
import { blindIndex, decryptValue, encryptValue } from '../utils/fieldCrypto.js';
import { sendPushToUser } from '../utils/push.js';

const r = Router();
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function paystackSecret() {
  return String(process.env.PAYSTACK_SECRET_KEY || '').trim();
}

function paystackWebhookSecrets() {
  return [process.env.PAYSTACK_WEBHOOK_SECRET, process.env.PAYSTACK_SECRET_KEY]
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

function publicBaseUrl(req) {
  return String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function makeReference(groupId, userId) {
  return `MYAJO-${groupId}-${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
}

async function paystackRequest(path, options = {}) {
  const secret = paystackSecret();
  if (!secret) {
    const error = new Error('Paystack is not configured yet. Add PAYSTACK_SECRET_KEY to the server .env file.');
    error.status = 503;
    throw error;
  }
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === false) {
    const error = new Error(data.message || `Paystack request failed (${response.status})`);
    error.status = response.status || 502;
    throw error;
  }
  return data.data;
}

async function recordConfirmedContribution(reference, paystackData = {}) {
  const pool = await getPool();
  const referenceHash = blindIndex(reference, 'paystack-reference');
  const channel = paystackData.channel || paystackData.authorization?.channel || null;
  const gatewayId = paystackData.id ? String(paystackData.id) : null;
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  let row;
  let contributionId;
  let group = {};
  try {
    const paymentResult = await new sql.Request(transaction).input('hash', sql.Char(64), referenceHash)
      .query(`SELECT TOP 1 p.*,u.Email,g.AdminUserId,g.GroupName
              FROM PaystackPayments p WITH (UPDLOCK,ROWLOCK)
              JOIN Users u ON u.UserId=p.UserId
              JOIN AjoGroups g ON g.GroupId=p.GroupId
              WHERE p.ReferenceHash=@hash`);
    row = paymentResult.recordset[0];
    if (!row) {
      await transaction.rollback();
      return { ok: false, reason: 'Payment reference not found' };
    }
    if (row.ContributionId) {
      await transaction.commit();
      return { ok: true, contributionId: row.ContributionId, alreadyProcessed: true };
    }

    const metadata = paystackData.metadata || {};
    const gatewayAmount = Number(paystackData.amount);
    const expectedAmount = Math.round(Number(row.Amount) * 100);
    const gatewayEmail = String(paystackData.customer?.email || '').trim().toLowerCase();
    const expectedEmail = String(row.Email || '').trim().toLowerCase();
    const valid = paystackData.status === 'success'
      && Number.isSafeInteger(gatewayAmount) && gatewayAmount === expectedAmount
      && String(paystackData.currency || '').toUpperCase() === String(row.Currency || '').toUpperCase()
      && gatewayEmail && gatewayEmail === expectedEmail
      && Number(metadata.groupId) === Number(row.GroupId)
      && Number(metadata.userId) === Number(row.UserId)
      && Number(metadata.cycleNumber) === Number(row.CycleNumber)
      && String(metadata.paymentType || '') === 'Contribution';
    if (!valid) {
      const error = new Error('Paystack payment details do not match the local contribution');
      error.status = 409;
      throw error;
    }

    const claim = await new sql.Request(transaction).input('hash', sql.Char(64), referenceHash)
      .query("UPDATE PaystackPayments WITH (ROWLOCK) SET Status='Processing', UpdatedAt=SYSUTCDATETIME() OUTPUT INSERTED.PaymentId WHERE ReferenceHash=@hash AND Status='Pending' AND ContributionId IS NULL");
    if (!claim.recordset[0]) {
      const error = new Error('Payment is already being processed');
      error.status = 409;
      throw error;
    }
    group = { AdminUserId: row.AdminUserId, GroupName: row.GroupName };

    const contributionNote = row.Note ? decryptValue(row.Note) : null;
    const inserted = await new sql.Request(transaction)
    .input('gid', sql.Int, row.GroupId)
    .input('uid', sql.Int, row.UserId)
    .input('cy', sql.Int, row.CycleNumber)
    .input('am', sql.Decimal(18,2), row.Amount)
    .input('me', sql.NVarChar, 'Paystack')
    .input('re', sql.NVarChar, encryptValue(reference))
    .input('no', sql.NVarChar, contributionNote ? encryptValue(contributionNote) : null)
    .query(`INSERT INTO Contributions(GroupId,UserId,CycleNumber,Amount,Method,ReferenceNo,Note,Status,ReviewedAt,PaidAt)
            OUTPUT INSERTED.ContributionId
            VALUES(@gid,@uid,@cy,@am,@me,@re,@no,'Confirmed',SYSUTCDATETIME(),SYSUTCDATETIME())`);
    contributionId = inserted.recordset[0].ContributionId;

    await new sql.Request(transaction)
    .input('hash', sql.Char(64), referenceHash)
    .input('cid', sql.Int, contributionId)
    .input('ch', sql.NVarChar, channel)
    .input('tid', sql.NVarChar, gatewayId)
      .query("UPDATE PaystackPayments SET ContributionId=@cid, Status='Success', Channel=@ch, PaystackTransactionId=@tid, PaidAt=SYSUTCDATETIME(), UpdatedAt=SYSUTCDATETIME() WHERE ReferenceHash=@hash AND Status='Processing'");

    await new sql.Request(transaction)
    .input('uid', sql.Int, row.UserId)
    .input('gid', sql.Int, row.GroupId)
      .query(`INSERT INTO Notifications(UserId,GroupId,Type,Title,Body)
            VALUES(@uid,@gid,'PaymentConfirmed','Payment Confirmed','Your Paystack contribution has been received and confirmed.')`);
    if (group.AdminUserId && group.AdminUserId !== row.UserId) {
      const body = `A Paystack payment was received for ${group.GroupName || 'your group'}.`;
      await new sql.Request(transaction).input('uid', sql.Int, group.AdminUserId).input('gid', sql.Int, row.GroupId).input('b', sql.NVarChar, body)
        .query(`INSERT INTO Notifications(UserId,GroupId,Type,Title,Body) VALUES(@uid,@gid,'PaymentSubmitted','Paystack Payment Received',@b)`);
    }
    await transaction.commit();
  } catch (error) {
    if (transaction._aborted !== true) await transaction.rollback().catch(() => {});
    throw error;
  }

  await sendPushToUser(pool, sql, row.UserId, { type:'PaymentConfirmed', title:'Payment Confirmed', body:'Your Paystack contribution has been received and confirmed.', url:`/group/${row.GroupId}/contributions` });

  if (group.AdminUserId && group.AdminUserId !== row.UserId) {
    const body = `A Paystack payment was received for ${group.GroupName || 'your group'}.`;
    await sendPushToUser(pool, sql, group.AdminUserId, { type:'PaymentSubmitted', title:'Paystack Payment Received', body, url:`/group/${row.GroupId}/payments` });
  }

  return { ok: true, contributionId };
}

r.post('/initialize', requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.body.groupId, 10);
    const note = String(req.body.note || '').trim();
    if (!groupId) return res.status(400).json({ error: 'Valid groupId is required' });

    const pool = await getPool();
    const result = await pool.request()
      .input('gid', sql.Int, groupId)
      .input('uid', sql.Int, req.user.userId)
      .query(`SELECT g.GroupId,g.GroupName,g.CurrentCycle,g.ContributionAmount,g.CurrencyCode,g.CurrencySymbol,u.Email,u.FirstName,u.LastName
              FROM AjoGroups g
              JOIN GroupMembers gm ON gm.GroupId=g.GroupId AND gm.UserId=@uid AND gm.Status='Approved'
              JOIN Users u ON u.UserId=@uid
              WHERE g.GroupId=@gid`);
    const row = result.recordset[0];
    if (!row) return res.status(403).json({ error: 'Group membership required' });
    const amount = Number(row.ContributionAmount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(409).json({ error: 'This group does not have a valid contribution amount' });

    const reference = makeReference(groupId, req.user.userId);
    const currency = String(row.CurrencyCode || 'NGN').toUpperCase();
    const callbackUrl = `${publicBaseUrl(req)}/group/${groupId}/pay?paystack_reference=${encodeURIComponent(reference)}`;
    const paystack = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: row.Email || req.user.email,
        amount: Math.round(amount * 100),
        currency,
        reference,
        callback_url: callbackUrl,
        metadata: {
          app: 'My Ajo',
          paymentType: 'Contribution',
          groupId,
          groupName: row.GroupName,
          userId: req.user.userId,
          cycleNumber: row.CurrentCycle,
          note
        }
      })
    });

    await pool.request()
      .input('gid', sql.Int, groupId)
      .input('uid', sql.Int, req.user.userId)
      .input('cy', sql.Int, row.CurrentCycle || 1)
      .input('ref', sql.NVarChar, encryptValue(reference))
      .input('hash', sql.Char(64), blindIndex(reference,'paystack-reference'))
      .input('am', sql.Decimal(18,2), amount)
      .input('cur', sql.NVarChar, currency)
      .input('url', sql.NVarChar, paystack.authorization_url)
      .input('code', sql.NVarChar, paystack.access_code)
      .input('note', sql.NVarChar, encryptValue(note))
      .query(`INSERT INTO PaystackPayments(GroupId,UserId,CycleNumber,Reference,ReferenceHash,Amount,Currency,AuthorizationUrl,AccessCode,Note)
              VALUES(@gid,@uid,@cy,@ref,@hash,@am,@cur,@url,@code,@note)`);

    res.json({ authorizationUrl: paystack.authorization_url, accessCode: paystack.access_code, reference, currency });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Could not start Paystack payment' });
  }
});

r.get('/verify/:reference', requireAuth, async (req, res) => {
  try {
    const reference = String(req.params.reference || '').trim();
    const pool = await getPool();
    const local = await pool.request().input('hash', sql.Char(64), blindIndex(reference, 'paystack-reference')).input('uid', sql.Int, req.user.userId)
      .query(`SELECT TOP 1 p.PaymentId
              FROM PaystackPayments p
              WHERE p.ReferenceHash=@hash AND (p.UserId=@uid OR EXISTS (
                SELECT 1 FROM GroupMembers gm WHERE gm.GroupId=p.GroupId AND gm.UserId=@uid AND gm.Status='Approved' AND gm.Role='Admin'
              ))`);
    if (!local.recordset[0]) return res.status(404).json({ error: 'Payment not found' });
    const data = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    if (data.status !== 'success') return res.status(400).json({ error: `Payment is ${data.status || 'not successful yet'}` });
    const result = await recordConfirmedContribution(reference, data);
    if (!result.ok) return res.status(404).json({ error: result.reason || 'Payment not found' });
    res.json({ verified: true, contributionId: result.contributionId, alreadyProcessed: !!result.alreadyProcessed });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Could not verify Paystack payment' });
  }
});

r.post('/webhook', async (req, res) => {
  let gatewayEventId = null;
  try {
    const signature = String(req.get('x-paystack-signature') || '');
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const valid = paystackWebhookSecrets().some(secret => crypto.createHmac('sha512', secret).update(rawBody).digest('hex') === signature);
    if (!valid) return res.status(401).json({ error: 'Invalid webhook signature' });

    const event = req.body || {};
    if (!event.event || !event.data) return res.status(400).json({ error: 'Malformed webhook event' });
    const pool = await getPool();
    const transactionId = event.data?.id == null ? null : String(event.data.id);
    gatewayEventId = `${event.event}:${transactionId || event.data?.reference || crypto.createHash('sha256').update(rawBody).digest('hex')}`;
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    const referenceHash = event.data?.reference ? blindIndex(String(event.data.reference), 'paystack-reference') : null;
    const stored = await pool.request().input('eid', sql.NVarChar, gatewayEventId).input('type', sql.NVarChar, String(event.event))
      .input('tid', sql.NVarChar, transactionId).input('ref', sql.Char(64), referenceHash).input('payload', sql.Char(64), payloadHash)
      .query(`IF NOT EXISTS (SELECT 1 FROM PaystackWebhookEvents WITH (UPDLOCK,HOLDLOCK) WHERE GatewayEventId=@eid)
                INSERT INTO PaystackWebhookEvents(GatewayEventId,EventType,TransactionId,ReferenceHash,PayloadHash)
                OUTPUT INSERTED.WebhookEventId,INSERTED.Status
              ELSE
                UPDATE PaystackWebhookEvents SET AttemptCount=AttemptCount+1,UpdatedAt=SYSUTCDATETIME()
                OUTPUT INSERTED.WebhookEventId,INSERTED.Status
                WHERE GatewayEventId=@eid AND Status<>'Processed'`);
    if (!stored.recordset[0]) return res.sendStatus(200);
    if (event.event === 'charge.success' && event.data?.reference) {
      await recordConfirmedContribution(String(event.data.reference), event.data);
    }
    await pool.request().input('eid', sql.NVarChar, gatewayEventId)
      .query("UPDATE PaystackWebhookEvents SET Status='Processed',ProcessedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME(),LastError=NULL WHERE GatewayEventId=@eid");
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    if (gatewayEventId) {
      try {
        const pool = await getPool();
        await pool.request().input('eid', sql.NVarChar, gatewayEventId).input('error', sql.NVarChar(1000), String(error?.message || error).slice(0, 1000))
          .query("UPDATE PaystackWebhookEvents SET Status='Failed',LastError=@error,UpdatedAt=SYSUTCDATETIME() WHERE GatewayEventId=@eid");
      } catch (auditError) {
        console.error('Could not persist Paystack webhook failure', auditError?.message || auditError);
      }
    }
    res.status(error.status && error.status < 500 ? error.status : 503).json({ error: 'Webhook processing failed' });
  }
});

export async function reconcilePendingPaystackPayments(limit = 25) {
  const pool = await getPool();
  const pending = await pool.request().input('limit', sql.Int, Math.max(1, Math.min(Number(limit) || 25, 100)))
    .query(`SELECT TOP (@limit) Reference FROM PaystackPayments
            WHERE Status='Pending' AND ContributionId IS NULL AND CreatedAt<DATEADD(MINUTE,-2,SYSUTCDATETIME())
            ORDER BY CreatedAt`);
  const results = [];
  for (const row of pending.recordset) {
    try {
      const reference = decryptValue(row.Reference);
      const data = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
      if (data.status === 'success') results.push(await recordConfirmedContribution(reference, data));
    } catch (error) {
      console.error('Paystack reconciliation failed', error?.message || error);
    }
  }
  return results;
}

export default r;
