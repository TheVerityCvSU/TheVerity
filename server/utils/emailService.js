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
 * Strips HTML tags into clean plain text for email previews and text fallbacks.
 */
function stripHtmlToText(html, maxLength = 280) {
  if (!html) return '';
  const decoded = String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!maxLength || decoded.length <= maxLength) return decoded;
  return `${decoded.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Formats an activity dueDate (ISO string or YYYY-MM-DD) for readable email display.
 */
function formatDueDateForEmail(dueDate) {
  if (!dueDate || !String(dueDate).trim()) return 'No due date';
  const trimmed = String(dueDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const localEnd = new Date(y, m - 1, d, 23, 59, 0);
    if (!isNaN(localEnd.getTime())) {
      return localEnd.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  }
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

<<<<<<< HEAD
/**
 * Generates HTML email for student activity, material, deadline, and missed notifications.
 */
function generateStudentNotificationEmailHtml({
  studentName,
  badgeText,
  badgeColor = '#10b981',
  headline,
  introText,
  classroomName,
  instructorName,
  itemTitle,
  itemType,
  dueDateLabel,
  points,
  attachmentCount = 0,
  footerNote
}) {
  const safeStudentName = escapeHtml(studentName || 'Student');
  const safeBadgeText = escapeHtml(badgeText || 'Classroom Update');
  const safeBadgeColor = /^#[0-9a-fA-F]{6}$/.test(String(badgeColor || '')) ? badgeColor : '#10b981';
  const safeHeadline = escapeHtml(headline || 'Classroom Notification');
  const safeIntro = escapeHtml(introText || '');
  const safeClassroom = escapeHtml(classroomName || 'Your Classroom');
  const safeInstructor = escapeHtml(instructorName || 'Instructor');
  const safeTitle = escapeHtml(itemTitle || 'Untitled');
  const safeItemType = escapeHtml(itemType || 'Activity');
  const safeDueDate = escapeHtml(dueDateLabel || '');
  const safeFooter = escapeHtml(
    footerNote || "You're receiving this notification because you are enrolled in this classroom on The Verity."
  );

  const metaRows = [
    `<tr><td style="padding: 6px 0; color: #656d76; font-size: 13px; width: 120px; vertical-align: top;">Classroom</td><td style="padding: 6px 0; color: #1f2328; font-size: 13px; font-weight: 600;">${safeClassroom}</td></tr>`,
    `<tr><td style="padding: 6px 0; color: #656d76; font-size: 13px; vertical-align: top;">Instructor</td><td style="padding: 6px 0; color: #1f2328; font-size: 13px;">${safeInstructor}</td></tr>`,
    `<tr><td style="padding: 6px 0; color: #656d76; font-size: 13px; vertical-align: top;">Type</td><td style="padding: 6px 0; color: #1f2328; font-size: 13px;">${safeItemType}</td></tr>`
  ];
  if (safeDueDate) {
    metaRows.push(`<tr><td style="padding: 6px 0; color: #656d76; font-size: 13px; vertical-align: top;">Due Date</td><td style="padding: 6px 0; color: #1f2328; font-size: 13px; font-weight: 600;">${safeDueDate}</td></tr>`);
  }
  if (points !== undefined && points !== null && String(points).trim() !== '') {
    metaRows.push(`<tr><td style="padding: 6px 0; color: #656d76; font-size: 13px; vertical-align: top;">Points</td><td style="padding: 6px 0; color: #1f2328; font-size: 13px;">${escapeHtml(String(points))}</td></tr>`);
  }
  if (attachmentCount > 0) {
    metaRows.push(`<tr><td style="padding: 6px 0; color: #656d76; font-size: 13px; vertical-align: top;">Attachments</td><td style="padding: 6px 0; color: #1f2328; font-size: 13px;">${attachmentCount} file${attachmentCount === 1 ? '' : 's'} attached</td></tr>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeHeadline}</title>
