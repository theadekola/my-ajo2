import 'dotenv/config';
import nodemailer from 'nodemailer';

const smtpPort = Number(process.env.SMTP_PORT || 587);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: smtpPort === 465,
  requireTLS: smtpPort === 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const sender = process.env.SMTP_FROM || `My Ajo <${process.env.SMTP_USER}>`;

export async function sendOtp(email, code, purpose) {
  const recipient = String(email || '').trim().toLowerCase();
  if (!recipient) throw new Error('A recipient email address is required');
  const subject = purpose === 'EmailVerify' ? 'Verify your My Ajo email' : 'My Ajo Password Reset';
  const text = `Your My Ajo verification code is ${code}. This code expires in 5 minutes. Do not share it.`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="color:#0E1A12">My Ajo</h2>
      <p>${purpose === 'EmailVerify' ? 'Welcome! Please verify your email.' : 'Here is your password reset code.'}</p>
      <div style="background:#F0EDE6;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#C8973A">${code}</span>
      </div>
      <p style="color:#6B7260;font-size:13px">This code expires in 5 minutes. Do not share it.</p>
    </div>`;
  const result = await transporter.sendMail({ from: sender, to: recipient, subject, text, html });
  if (!result.accepted?.includes(recipient)) {
    throw new Error(`The email server did not accept delivery to ${recipient}`);
  }
  return { recipient, messageId: result.messageId };
}

export async function sendDeletionFeedback(email, feedback, rating) {
  const subject = 'My Ajo Account Deletion Feedback';
  const html = `<p><b>User:</b> ${email}</p><p><b>Rating:</b> ${rating}/5</p><p><b>Feedback:</b> ${feedback}</p>`;
  await transporter.sendMail({ from: sender, to: process.env.SMTP_USER, subject, html });
}

export async function sendSupportMessage({ fromEmail, fromName, role, subject, message }) {
  const to = process.env.SUPPORT_EMAIL || 'support@my-ajo.org';
  const cleanSubject = subject?.trim() || 'My Ajo support request';
  const safe = value => String(value || '').replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));
  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:24px">
      <h2 style="color:#0E1A12">My Ajo Support Request</h2>
      <p><b>Name:</b> ${safe(fromName)}</p>
      <p><b>Email:</b> ${safe(fromEmail)}</p>
      <p><b>Role:</b> ${safe(role)}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
      <p style="white-space:pre-wrap;line-height:1.6">${safe(message)}</p>
    </div>`;
  await transporter.sendMail({
    from: sender,
    to,
    replyTo: fromEmail,
    subject: cleanSubject,
    html
  });
}
