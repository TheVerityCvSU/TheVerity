import { apiFetch } from './api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Checks if user is considered online based on last login timestamp.
 */
export function checkUserOnline(lastLogin, now = Date.now()) {
  if (!lastLogin) return false;
  try {
    return (now - new Date(lastLogin).getTime()) < 30 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Formats an ISO date into a readable string for user tables and modals.
 */
export function formatUserDate(iso) {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return iso;
  }
}

/**
 * Fetches kiosk security settings including password policies.
 */
export async function fetchPasswordPolicies() {
  try {
    const res = await apiFetch(`${API_BASE}/kiosk-settings`);
    const data = await res.json();
    return data?.settings?.passwordPolicies || null;
  } catch (_) {
    return null;
  }
}

/**
 * Updates an existing user's profile details by email.
 */
export async function updateUserProfile(originalEmail, payload) {
  const res = await apiFetch(`${API_BASE}/users/${encodeURIComponent(originalEmail)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update user');
  }
  return data;
}

/**
 * Validates and saves an edited user account.
 */
export async function saveEditedUser(editingUser, onUpdateUser) {
  const fullName = `${editingUser.firstName} ${editingUser.lastName}`.trim();
  if (!fullName) throw new Error('Name cannot be empty');
  if (!editingUser.email) throw new Error('Email cannot be empty');

  const payload = {
    name: fullName,
    email: editingUser.email.trim(),
    role: editingUser.role,
    status: editingUser.status,
  };
  if (editingUser.password && editingUser.password.trim()) {
    payload.password = editingUser.password.trim();
  }

  if (onUpdateUser) {
    const res = await onUpdateUser(editingUser.originalEmail, payload);
    if (res && res.success === false) {
      throw new Error(res.message || 'Failed to update user');
    }
  } else {
    await updateUserProfile(editingUser.originalEmail, payload);
  }
  return { fullName, payload };
}

/**
 * Registers a new user account through admin management.
 */
export async function registerNewUser(payload) {
  const res = await apiFetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Could not add user');
  }
  return data;
}
