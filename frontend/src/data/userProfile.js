// Current user data: manages saving and loading the signed-in user's profile
// in localStorage and syncing profile changes with the backend database.
import { apiFetch } from './api';

const STORAGE_KEY = 'currentUser';

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

let globalUser = getStoredUser();
export const userListeners = new Set();

export const notifyUserListeners = (updatedUser) => {
  globalUser = updatedUser;
  userListeners.forEach((listener) => {
    try {
      listener(globalUser);
    } catch (e) {
      console.error('Error notifying user listener:', e);
    }
  });
};

export const getGlobalUser = () => globalUser;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      try {
        globalUser = e.newValue ? JSON.parse(e.newValue) : null;
        notifyUserListeners(globalUser);
      } catch {}
    }
  });

  window.addEventListener('verity:user-updated', (e) => {
    const fresh = e.detail !== undefined ? e.detail : getStoredUser();
    globalUser = fresh;
    notifyUserListeners(globalUser);
  });
}

/**
 * Update the stored currentUser and notify all listeners reactively.
 * Also permanently persists changes to the database so avatars and profiles are visible to everyone.
 */
export async function updateCurrentUser(updates) {
  const current = getStoredUser() || {};
  const updated = { ...current, ...updates };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save currentUser to localStorage:', err);
  }
  globalUser = updated;
  notifyUserListeners(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('verity:user-updated', { detail: updated }));
  }

  // Persist to backend database via PUT /users/profile using real auth token
  try {
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    if (token) {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: updated.name,
          avatar: updated.avatar !== undefined ? updated.avatar : (updated.profilePicture || null)
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const synced = { ...updated, ...data.user, email: updated.email || data.user.email };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
          globalUser = synced;
          notifyUserListeners(synced);
          return synced;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to sync profile to backend:', err);
  }

  return updated;
}

