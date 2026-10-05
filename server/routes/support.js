import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import { sendSupportMessage } from '../mailer.js';

const r = Router();
r.use(requireAuth);

r.post('/email', async (req, res) => {
  try {
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Message is required' });
    if (message.length > 5000) return res.status(400).json({ error: 'Message is too long' });

    await sendSupportMessage({
      fromEmail: req.user.email,
      fromName: req.user.name,
      role: req.user.systemRole,
      subject,
      message
    });

    res.json({ sent: true });
  } catch (e) {
    console.error('support email failed', e);
    res.status(500).json({ error: 'Could not send support message' });
  }
});

export default r;
