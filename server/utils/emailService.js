const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) { }

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Ensure environment variables are loaded from available candidates
try {
  const envCandidates = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(process.cwd(), 'server/.env'),
    path.resolve(process.cwd(), '.env')
  ];
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
    }
  }
} catch (_) { }

const DEFAULT_SMTP_USER = '';
const DEFAULT_SMTP_PASS = '';
const DEFAULT_SMTP_SERVICE = 'gmail';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let cachedTransporter = null;

/**
 * Creates and returns a Nodemailer transporter based on environment configuration.
 * Uses port 587 STARTTLS as primary for maximum compatibility across networks.
 * @param {boolean} useFallbackPort - If true, force port 465 SSL.
 */
function createTransporter(useFallbackPort = false) {
  const host = process.env.SMTP_HOST;
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || DEFAULT_SMTP_USER).trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || DEFAULT_SMTP_PASS).trim().replace(/\s+/g, '');
  const service = (process.env.SMTP_SERVICE || process.env.EMAIL_SERVICE || DEFAULT_SMTP_SERVICE).trim().toLowerCase();

  if (!user || !pass) {
    return null;
  }

  // Fallback to SSL (port 465) if STARTTLS port 587 fails
  if (useFallbackPort) {
    return nodemailer.createTransport({
      service: service === 'gmail' || (!host && user.endsWith('@gmail.com')) ? 'gmail' : undefined,
      host: host || 'smtp.gmail.com',
      port: 465,
      secure: true,
      family: 4,
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 6000,
      auth: { user, pass }
    });
  }

  // Primary: Port 587 STARTTLS (standard submission port, works best through firewalls)
  return nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4,
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 6000,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    }
  });
}

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = createTransporter(false);
  }
  return cachedTransporter;
}

/**
 * Sends email via HTTPS REST API (Port 443) when running on platforms like Render
 * where outbound SMTP ports (25, 465, 587) are restricted by host policy.
 */
async function sendViaRestApi({ email, name, otp, subject, html, text, from }) {
  // 1. Resend REST API (HTTPS port 443)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey.trim()) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'The Verity Team <onboarding@resend.dev>',
          to: [email],
          subject,
          html,
          text
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[EMAIL SERVICE] Email sent via Resend REST API to ${email} (ID: ${data.id})`);
        return { success: true, messageId: data.id, otp };
      } else {
        console.warn(`[EMAIL SERVICE] Resend API error:`, data);
      }
    } catch (e) {
      console.warn(`[EMAIL SERVICE] Resend fetch failed:`, e.message);
    }
  }

  // 2. Brevo REST API (HTTPS port 443)
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey && brevoKey.trim()) {
    try {
      const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || process.env.SMTP_USER || DEFAULT_SMTP_USER).trim();
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey.trim(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'The Verity Team', email: senderEmail },
          to: [{ email, name: name || 'User' }],
          subject,
          htmlContent: html
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[EMAIL SERVICE] Email sent via Brevo REST API to ${email} (ID: ${data.messageId})`);
        return { success: true, messageId: data.messageId, otp };
      } else {
        console.warn(`[EMAIL SERVICE] Brevo API error:`, data);
      }
    } catch (e) {
      console.warn(`[EMAIL SERVICE] Brevo fetch failed:`, e.message);
    }
  }

  return null;
}

/**
 * Generates the HTML email matching GitHub/Verity identity verification design.
 */
