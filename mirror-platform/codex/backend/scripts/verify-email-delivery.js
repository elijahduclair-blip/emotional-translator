import 'dotenv/config';
import nodemailer from 'nodemailer';

const required = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM'
];
const missing = required.filter((name) => !String(process.env[name] || '').trim());

if (missing.length > 0) {
  throw new Error(`Email delivery is missing configuration: ${missing.join(', ')}`);
}

const recipient = String(process.env.TEST_EMAIL_TO || '').trim();
if (!recipient || !recipient.includes('@')) {
  throw new Error('Set TEST_EMAIL_TO to the address that should receive the delivery test.');
}

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

await transport.verify();
const result = await transport.sendMail({
  from: process.env.SMTP_FROM,
  to: recipient,
  subject: 'Community Garden email delivery is connected',
  text: [
    'Community Garden can now deliver account verification and password reset email.',
    '',
    'This was a delivery test. No action is required.'
  ].join('\n')
});

console.log(JSON.stringify({
  connected: true,
  acceptedCount: Array.isArray(result.accepted) ? result.accepted.length : 0,
  rejectedCount: Array.isArray(result.rejected) ? result.rejected.length : 0,
  messageId: String(result.messageId || '')
}));
