import nodemailer from "nodemailer";
import { env } from "./env.js";

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
});

export async function sendVerificationCode(email: string, code: string) {
  const from = env.SMTP_FROM || env.SMTP_USER || `no-reply@${email.split("@").pop()}`;
  const text = `Your Ethara verification code is ${code}. It expires in ${env.EMAIL_VERIFICATION_TTL_MINUTES} minutes.`;
  const html = `<p>Your Ethara verification code is <strong>${code}</strong>.</p><p>It expires in ${env.EMAIL_VERIFICATION_TTL_MINUTES} minutes.</p>`;

  if (!env.SMTP_USER || !env.SMTP_PASS) {
    // Fallback for local development when SMTP is not configured.
    // The email verification code is logged to help developers test without SMTP.
    // In production, set SMTP_USER and SMTP_PASS to send real Gmail verification emails.
    // eslint-disable-next-line no-console
    console.warn("SMTP is not configured. Verification code for %s: %s", email, code);
    return;
  }

  await transport.sendMail({
    from,
    to: email,
    subject: "Your Ethara verification code",
    text,
    html
  });
}
