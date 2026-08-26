import nodemailer from "nodemailer";

/**
 * Password-reset email delivery.
 *
 * Configure SMTP in the server env (.env / prod .env):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM
 *
 * If SMTP_HOST is not set, emails are NOT sent — the reset link is logged to
 * the server console as a safe dev/test fallback so the flow remains testable.
 */
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  }
  return transporter;
}

export interface SendEmailResult {
  delivered: boolean;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<SendEmailResult> {
  const mailFrom = process.env.MAIL_FROM || "Synapse <no-reply@synapsejourney.org>";
  const t = getTransporter();
  if (!t) {
    console.log(
      `[email] SMTP not configured (set SMTP_HOST to enable). Password reset link for ${to}:\n  ${resetUrl}`,
    );
    return { delivered: false };
  }
  try {
    await t.sendMail({
      from: mailFrom,
      to,
      subject: "Reset your Synapse password",
      text: [
        "We received a request to reset your Synapse password.",
        "",
        "Click the link below to choose a new password. This link is valid for 1 hour.",
        "",
        resetUrl,
        "",
        "If you didn't request this, you can safely ignore this email. Your password won't change.",
      ].join("\n"),
      html: [
        `<p>We received a request to reset your Synapse password.</p>`,
        `<p>Click the link below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>`,
        `<p><a href="${resetUrl}">Reset my password</a></p>`,
        `<p>Or copy and paste this URL into your browser:</p>`,
        `<p><code>${resetUrl}</code></p>`,
        `<p style="color:#666">If you didn't request this, you can safely ignore this email. Your password won't change.</p>`,
      ].join(""),
    });
    return { delivered: true };
  } catch (err) {
    console.error("[email] Failed to send password reset email:", err);
    return { delivered: false };
  }
}