</head>
<body style="margin: 0; padding: 40px 16px; background-color: #f6f8fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif; color: #1f2328; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto;">
    <tr>
      <td align="center" style="padding-bottom: 20px;">
        <div style="display: inline-flex; align-items: baseline; font-size: 34px; font-weight: 900; font-style: italic; letter-spacing: -0.5px;">
          <span style="color: #10b981;">V</span><span style="color: #1f2328;">erity</span>
        </div>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding-bottom: 12px;">
        <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background-color: ${safeBadgeColor}; color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase;">
          ${safeBadgeText}
        </span>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding-bottom: 22px;">
        <h1 style="font-size: 22px; font-weight: 600; color: #1f2328; margin: 0; line-height: 1.35;">
          ${safeHeadline}
        </h1>
      </td>
    </tr>

    <tr>
      <td>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #d0d7de; border-radius: 8px; box-shadow: 0 1px 3px rgba(31,35,40,0.04);">
          <tr>
            <td style="padding: 28px 28px 24px;">
              <p style="margin: 0 0 14px 0; font-size: 15px; line-height: 1.5; color: #1f2328;">
                Hi ${safeStudentName},
              </p>

              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.5; color: #1f2328;">
                ${safeIntro}
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; margin: 0 0 20px 0;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <div style="font-size: 16px; font-weight: 700; color: #1f2328; margin-bottom: 10px;">
                      ${safeTitle}
                    </div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      ${metaRows.join('\n                      ')}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #1f2328;">
                Open <strong>The Verity</strong> to view full details and stay on top of your coursework.
              </p>

              <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.5; color: #1f2328;">
                Thanks,<br>
                <strong>The Verity Team</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding-top: 20px;">
        <p style="margin: 0; font-size: 12px; line-height: 18px; color: #656d76; max-width: 480px;">
          ${safeFooter}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Dispatches an email using configured HTTPS REST APIs (Resend / Brevo) or Nodemailer SMTP.
 */
async function sendEmail({ email, name, subject, html, text, otp }) {
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || DEFAULT_SMTP_USER).trim();
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || (user ? `"The Verity Team" <${user}>` : '"The Verity Team" <noreply@theverity.local>');
=======
  const user = extractEmailAddress(process.env.SMTP_USER || process.env.EMAIL_USER || DEFAULT_SMTP_USER);
  const from = stripQuotes(process.env.SMTP_FROM || process.env.EMAIL_FROM) || (user ? `"The Verity Team" <${user}>` : '"The Verity Team" <noreply@theverity.local>');
>>>>>>> 3b82a0e04c7a495c9e05ceca4205e12acdacce60

  // 1. Try HTTPS REST API first (port 443 - bypasses all cloud container port restrictions)
  const restResult = await sendViaRestApi({ email, name, otp, subject, html, text, from });
  if (restResult && restResult.success) {
    return { success: true, messageId: restResult.messageId };
  }

<<<<<<< HEAD
  // 2. Detect Render Free Tier where outbound TCP ports 25, 465, and 587 are dropped by host firewall
  const isRenderFree = Boolean(process.env.RENDER && !process.env.RENDER_SMTP_ENABLED && !process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY);
  if (isRenderFree) {
    console.warn(`[EMAIL SERVICE] Running on Render Free Tier container. Outbound raw SMTP ports (25, 465, 587) are restricted by host policy.`);
    return { success: false, error: 'Raw SMTP ports restricted by cloud container (Render Free Tier)', simulated: false };
=======
  // 2. Render Free Tier drops outbound TCP ports 25, 465, and 587; fail fast instead of hanging 8+ seconds on SMTP timeouts
  const isRenderWithoutSmtp = Boolean(process.env.RENDER && process.env.RENDER_SMTP_ENABLED !== 'true');
  if (isRenderWithoutSmtp) {
    const reason = restResult?.error || 'Email REST provider not configured on Render (set BREVO_API_KEY + verified BREVO_SENDER_EMAIL, or RESEND_API_KEY).';
    console.warn(`[EMAIL SERVICE] Render delivery stopped without raw SMTP retry: ${reason}`);
    return { success: false, provider: restResult?.provider || 'render', error: reason, simulated: false, otp };
>>>>>>> 3b82a0e04c7a495c9e05ceca4205e12acdacce60
  }

  const primaryTransporter = getTransporter();
  if (!primaryTransporter) {
<<<<<<< HEAD
    console.warn(`[EMAIL SERVICE] SMTP not configured for ${email}.`);
    return { success: false, simulated: true, error: 'SMTP not configured' };
=======
    console.log(`[EMAIL SERVICE] SMTP not configured. OTP logged above for development.`);
    return {
      success: false,
      simulated: !restResult?.attempted,
      otp,
      error: restResult?.error || 'SMTP not configured'
    };
>>>>>>> 3b82a0e04c7a495c9e05ceca4205e12acdacce60
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
<<<<<<< HEAD
    return { success: true, messageId: info.messageId };
=======
    return { success: true, provider: 'smtp', messageId: info.messageId, otp };
>>>>>>> 3b82a0e04c7a495c9e05ceca4205e12acdacce60
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
<<<<<<< HEAD
      return { success: true, messageId: fallbackInfo.messageId };
    } catch (fallbackError) {
      console.error(`[EMAIL SERVICE] All email attempts failed for ${email}:`, fallbackError.message);
      return { success: false, error: fallbackError.message, simulated: false };
=======
      return { success: true, provider: 'smtp', messageId: fallbackInfo.messageId, otp };
    } catch (fallbackError) {
      console.error(`[EMAIL SERVICE] All email attempts failed for ${email}:`, fallbackError.message);
      const combinedError = restResult?.error
        ? `${restResult.error}; SMTP fallback failed: ${fallbackError.message}`
        : fallbackError.message;
      return { success: false, error: combinedError, simulated: false, otp };
>>>>>>> 3b82a0e04c7a495c9e05ceca4205e12acdacce60
    }
  }
}

