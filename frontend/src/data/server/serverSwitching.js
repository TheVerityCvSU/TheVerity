/**
 * Server switching: lets the user pick a server (custom URL, cloud, or LAN).
 */
import { state } from './connectionState';
import { DEFAULT_CLOUD_API_URL, isPrivateHost, getCloudUrl, getLocalApiUrl } from './serverUrls';
import { notifyListeners } from './connectionStatus';
import { checkCloudHealth, checkLocalHealth } from './healthChecks';

// Tells the rest of the app that the server changed so screens reload their data
const announceServerChange = (url, { lan = false } = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('verity:server-changed', { detail: url }));
  if (lan) {
    window.dispatchEvent(new CustomEvent('verity:lan-discovered', { detail: url }));
  }
  window.dispatchEvent(new CustomEvent('verity:classrooms-changed'));
  window.dispatchEvent(new CustomEvent('verity:users-changed'));
};

export const setCustomLanServer = async (url) => {
  if (!url) {
    state.autoDiscoveredLanServer = null;
    try {
      localStorage.removeItem('verity_lan_server');
      if (window.electronAPI?.localDB?.setLocal) {
        await window.electronAPI.localDB.setLocal('verity_lan_server', null);
      }
    } catch (_) {}
    notifyListeners();
    return { success: true };
  }

  const raw = url.trim().replace(/\/$/, '');
  const withoutProto = raw.replace(/^https?:\/\//i, '');
  const hostPart = withoutProto.split('/')[0].split(':')[0];
  const isLocalOrLan = isPrivateHost(hostPart);

  let clean = raw;
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = isLocalOrLan ? `http://${clean}` : `https://${clean}`;
  }
  if (isLocalOrLan && !clean.replace(/^https?:\/\//i, '').includes(':')) {
    clean = `${clean}:3001`;
  }

  // Pre-test the health of the target server (supports both Online Cloud Server and Local LAN Server)
  let healthData = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), isLocalOrLan ? 3500 : 6000);
    const res = await fetch(`${clean}/health`, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) {
      return { success: false, error: `Server returned HTTP ${res.status}` };
    }
    healthData = await res.json().catch(() => null);
    if (!healthData || healthData.app !== 'the-verity') {
      return { success: false, error: 'Target reachable, but not a Verity server' };
    }
  } catch (err) {
    return {
      success: false,
      error: isLocalOrLan
        ? 'Could not connect to LAN server. Please check IP and port.'
        : 'Could not connect to Online Server. Please check your internet connection or URL.'
    };
  }

  // If the user entered an Online Server URL (non-private host), connect in Cloud Mode
  if (!isLocalOrLan) {
    state.userPreferredMode = 'cloud';
    state.autoDiscoveredLanServer = null;
    state.isCloudDown = false;
    state.lastCloudCheckTime = Date.now();
    try {
      localStorage.setItem('verity_preferred_mode', 'cloud');
      localStorage.removeItem('verity_lan_server');
      if (clean === DEFAULT_CLOUD_API_URL) {
        localStorage.removeItem('verity_cloud_url');
      } else {
        localStorage.setItem('verity_cloud_url', clean);
      }
      if (window.electronAPI?.localDB?.setLocal) {
        await window.electronAPI.localDB.setLocal('verity_preferred_mode', 'cloud').catch(() => {});
        await window.electronAPI.localDB.setLocal('verity_lan_server', null).catch(() => {});
        await window.electronAPI.localDB.setLocal('verity_cloud_url', clean === DEFAULT_CLOUD_API_URL ? null : clean).catch(() => {});
      }
      if (window.electronAPI?.setLanServer) {
        await window.electronAPI.setLanServer(null).catch(() => {});
      }
    } catch (_) {}

    announceServerChange(clean);
    notifyListeners();
    return { success: true, url: clean, mode: 'cloud' };
  }

  // Otherwise, connect in LAN Mode
  state.userPreferredMode = 'lan';
  state.autoDiscoveredLanServer = clean;
  state.localHealthData = healthData;
  state.isLocalServerUp = true;
  try {
    localStorage.setItem('verity_preferred_mode', 'lan');
    localStorage.setItem('verity_lan_server', clean);
    if (window.electronAPI?.localDB?.setLocal) {
      await window.electronAPI.localDB.setLocal('verity_lan_server', clean);
    }
    if (window.electronAPI?.setLanServer) {
      await window.electronAPI.setLanServer(clean).catch(() => {});
    }
  } catch (_) {}

  announceServerChange(clean, { lan: true });
  checkLocalHealth();
  notifyListeners();
  return { success: true, url: clean, mode: 'lan' };
};

export const switchToCloudMode = () => {
  state.userPreferredMode = 'cloud';
  try {
    localStorage.setItem('verity_preferred_mode', 'cloud');
    localStorage.removeItem('verity_lan_server');
    if (window.electronAPI?.localDB?.setLocal) {
      window.electronAPI.localDB.setLocal('verity_preferred_mode', 'cloud').catch(() => {});
      window.electronAPI.localDB.setLocal('verity_lan_server', null).catch(() => {});
    }
    if (window.electronAPI?.setLanServer) {
      window.electronAPI.setLanServer(null).catch(() => {});
    }
  } catch (_) {}
  state.autoDiscoveredLanServer = null;
  state.isCloudDown = false;
  announceServerChange(getCloudUrl());
  checkCloudHealth();
  notifyListeners();
};

export const switchToLanMode = async () => {
  state.userPreferredMode = 'lan';
  try {
    localStorage.setItem('verity_preferred_mode', 'lan');
    if (window.electronAPI?.localDB?.setLocal) {
      window.electronAPI.localDB.setLocal('verity_preferred_mode', 'lan').catch(() => {});
    }
  } catch (_) {}
  await checkLocalHealth();
  const localUrl = getLocalApiUrl();
  announceServerChange(localUrl, { lan: true });
  notifyListeners();
  return { success: true, url: localUrl };
};

