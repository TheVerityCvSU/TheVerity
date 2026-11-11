/**
 * Connection status: decides which mode is active ('cloud' | 'lan' | 'offline')
 * and tells subscribed UI components whenever it changes.
 */
import { state } from './connectionState';
import { DEFAULT_CLOUD_API_URL, isPrivateHost, getCloudUrl, getLocalApiUrl } from './serverUrls';

const statusListeners = new Set();

export const getHasExplicitLanServer = () => {
  const lan = state.autoDiscoveredLanServer;
  return Boolean(
    (lan && !lan.includes('localhost') && !lan.includes('127.0.0.1')) ||
    (typeof window !== 'undefined' && window.location && isPrivateHost(window.location.hostname) && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  );
};

export const getIsLanConnected = () => {
  if (state.userPreferredMode === 'cloud') return false;
  // If local server or LAN endpoint is down, we are NOT connected to LAN!
  if (!state.isLocalServerUp) return false;
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
    if (isLanConnected) {
      activeMode = 'lan';
    } else if (hasCloud && !isCloudDown && isNavOnline) {
      activeMode = 'cloud';
    } else {
      activeMode = 'offline';
    }
  } else if (userPreferredMode === 'cloud') {
    if (hasCloud && !isCloudDown && isNavOnline) {
      activeMode = 'cloud';
    } else if (isLanConnected) {
      activeMode = 'lan';
    } else {
      activeMode = 'offline';
    }
  } else {
    // Default automatic mode: ALWAYS prioritize the Online Cloud Server when internet is available!
    if (isWebHosted) {
      if (!isCloudDown && isNavOnline) {
        activeMode = 'cloud';
      } else if (isLanConnected) {
        activeMode = 'lan';
      } else {
        activeMode = 'offline';
      }
    } else {
      if (hasCloud && !isCloudDown && isNavOnline) {
        activeMode = 'cloud';
      } else if (isLanConnected) {
        activeMode = 'lan';
      } else {
        activeMode = 'offline';
      }
    }
  }

  let lanHostDisplay = '';
  if (isLanConnected) {
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
    isLanConnected,
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