/**
 * Sends OTP verification email to user.
 */
async function sendOtpEmail({ email, name, otp }) {
  const subject = 'Verify your Verity account';
  const html = generateOtpEmailHtml({ name, otp });
  const text = `Hi ${name || 'there'},\n\nHere is your One-Time Password (OTP) to complete your Verity account registration:\n\n${otp}\n\nThis code is valid for 15 minutes and can only be used once.\n\nPlease don't share this code with anyone: we'll never ask for it over the phone or via email.\n\nThanks,\nThe Verity Team\n\nYou're receiving this email because a verification code was requested to create a new Verity account. If this wasn't you, please ignore this email.`;

  if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_OTP === 'true') {
    console.log(`[VERITY OTP CODE] Debug OTP generated for ${email}: ${otp}`);
  } else {
    console.log(`[VERITY OTP] Dispatching verification email to ${email}`);
  }

  return sendEmail({ email, name, subject, html, text, otp });
}

/**
 * Sends a student classroom notification email (new classwork, new material, deadline near, or missed activity).
 */
async function sendStudentNotificationEmail({
  email,
  studentName,
  subject,
  badgeText,
  badgeColor,
  headline,
  introText,
  classroomName,
  instructorName,
  itemTitle,
  itemType,
  dueDateLabel,
  points,
  attachmentCount = 0,
  footerNote
}) {
  const html = generateStudentNotificationEmailHtml({
    studentName,
    badgeText,
    badgeColor,
    headline,
    introText,
    classroomName,
    instructorName,
    itemTitle,
    itemType,
    dueDateLabel,
    points,
    attachmentCount,
    footerNote
  });

  const textLines = [
    `Hi ${studentName || 'Student'},`,
    '',
    introText || headline,
    '',
    `Title: ${itemTitle || 'Untitled'}`,
    `Classroom: ${classroomName || 'Classroom'}`,
    `Instructor: ${instructorName || 'Instructor'}`,
    `Type: ${itemType || 'Activity'}`
  ];
  if (dueDateLabel) textLines.push(`Due Date: ${dueDateLabel}`);
  if (points !== undefined && points !== null && String(points).trim() !== '') {
    textLines.push(`Points: ${points}`);
  }
  if (attachmentCount > 0) {
    textLines.push(`Attachments: ${attachmentCount} file(s)`);
  }
  textLines.push('', 'Open The Verity to view full details.', '', 'Thanks,', 'The Verity Team');

  return sendEmail({
    email,
    name: studentName || 'Student',
    subject,
    html,
    text: textLines.join('\n')
  });
}

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendStudentNotificationEmail,
  generateOtpEmailHtml,
  generateStudentNotificationEmailHtml,
  stripHtmlToText,
  formatDueDateForEmail
};
