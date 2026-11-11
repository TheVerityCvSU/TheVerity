// API service for requesting and verifying email change OTP codes.
import { apiFetch } from './api';

export const sendEmailChangeOtp = async (cleanEmail) => {
  const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/send-email-change-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newEmail: cleanEmail })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to send verification code.');
  }
  return data;
};

export const verifyEmailChange = async (cleanEmail, code) => {
  const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/verify-email-change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      newEmail: cleanEmail,
      otp: code
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Invalid verification code.');
  }
  return data;
};

