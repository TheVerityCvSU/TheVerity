/**
 * Connection status: decides which mode is active ('cloud' | 'lan' | 'offline')
 * and tells subscribed UI components whenever it changes.
 */
import { state } from './connectionState';
import { DEFAULT_CLOUD_API_URL, isPrivateHost, getCloudUrl, getLocalApiUrl } from './serverUrls';

const statusListeners = new Set();

export const getHasExplicitLanServer = () => {
  const lan = state.autoDiscoveredLanServer || (typeof window !== 'undefined' ? (localStorage.getItem('verity_lan_server') || localStorage.getItem('verity_custom_server')) : null);
  return Boolean(
    lan ||
    (typeof window !== 'undefined' && window.location && isPrivateHost(window.location.hostname))
  );
};

export const getIsLanConnected = () => {
  if (state.userPreferredMode === 'cloud') return false;
  // If local server or LAN endpoint is down, we are NOT connected to LAN!
  if (!state.isLocalServerUp) return false;
  // If the user explicitly chose LAN mode, and local server is reachable, we are connected!
  if (state.userPreferredMode === 'lan') return true;
  const hasExplicitLanServer = getHasExplicitLanServer();
  const isHost = Boolean(state.localHealthData && state.localHealthData.isHost === true);
  return hasExplicitLanServer || isHost;
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

  let activeMode = 'offline';
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
    // Default automatic mode: ALWAYS prioritize the Online Cloud Server when internet is available!
    if (isWebHosted) {
      if (!isCloudDown && isNavOnline) {
        activeMode = 'cloud';
      } else if (isLanConnected || state.isLocalServerUp) {
        activeMode = 'lan';
      } else {
        activeMode = 'offline';
      }
    } else {
      // Desktop / Electron / Local dev / ComLab LAN:
      // Prioritize the local/LAN server hosting the ComLab and local media uploads
      if (isLanConnected || state.isLocalServerUp || isPrivateHost(typeof window !== 'undefined' ? window.location?.hostname : '')) {
        activeMode = 'lan';
      } else if (hasCloud && !isCloudDown && isNavOnline) {
        activeMode = 'cloud';
      } else {
        activeMode = 'offline';
      }
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
    isOnline: (!isCloudDown && isNavOnline) || isLanConnected || state.isLocalServerUp,
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