function generateOtpEmailHtml({ name, otp }) {
  const safeName = escapeHtml(name || 'there');
  const safeOtp = escapeHtml(otp);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your Verity account</title>
</head>
<body style="margin: 0; padding: 40px 16px; background-color: #f6f8fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'; color: #1f2328; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto;">
    <!-- Logo Header -->
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <div style="display: inline-flex; align-items: baseline; font-size: 36px; font-weight: 900; font-style: italic; letter-spacing: -0.5px; text-decoration: none;">
          <span style="color: #10b981;">V</span><span style="color: #1f2328;">erity</span>
        </div>
      </td>
    </tr>

    <!-- Headline -->
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <h1 style="font-size: 24px; font-weight: 600; color: #1f2328; margin: 0; line-height: 1.3;">
          Please verify your identity, <span style="font-weight: 700;">${safeName}</span>
        </h1>
      </td>
    </tr>

    <!-- Main Card Container -->
    <tr>
      <td>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #d0d7de; border-radius: 8px; box-shadow: 0 1px 3px rgba(31,35,40,0.04);">
          <tr>
            <td style="padding: 32px 32px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #1f2328;">
                Hi ${safeName},
              </p>

              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.5; color: #1f2328;">
                Here is your One-Time Password (OTP) to complete your Verity account registration:
              </p>

              <!-- Centered OTP Display -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #1f2328; padding: 12px 28px; background-color: #f6f8fa; border: 1px solid #d0d7de; border-radius: 8px;">
                      ${safeOtp}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 16px 0; font-size: 14px; line-height: 1.5; color: #1f2328;">
                This code is valid for <strong>15 minutes</strong> and can only be used once.
              </p>

              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #1f2328;">
                <strong>Please don't share this code with anyone:</strong> we'll never ask for it over the phone or via email.
              </p>

              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #1f2328;">
                Thanks,<br>
                <strong>The Verity Team</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer outside the card -->
    <tr>
      <td align="center" style="padding-top: 24px;">
        <p style="margin: 0; font-size: 12px; line-height: 18px; color: #656d76; max-width: 480px;">
          You're receiving this email because a verification code was requested to create a new Verity account. If this wasn't you, please ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends OTP verification email to user.
 */
async function sendOtpEmail({ email, name, otp }) {
  const subject = 'Verify your Verity account';
  const html = generateOtpEmailHtml({ name, otp });
  const text = `Hi ${name || 'there'},\n\nHere is your One-Time Password (OTP) to complete your Verity account registration:\n\n${otp}\n\nThis code is valid for 15 minutes and can only be used once.\n\nPlease don't share this code with anyone: we'll never ask for it over the phone or via email.\n\nThanks,\nThe Verity Team\n\nYou're receiving this email because a verification code was requested to create a new Verity account. If this wasn't you, please ignore this email.`;

  console.log('\n========================================');
  console.log(`[VERITY OTP CODE] To: ${email} | Name: ${name || 'User'}`);
  console.log(`CODE: ${otp}`);
  console.log(`Expires in: 15 minutes`);
  console.log('========================================\n');

  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || DEFAULT_SMTP_USER).trim();
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || (user ? `"The Verity Team" <${user}>` : '"The Verity Team" <noreply@theverity.local>');

  // 1. Try HTTPS REST API first (port 443 - bypasses all cloud container port restrictions)
  const restResult = await sendViaRestApi({ email, name, otp, subject, html, text, from });
  if (restResult && restResult.success) {
    return restResult;
  }

  // 2. Detect Render Free Tier where outbound TCP ports 25, 465, and 587 are dropped by host firewall
  const isRenderFree = Boolean(process.env.RENDER && !process.env.RENDER_SMTP_ENABLED && !process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY);
  if (isRenderFree) {
    console.warn(`[EMAIL SERVICE] Running on Render Free Tier container. Outbound raw SMTP ports (25, 465, 587) are restricted by host policy. Code logged above.`);
    return { success: false, error: 'Raw SMTP ports restricted by cloud container (Render Free Tier)', simulated: false, otp };
  }

  const primaryTransporter = getTransporter();
  if (!primaryTransporter) {
    console.log(`[EMAIL SERVICE] SMTP not configured. OTP logged above for development.`);
    return { success: false, simulated: true, otp, error: 'SMTP not configured' };
  }

  // 3. Primary attempt: Port 587 STARTTLS (fast and reliable)
  try {
    const info = await primaryTransporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html
    });
    console.log(`[EMAIL SERVICE] Email sent successfully to ${email}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId, otp };
  } catch (error) {
    console.warn(`[EMAIL SERVICE] Primary send to ${email} failed: ${error.message}. Retrying via fallback port 465...`);
    try {
      const fallbackTransporter = createTransporter(true);
      if (!fallbackTransporter) {
        throw error;
      }
      const fallbackInfo = await fallbackTransporter.sendMail({
        from,
        to: email,
        subject,
        text,
        html
      });
      console.log(`[EMAIL SERVICE] Email sent successfully via fallback port 465 to ${email}. MessageId: ${fallbackInfo.messageId}`);
      return { success: true, messageId: fallbackInfo.messageId, otp };
    } catch (fallbackError) {
      console.error(`[EMAIL SERVICE] All email attempts failed for ${email}:`, fallbackError.message);
      return { success: false, error: fallbackError.message, simulated: false, otp };
    }
  }
}

module.exports = {
  sendOtpEmail,
  generateOtpEmailHtml
};
