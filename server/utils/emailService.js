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
    process.env.ENV_FILE_PATH,
    process.resourcesPath ? path.join(process.resourcesPath, '.env') : null,
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../server/.env'),
    path.resolve(process.cwd(), 'server/.env'),
    path.resolve(process.cwd(), '.env')
  ].filter(Boolean);
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
    }
  }
} catch (_) { }

const DEFAULT_SMTP_USER = '';
const DEFAULT_SMTP_PASS = '';
const DEFAULT_SMTP_SERVICE = 'gmail';

function stripQuotes(value) {
  return String(value || '').trim().replace(/^["']|["']$/g, '').trim();
}

function extractEmailAddress(raw) {
  const clean = stripQuotes(raw);
  if (!clean) return '';
  const angleMatch = clean.match(/<([^<>\s]+@[^<>\s]+)>/);
  return (angleMatch ? angleMatch[1] : clean).trim();
}

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
  const host = stripQuotes(process.env.SMTP_HOST);
  const user = extractEmailAddress(process.env.SMTP_USER || process.env.EMAIL_USER || DEFAULT_SMTP_USER);
  const pass = stripQuotes(process.env.SMTP_PASS || process.env.EMAIL_PASS || DEFAULT_SMTP_PASS).replace(/\s+/g, '');
  const service = stripQuotes(process.env.SMTP_SERVICE || process.env.EMAIL_SERVICE || DEFAULT_SMTP_SERVICE).toLowerCase();
  const customPort = Number(process.env.SMTP_PORT || 0);
  const hasCustomPort = Number.isInteger(customPort) && customPort > 0;

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

  // Primary: Custom SMTP_PORT or Port 587 STARTTLS
  const port = hasCustomPort ? customPort : 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  return nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port,
    secure,
    requireTLS: !secure,
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

async function parseRestError(res, providerName) {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch (_) {}
  try {
    const parsed = rawText ? JSON.parse(rawText) : null;
    const detail = parsed?.message || parsed?.error?.message || parsed?.error || parsed?.code || rawText;
    return `${providerName} API HTTP ${res.status}: ${detail || 'request rejected'}`;
  } catch (_) {
    return `${providerName} API HTTP ${res.status}: ${(rawText || 'request rejected').slice(0, 180)}`;
  }
}

/**
 * Sends email via HTTPS REST API (Port 443) when running on platforms like Render
 * where outbound SMTP ports (25, 465, 587) are restricted by host policy.
 */
async function sendViaRestApi({ email, name, otp, subject, html, text, from }) {
  let attempted = false;
  let lastProvider = null;
  let lastError = null;

  // 1. Resend REST API (HTTPS port 443)
  const resendKey = stripQuotes(process.env.RESEND_API_KEY);
  if (resendKey) {
    attempted = true;
    lastProvider = 'resend';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: stripQuotes(process.env.RESEND_FROM) || 'The Verity Team <onboarding@resend.dev>',
          to: [email],
          subject,
          html,
          text
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        console.log(`[EMAIL SERVICE] Email sent via Resend REST API to ${email} (ID: ${data.id || 'ok'})`);
        return { attempted: true, success: true, provider: 'resend', messageId: data.id, otp };
      }
      lastError = await parseRestError(res, 'Resend');
      console.warn(`[EMAIL SERVICE] ${lastError}`);
    } catch (e) {
      lastError = `Resend request failed: ${e.message}`;
      console.warn(`[EMAIL SERVICE] ${lastError}`);
    }
  }

  // 2. Brevo REST API (HTTPS port 443)
  const brevoKey = stripQuotes(process.env.BREVO_API_KEY);
  if (brevoKey) {
    attempted = true;
    lastProvider = 'brevo';
    const senderEmail = extractEmailAddress(
      process.env.BREVO_SENDER_EMAIL ||
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      process.env.EMAIL_USER ||
      process.env.SMTP_USER ||
      DEFAULT_SMTP_USER
    );

    if (brevoKey.startsWith('xsmtpsib-')) {
      lastError = 'BREVO_API_KEY is an SMTP relay key (xsmtpsib-...); Brevo REST API requires a v3 API key (xkeysib-...).';
      console.warn(`[EMAIL SERVICE] ${lastError}`);
    } else if (!senderEmail) {
      lastError = 'Brevo sender email is missing (set BREVO_SENDER_EMAIL or EMAIL_USER to a verified Brevo sender).';
      console.warn(`[EMAIL SERVICE] ${lastError}`);
    } else {
      try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: 'The Verity Team', email: senderEmail },
            to: [{ email, name: name || 'User' }],
            subject,
            htmlContent: html,
            textContent: text
          }),
          signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          console.log(`[EMAIL SERVICE] Email sent via Brevo REST API to ${email} (ID: ${data.messageId || 'ok'})`);
          return { attempted: true, success: true, provider: 'brevo', messageId: data.messageId, otp };
        }
        lastError = await parseRestError(res, 'Brevo');
        console.warn(`[EMAIL SERVICE] ${lastError}`);
      } catch (e) {
        lastError = `Brevo request failed: ${e.message}`;
        console.warn(`[EMAIL SERVICE] ${lastError}`);
      }
    }
  }

  return attempted
    ? { attempted: true, success: false, provider: lastProvider, error: lastError || 'REST email delivery failed' }
    : null;
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

  const user = extractEmailAddress(process.env.SMTP_USER || process.env.EMAIL_USER || DEFAULT_SMTP_USER);
  const from = stripQuotes(process.env.SMTP_FROM || process.env.EMAIL_FROM) || (user ? `"The Verity Team" <${user}>` : '"The Verity Team" <noreply@theverity.local>');

  // 1. Try HTTPS REST API first (port 443 - bypasses all cloud container port restrictions)
  const restResult = await sendViaRestApi({ email, name, otp, subject, html, text, from });
  if (restResult && restResult.success) {
    return restResult;
  }

  // 2. Render Free Tier drops outbound TCP ports 25, 465, and 587; fail fast instead of hanging 8+ seconds on SMTP timeouts
  const isRenderWithoutSmtp = Boolean(process.env.RENDER && process.env.RENDER_SMTP_ENABLED !== 'true');
  if (isRenderWithoutSmtp) {
    const reason = restResult?.error || 'Email REST provider not configured on Render (set BREVO_API_KEY + verified BREVO_SENDER_EMAIL, or RESEND_API_KEY).';
    console.warn(`[EMAIL SERVICE] Render delivery stopped without raw SMTP retry: ${reason}`);
    return { success: false, provider: restResult?.provider || 'render', error: reason, simulated: false, otp };
  }

  const primaryTransporter = getTransporter();
  if (!primaryTransporter) {
    console.log(`[EMAIL SERVICE] SMTP not configured. OTP logged above for development.`);
    return {
      success: false,
      simulated: !restResult?.attempted,
      otp,
      error: restResult?.error || 'SMTP not configured'
    };
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
    return { success: true, provider: 'smtp', messageId: info.messageId, otp };
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
      return { success: true, provider: 'smtp', messageId: fallbackInfo.messageId, otp };
    } catch (fallbackError) {
      console.error(`[EMAIL SERVICE] All email attempts failed for ${email}:`, fallbackError.message);
      const combinedError = restResult?.error
        ? `${restResult.error}; SMTP fallback failed: ${fallbackError.message}`
        : fallbackError.message;
      return { success: false, error: combinedError, simulated: false, otp };
    }
  }
}

module.exports = {
  sendOtpEmail,
  generateOtpEmailHtml
};
