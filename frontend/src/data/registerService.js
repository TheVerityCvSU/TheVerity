import { apiFetch } from './api';

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
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return { ok: response.ok, data };
}

export async function verifyRegisterOtp({ email, otp }) {
  const response = await apiFetch('/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), otp })
  });
  const data = await response.json();
  return { ok: response.ok, data };
}

export async function resendRegisterOtp(email) {
  const response = await apiFetch('/auth/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() })
  });
  const data = await response.json();
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
  const data = await response.json();
  return { ok: response.ok, data };
}

