import { apiFetch } from './api';

/**
 * Loads the saved email from localStorage and Electron localDB.
 */
export async function loadSavedAccountEmail() {
  let savedEmail = '';
  try {
    savedEmail = localStorage.getItem('verity_saved_account_email') || '';
  } catch (_) {}

  if (!savedEmail && window.electronAPI?.localDB?.getLocal) {
    try {
      savedEmail = (await window.electronAPI.localDB.getLocal('verity_saved_account_email')) || '';
    } catch (_) {}
  }
  return savedEmail;
}

/**
 * Persists or removes remembered account email in localStorage and Electron localDB.
 */
export function persistSavedAccountEmail(accountEmail, rememberAccount) {
  const cleanEmail = (accountEmail || '').trim();
  if (rememberAccount && cleanEmail) {
    try {
      localStorage.setItem('verity_saved_account_email', cleanEmail);
      localStorage.setItem('verity_remember_account', 'true');
      if (window.electronAPI?.localDB?.setLocal) {
        window.electronAPI.localDB.setLocal('verity_saved_account_email', cleanEmail).catch(() => {});
        window.electronAPI.localDB.setLocal('verity_remember_account', 'true').catch(() => {});
      }
    } catch (_) {}
  } else if (!rememberAccount) {
    try {
      localStorage.removeItem('verity_saved_account_email');
      localStorage.setItem('verity_remember_account', 'false');
      if (window.electronAPI?.localDB?.setLocal) {
        window.electronAPI.localDB.setLocal('verity_saved_account_email', null).catch(() => {});
        window.electronAPI.localDB.setLocal('verity_remember_account', 'false').catch(() => {});
      }
    } catch (_) {}
  }
}

/**
 * Reads the user's "remember account" preference.
 */
export function getRememberAccountPreference() {
  try {
    const savedPref = localStorage.getItem('verity_remember_account');
    return savedPref !== 'false';
  } catch (_) {
    return true;
  }
}

/**
 * Queries server maintenance status.
 */
export async function checkMaintenanceStatus() {
  try {
    const res = await apiFetch('/maintenance-status');
    if (res.ok) {
      const data = await res.json();
      if (data.enabled) {
        return { enabled: true, message: data.message };
      }
    }
  } catch (_) {}
  return { enabled: false, message: '' };
}

/**
 * Executes email/username & password login.
 */
export async function loginUser(email, password) {
  const response = await apiFetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username: email, identifier: email }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

/**
 * Verifies a Google credential/access token with the backend.
 */
export async function authenticateGoogleToken(tokenResponse) {
  const response = await apiFetch('/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tokenResponse?.credential, access_token: tokenResponse?.access_token }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

