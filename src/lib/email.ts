import nodemailer from "nodemailer";

interface ConfirmationEmailOptions {
  to: string;
  referenceNo: string;
  vendorName?: string;
  total?: string;
  channel?: string;
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.mailtrap.io",
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    auth: {
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
    },
  });
}

export async function sendConfirmationEmail(
  opts: ConfirmationEmailOptions
): Promise<void> {
  if (!process.env.SMTP_USER) {
    // Email not configured — log and skip
    console.log(
      `[Email] Would send confirmation to ${opts.to} — ref: ${opts.referenceNo}`
    );
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const statusUrl = `${appUrl}/status/${opts.referenceNo}`;
  const transporter = createTransport();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 40px 0;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="display: flex; align-items: center; margin-bottom: 32px;">
      <div style="width: 40px; height: 40px; background: #4f46e5; border-radius: 10px; margin-right: 12px;"></div>
      <h1 style="margin: 0; font-size: 20px; color: #1e1b4b;">AnzuIngestion</h1>
    </div>
    <h2 style="color: #111827; margin-bottom: 8px;">Invoice Received ✓</h2>
    <p style="color: #6b7280; margin-bottom: 24px;">
      We've received your invoice and it's being processed. You'll find the details below.
    </p>
    <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <div style="margin-bottom: 8px;">
        <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Reference Number</span>
        <div style="font-size: 20px; font-weight: 700; color: #4f46e5; letter-spacing: 0.05em;">${opts.referenceNo}</div>
      </div>
      ${opts.vendorName ? `<div style="margin-bottom: 4px; color: #374151;"><strong>Vendor:</strong> ${opts.vendorName}</div>` : ""}
      ${opts.total ? `<div style="color: #374151;"><strong>Amount:</strong> ${opts.total}</div>` : ""}
    </div>
    <a href="${statusUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">
      Track Status →
    </a>
    <p style="color: #9ca3af; font-size: 13px; border-top: 1px solid #f3f4f6; padding-top: 16px; margin-bottom: 0;">
      You can also check the status at any time by visiting<br>
      <a href="${statusUrl}" style="color: #4f46e5;">${statusUrl}</a>
    </p>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "AnzuIngestion <noreply@anzuingestion.com>",
    to: opts.to,
    subject: `Invoice Received — ${opts.referenceNo}`,
    html,
  });
}

export async function sendBounceEmail(
  to: string,
  reason: string
): Promise<void> {
  if (!process.env.SMTP_USER) {
    console.log(`[Email] Would send bounce to ${to}: ${reason}`);
    return;
  }

  const transporter = createTransport();
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "AnzuIngestion <noreply@anzuingestion.com>",
    to,
    subject: "Invoice Submission — Action Required",
    html: `
<p>We received your email but could not process it.</p>
<p><strong>Reason:</strong> ${reason}</p>
<p>Please ensure you attach a PDF or image file (JPEG, PNG) of your invoice and try again.</p>
<p>If you need help, please contact our support team.</p>
    `,
  });
}
