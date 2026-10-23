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
} catch (_) {}

const DEFAULT_SMTP_USER = 'kimfabie159@gmail.com';
const DEFAULT_SMTP_PASS = 'bwuuabczntiqoqnz';
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
 * @param {boolean} useFallbackPort - If true, force port 587 STARTTLS for cloud firewall bypass.
 */
function createTransporter(useFallbackPort = false) {
  const host = process.env.SMTP_HOST;
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || DEFAULT_SMTP_USER).trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || DEFAULT_SMTP_PASS).trim().replace(/\s+/g, '');
  const service = (process.env.SMTP_SERVICE || process.env.EMAIL_SERVICE || DEFAULT_SMTP_SERVICE).trim().toLowerCase();

  if (!user || !pass) {
    return null;
  }

  // Force port 587 STARTTLS fallback if primary fails or requested
  if (useFallbackPort) {
    return nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      family: 4,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: { user, pass }
    });
  }

  if (service === 'gmail' || (!host && user.endsWith('@gmail.com'))) {
    return nodemailer.createTransport({
      service: 'gmail',
      family: 4, // Force IPv4 to prevent 30s IPv6 DNS timeouts on Windows networks
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: { user, pass }
    });
  }

  if (host && user) {
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    return nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      family: 4,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: { user, pass }
    });
  }

  return null;
}

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = createTransporter();
  }
  return cachedTransporter;
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
  console.log(`🔑 [VERITY OTP CODE] To: ${email} | Name: ${name || 'User'}`);
  console.log(`👉 CODE: ${otp}`);
  console.log(`⏰ Expires in: 15 minutes`);
  console.log('========================================\n');

  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || DEFAULT_SMTP_USER).trim();
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || (user ? `"The Verity Team" <${user}>` : '"The Verity Team" <kimfabie159@gmail.com>');
  const primaryTransporter = getTransporter();

  if (!primaryTransporter) {
    console.log(`ℹ️ [EMAIL SERVICE] SMTP not configured. OTP logged above for development.`);
    return { success: false, simulated: true, otp, error: 'SMTP not configured' };
  }

  try {
    const info = await primaryTransporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html
    });
    console.log(`✅ [EMAIL SERVICE] Email sent successfully to ${email}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId, otp };
  } catch (error) {
    console.warn(`⚠️ [EMAIL SERVICE] Primary send to ${email} failed: ${error.message}. Retrying via fallback port 587...`);
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
      console.log(`✅ [EMAIL SERVICE] Email sent successfully via fallback port 587 to ${email}. MessageId: ${fallbackInfo.messageId}`);
      return { success: true, messageId: fallbackInfo.messageId, otp };
    } catch (fallbackError) {
      console.error(`❌ [EMAIL SERVICE] All email attempts failed for ${email}:`, fallbackError.message);
      return { success: false, error: fallbackError.message, simulated: false, otp };
    }
  }
}

module.exports = {
  sendOtpEmail,
  generateOtpEmailHtml
};
