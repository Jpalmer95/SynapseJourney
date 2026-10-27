import nodemailer from "nodemailer";

/**
 * Transactional email delivery.
 *
 * Providers are tried in this order (first configured wins):
 *   1. Resend HTTP API   — RESEND_API_KEY
 *   2. SMTP              — SMTP_HOST (+ SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE)
 *   3. Console fallback  — logs the message and reports delivered:false
 *
 * MAIL_FROM must be an address the provider has authorised. APP_URL is used to
 * build absolute links.
 */

export type EmailProvider = "resend" | "smtp" | "console";

export interface EmailProviderStatus {
  provider: EmailProvider;
  configured: boolean;
  from: string;
  /** Human-readable reason when configured === false. */
  detail: string;
}

export interface SendEmailResult {
  delivered: boolean;
  provider: EmailProvider;
  id?: string;
  error?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function mailFrom(): string {
  return process.env.MAIL_FROM || "Synapse <no-reply@synapsejourney.org>";
}

export function getEmailProviderStatus(): EmailProviderStatus {
  if (process.env.RESEND_API_KEY) {
    return { provider: "resend", configured: true, from: mailFrom(), detail: "Resend HTTP API" };
  }
  if (process.env.SMTP_HOST) {
    return {
      provider: "smtp",
      configured: true,
      from: mailFrom(),
      detail: `SMTP ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`,
    };
  }
  return {
    provider: "console",
    configured: false,
    from: mailFrom(),
    detail:
      "No email provider configured. Set RESEND_API_KEY (recommended) or SMTP_HOST/SMTP_USER/SMTP_PASS " +
      "so password reset and verification emails are actually delivered.",
  };
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

async function sendViaResend(msg: EmailMessage): Promise<SendEmailResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom(),
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = body?.message || `Resend HTTP ${res.status}`;
      console.error(`[email] Resend rejected message to ${msg.to}: ${error}`);
      return { delivered: false, provider: "resend", error };
    }
    console.log(`[email] Resend accepted ${body?.id || "(no id)"} → ${msg.to}`);
    return { delivered: true, provider: "resend", id: body?.id };
  } catch (err: any) {
    const error = err?.message || "Resend request failed";
    console.error(`[email] Resend request failed for ${msg.to}:`, error);
    return { delivered: false, provider: "resend", error };
  }
}

async function sendViaSmtp(msg: EmailMessage): Promise<SendEmailResult> {
  const t = getTransporter();
  if (!t) return { delivered: false, provider: "console", error: "SMTP not configured" };
  try {
    const info = await t.sendMail({
      from: mailFrom(),
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    console.log(`[email] SMTP accepted ${info.messageId} → ${msg.to}`);
    return { delivered: true, provider: "smtp", id: info.messageId };
  } catch (err: any) {
    const error = err?.message || "SMTP send failed";
    console.error(`[email] SMTP send failed for ${msg.to}:`, error);
    return { delivered: false, provider: "smtp", error };
  }
}

export async function sendEmail(msg: EmailMessage): Promise<SendEmailResult> {
  const status = getEmailProviderStatus();
  if (status.provider === "resend") return sendViaResend(msg);
  if (status.provider === "smtp") return sendViaSmtp(msg);

  console.log(
    `[email] NOT DELIVERED (no provider configured). To: ${msg.to}\nSubject: ${msg.subject}\n${msg.text}`,
  );
  return { delivered: false, provider: "console", error: status.detail };
}

export function passwordResetEmail(to: string, resetUrl: string): EmailMessage {
  return {
    to,
    subject: "Reset your Synapse password",
    text: [
      "We received a request to reset your Synapse password.",
      "",
      "Open the link below to choose a new password. It is valid for 1 hour.",
      "",
      resetUrl,
      "",
      "If you didn't request this, you can safely ignore this email. Your password won't change.",
    ].join("\n"),
    html: [
      `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;line-height:1.55">`,
      `<h2 style="margin:0 0 16px">Reset your Synapse password</h2>`,
      `<p>We received a request to reset your Synapse password.</p>`,
      `<p>Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>`,
      `<p style="margin:24px 0"><a href="${resetUrl}" style="background:#6366f1;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Reset my password</a></p>`,
      `<p style="font-size:13px;color:#666">Or paste this URL into your browser:<br><code style="word-break:break-all">${resetUrl}</code></p>`,
      `<p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>`,
      `<p style="color:#999;font-size:12px">Synapse · synapsejourney.org</p>`,
      `</div>`,
    ].join(""),
  };
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<SendEmailResult> {
  return sendEmail(passwordResetEmail(to, resetUrl));
}
