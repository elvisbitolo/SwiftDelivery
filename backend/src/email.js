import nodemailer from "nodemailer";

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS?.replace(/\s/g, "");
const fromName = process.env.EMAIL_FROM_NAME || "Delivery Kenya";
const adminEmail = process.env.EMAIL_ADMIN_TO || smtpUser;

function emailIsConfigured() {
  return Boolean(smtpUser && smtpPass);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendSignupNotification({ to, name, role }) {
  if (!emailIsConfigured()) {
    return { skipped: true, reason: "Email is not configured" };
  }

  const displayName = name || "there";
  const safeDisplayName = escapeHtml(displayName);
  const accountType = role === "driver" ? "driver" : "seller";

  await createTransporter().sendMail({
    from: `"${fromName}" <${smtpUser}>`,
    to,
    bcc: adminEmail && adminEmail !== to ? adminEmail : undefined,
    replyTo: smtpUser,
    subject: "Welcome to Delivery Kenya",
    text: [
      `Hi ${displayName},`,
      "",
      `Your ${accountType} account has been created successfully.`,
      "You can now sign in, find delivery partners, chat, share location, and record delivery payments.",
      "",
      "Delivery Kenya",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #17201b;">
        <h2>Welcome to Delivery Kenya</h2>
        <p>Hi ${safeDisplayName},</p>
        <p>Your <strong>${accountType}</strong> account has been created successfully.</p>
        <p>You can now sign in, find delivery partners, chat, share location, and record delivery payments.</p>
        <p>Delivery Kenya</p>
      </div>
    `,
  });

  return { sent: true };
}
