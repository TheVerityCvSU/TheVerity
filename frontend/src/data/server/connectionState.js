/**
 * Shared connection state.
 *
 * Every server/network file reads and writes the same values through the
 * `state` object below.
 */

// Purge any stale or corrupted localStorage keys from older versions.
// (This must run BEFORE `state` is created)
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('verity_server_url');
    const cloud = localStorage.getItem('verity_cloud_url');
    if (cloud && (cloud.includes('localhost') || cloud.includes('127.0.0.1') || cloud.includes('vercel.app'))) {
      localStorage.removeItem('verity_cloud_url');
    }
    for (const key of ['verity_lan_server', 'verity_custom_server']) {
      const val = localStorage.getItem(key);
      if (val && (val.includes('localhost') || val.includes('127.0.0.1') || val.includes('::1'))) {
        localStorage.removeItem(key);
      }
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
