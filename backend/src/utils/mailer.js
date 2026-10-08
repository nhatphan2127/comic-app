// Outgoing email. With SMTP_HOST set, mail goes through that server (SMTP_PORT, SMTP_USER, SMTP_PASS,
// MAIL_FROM). Without it (local development, tests) nothing is sent: the message is printed to the
// console and kept in `outbox`, so the reset link can still be used.
import nodemailer from 'nodemailer';

export const outbox = [];

const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

export async function sendMail({ to, subject, text }) {
  const message = { from: process.env.MAIL_FROM || 'Comic platform <no-reply@localhost>', to, subject, text };
  if (transport) return transport.sendMail(message);

  outbox.push(message);
  if (process.env.NODE_ENV !== 'test') console.log(`[mail] to ${to}: ${subject}\n${text}`);
  return null;
}
