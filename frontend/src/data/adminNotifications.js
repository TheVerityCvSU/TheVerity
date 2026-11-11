/**
 * Helper functions for admin notification persistence.
 */

export function getReadNotificationKeys() {
  try {
    return JSON.parse(localStorage.getItem('verity_notifications_read_keys') || '[]');
  } catch (_) {
    return [];
  }
}

export function markNotificationsAsRead(notifications) {
  try {
    const readKeys = notifications.map(n => `${n.id}:${n.text}`);
    const existing = getReadNotificationKeys();
    const updated = Array.from(new Set([...existing, ...readKeys]));
    localStorage.setItem('verity_notifications_read_keys', JSON.stringify(updated));
    localStorage.removeItem('verity_notifications_cleared');
  } catch (_) {}
}

