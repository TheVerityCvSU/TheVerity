import { apiFetch } from './api';

/**
 * Authenticates an administrator against the Verity Admin backend.
 * Clears saved admin credentials on successful login.
 */
export async function loginAdmin({ email, password }) {
  let preferredMode = null;
  try {
    preferredMode = localStorage.getItem('verity_preferred_mode');
  } catch (_) {}
  const isCloudExplicit = preferredMode === 'cloud';

  let response;
  try {
    response = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cloudOnly: isCloudExplicit,
      timeoutMs: 30000
    });
  } catch (networkErr) {
    const err = new Error(
      isCloudExplicit
        ? 'Could not reach the Online Cloud Server. Wait a moment if the server is waking up, or switch Network Mode to Local LAN to sign into your local server.'
        : 'Could not connect to Verity Admin Security Service. Make sure server.js is running.'
    );
    err.isNetworkError = true;
    throw err;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.message || 'Invalid admin credentials');
    err.isResponseError = true;
    throw err;
  }

  try {
    sessionStorage.removeItem('verity_auth_notice');
    localStorage.removeItem('verity_admin_saved_email');
    localStorage.removeItem('verity_remember_admin');
    if (window.electronAPI?.localDB?.setLocal) {
      window.electronAPI.localDB.setLocal('verity_admin_saved_email', null).catch(() => {});
      window.electronAPI.localDB.setLocal('verity_remember_admin', null).catch(() => {});
    }
  } catch (_) {}

  return data;
}
