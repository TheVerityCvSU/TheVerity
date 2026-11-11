/**
 * Shared connection state.
 *
 * Every server/network file reads and writes the same values through the
 * `state` object below.
 */

// Purge any stale or corrupted localStorage keys from older versions.
// (This must run BEFORE `state` is created, because it can clear the saved preferred mode.)
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('verity_server_url');
    localStorage.removeItem('verity_custom_server');
    const cloud = localStorage.getItem('verity_cloud_url');
    if (cloud && (cloud.includes('localhost') || cloud.includes('127.0.0.1') || cloud.includes('vercel.app'))) {
      localStorage.removeItem('verity_cloud_url');
    }
    // Prioritize online server when there is an internet connection on startup
    if (typeof navigator === 'undefined' || navigator.onLine) {
      localStorage.removeItem('verity_preferred_mode');
    }
  } catch (_) {}
}

const readSavedPreferredMode = () => {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('verity_preferred_mode') || null;
    } catch (_) {
      return null;
    }
  }
  return null;
};

export const state = {
  // In-memory holder for auto-discovered LAN host from Electron UDP discovery
  autoDiscoveredLanServer: null,
  // 'cloud' | 'lan' | null (automatic)
  userPreferredMode: readSavedPreferredMode(),
  isCloudDown: false,
  lastCloudCheckTime: 0,
  localHealthData: null,
  isLocalServerUp: false,
};

export const getUserPreferredMode = () => state.userPreferredMode;
