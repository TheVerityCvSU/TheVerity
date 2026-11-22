import { apiFetch } from './api';

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CVSU_EMAIL_ERROR = 'Only official @cvsu.edu.ph email accounts can register.';

export function isValidCvsuEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  return EMAIL_FORMAT_REGEX.test(clean) && clean.endsWith('@cvsu.edu.ph');
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch (_) {
    return { message: `Server returned an unexpected response (HTTP ${response.status}).` };
  }
}

export async function fetchPasswordPolicies() {
  try {
    const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/kiosk-settings`);
    const data = await res.json();
    return data?.settings?.passwordPolicies || null;
  } catch (_) {
    return null;
  }
}

export async function sendRegisterOtp(payload) {
  const response = await apiFetch('/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs: 35000
  });
  const data = await parseJsonSafe(response);
  return { ok: response.ok, data };
}

export async function verifyRegisterOtp({ email, otp }) {
  const response = await apiFetch('/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), otp })
  });
  const data = await parseJsonSafe(response);
  return { ok: response.ok, data };
}

export async function resendRegisterOtp(email) {
  const response = await apiFetch('/auth/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
    timeoutMs: 35000
  });
  const data = await parseJsonSafe(response);
  return { ok: response.ok, data };
}

export async function registerGoogleAuth({ token, access_token, role, password }) {
  const response = await apiFetch('/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      access_token,
      role,
      password: password || undefined
    })
  });
  const data = await parseJsonSafe(response);
  return { ok: response.ok, data };
}

