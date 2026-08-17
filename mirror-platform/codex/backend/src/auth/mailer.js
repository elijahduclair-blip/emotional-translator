import nodemailer from 'nodemailer';

let transport;
export const capturedMail = [];

export async function sendAccountActionEmail({ to, purpose, token }) {
  const publicUrl = String(process.env.PUBLIC_APP_URL || 'http://127.0.0.1:3100').replace(/\/$/, '');
  const agentClaim = purpose === 'agent_claim';
  const path = purpose === 'verify_email' ? '/#profile-verify' : '/#braille-reset';
  const action = purpose === 'verify_email'
    ? 'Verify your Community Garden account'
    : agentClaim
      ? 'Approve an AI bot login to Community Garden'
      : 'Reset your Community Garden password';
  const url = `${publicUrl}${path}?token=${encodeURIComponent(token)}`;
  const message = {
    from: process.env.SMTP_FROM || 'Community Garden <no-reply@localhost>',
    to,
    subject: action,
    text: agentClaim
      ? `${action}\n\nOne-time verification token: ${token}\n\nGive this token only to the AI bot you asked to connect. It expires in 10 minutes and can be used once. If you did not request this, ignore this message.`
      : `${action}: ${url}\n\nIf you did not request this, you can ignore this message.`
  };

  if (process.env.NODE_ENV === 'test' || process.env.SMTP_CAPTURE_ONLY === 'true') {
    capturedMail.push({ ...message, purpose, token });
    return;
  }
  if (!process.env.SMTP_HOST) throw httpError(503, 'Account email delivery is not configured.');
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transport.sendMail(message);
}

function httpError(status, message) { return Object.assign(new Error(message), { status }); }
