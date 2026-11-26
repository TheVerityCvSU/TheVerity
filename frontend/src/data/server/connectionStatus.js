/**
 * Connection status: decides which mode is active ('cloud' | 'lan' | 'offline')
 * and tells subscribed UI components whenever it changes.
 */
import { state } from './connectionState';
import { DEFAULT_CLOUD_API_URL, isPrivateHost, getCloudUrl, getLocalApiUrl } from './serverUrls';

const statusListeners = new Set();

const isLoopbackUrl = (raw) => {
  if (!raw) return false;
  return raw.includes('localhost') || raw.includes('127.0.0.1') || raw.includes('::1');
};

export const getHasExplicitLanServer = () => {
  const lan = state.autoDiscoveredLanServer || (typeof window !== 'undefined' ? (localStorage.getItem('verity_lan_server') || localStorage.getItem('verity_custom_server')) : null);
  return Boolean(
    lan ||
    (typeof window !== 'undefined' && window.location && isPrivateHost(window.location.hostname))
  );
};

export const hasDedicatedLanOrLocalDb = () => {
  if (state.autoDiscoveredLanServer && !isLoopbackUrl(state.autoDiscoveredLanServer)) {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      const savedLan = (localStorage.getItem('verity_lan_server') || localStorage.getItem('verity_custom_server') || '').trim();
      if (savedLan && !isLoopbackUrl(savedLan)) return true;
    } catch (_) {}
    if (
      window.location &&
      isPrivateHost(window.location.hostname) &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1' &&
      window.location.hostname !== '::1'
    ) {
      return true;
    }
  }
  return Boolean(state.localHealthData && (state.localHealthData.hasCloudDb === true || state.localHealthData.isHost === true));
};

export const getIsLanConnected = () => {
  if (state.userPreferredMode === 'cloud') return false;
  // If local server or LAN endpoint is down, we are NOT connected to LAN!
  if (!state.isLocalServerUp) return false;
  // If the user explicitly chose LAN mode, and local server is reachable, we are connected!
  if (state.userPreferredMode === 'lan') return true;
  return hasDedicatedLanOrLocalDb();
};

export const getConnectionStatus = () => {
  const isWebHosted = typeof window !== 'undefined' &&
                      window.location &&
                      !isPrivateHost(window.location.hostname) &&
                      !window.electronAPI;

  const { userPreferredMode, isCloudDown } = state;
  const cloudUrl = getCloudUrl();
  const localUrl = getLocalApiUrl();
  const hasCloud = Boolean(cloudUrl && cloudUrl !== localUrl);
  const isNavOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const isLanConnected = getIsLanConnected();

  let activeMode;
  if (userPreferredMode === 'lan') {
    if (isLanConnected || state.isLocalServerUp) {
      activeMode = 'lan';
    } else if (hasCloud && !isCloudDown && isNavOnline) {
      activeMode = 'cloud';
    } else {
      activeMode = 'offline';
    }
  } else if (userPreferredMode === 'cloud') {
    if (hasCloud && !isCloudDown && isNavOnline) {
      activeMode = 'cloud';
    } else if (isLanConnected || state.isLocalServerUp) {
      activeMode = 'lan';
    } else {
      activeMode = 'offline';
    }
  } else {
    // Automatic mode:
    // - Use Cloud when internet is available, unless connected to a ComLab Teacher LAN Host or local DB dev server.
    if (isWebHosted) {
      if (!isCloudDown && isNavOnline) {
        activeMode = 'cloud';
      } else if (isLanConnected) {
        activeMode = 'lan';
      } else {
        activeMode = 'offline';
      }
    } else if (isLanConnected && hasDedicatedLanOrLocalDb()) {
      activeMode = 'lan';
    } else if (hasCloud && !isCloudDown && isNavOnline) {
      activeMode = 'cloud';
    } else if (hasDedicatedLanOrLocalDb() && state.isLocalServerUp) {
      activeMode = 'lan';
    } else {
      activeMode = 'offline';
    }
  }

  let lanHostDisplay = '';
  if (activeMode === 'lan' || isLanConnected) {
    try {
      lanHostDisplay = new URL(localUrl).host;
    } catch (_) {
      lanHostDisplay = localUrl.replace(/^https?:\/\//, '');
    }
  }

  return {
    isOnline: (!isCloudDown && isNavOnline) || isLanConnected,
    isCloudDown,
    isNavOnline,
    activeMode, // 'cloud' | 'lan' | 'offline'
    userPreferredMode,
    isLanConnected: isLanConnected || (activeMode === 'lan'),
    isLocalServerUp: state.isLocalServerUp,
    lanHostDisplay,
    cloudUrl,
    localUrl,
    isWebHosted
  };
};

export const getActiveSocketUrl = () => {
  const status = getConnectionStatus();
  if (status.isWebHosted) return status.cloudUrl || DEFAULT_CLOUD_API_URL;
  if (status.activeMode === 'cloud') return status.cloudUrl || DEFAULT_CLOUD_API_URL;
  if (status.activeMode === 'lan') return status.localUrl || getLocalApiUrl();
  return status.localUrl || getLocalApiUrl();
};

export const subscribeConnectionStatus = (callback) => {
  statusListeners.add(callback);
  callback(getConnectionStatus());
  return () => statusListeners.delete(callback);
};

export const notifyListeners = () => {
  const status = getConnectionStatus();
  statusListeners.forEach((fn) => {
    try { fn(status); } catch (_) {}
  });
};

