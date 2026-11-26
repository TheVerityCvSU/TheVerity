/**
 * Server addresses: works out which URL to talk to (cloud, LAN, or local).
 */
import { state } from './connectionState';

export const DEFAULT_CLOUD_API_URL = 'https://verity-2z4v.onrender.com';
export const LOCAL_DEV_API_URL = 'http://localhost:3001';

export const isPrivateHost = (hostname) => {
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local')) {
    return true;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return false;
};

export const normalizeHttpUrl = (raw) => {
  const clean = String(raw || '').trim().replace(/\/$/, '');
  if (!clean) return '';
  return (clean.startsWith('http://') || clean.startsWith('https://')) ? clean : `http://${clean}`;
};

export const isLoopbackUrl = (raw) => {
  const clean = normalizeHttpUrl(raw);
  if (!clean) return false;
  try {
    const host = new URL(clean).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch (_) {
    return clean.includes('localhost') || clean.includes('127.0.0.1');
  }
};

export const probeVerityHealth = async (url, timeoutMs = 1200) => {
  const clean = normalizeHttpUrl(url);
  if (!clean) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${clean}/health`, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return (data && data.app === 'the-verity') ? data : null;
  } catch (_) {
    return null;
  }
};

export const promoteLoopbackToLan = async (url, healthData, timeoutMs = 1000) => {
  const clean = normalizeHttpUrl(url);
  if (!clean || !isLoopbackUrl(clean)) {
    return { targetUrl: clean, healthData };
  }
  const lanIps = Array.isArray(healthData?.lanIps) ? healthData.lanIps : [];
  let port = '3001';
  try {
    port = new URL(clean).port || '3001';
  } catch (_) {}

  for (const ip of lanIps) {
    if (!ip || isLoopbackUrl(`http://${ip}`)) continue;
    const lanUrl = `http://${ip}:${port}`;
    const lanHealth = await probeVerityHealth(lanUrl, timeoutMs);
    if (lanHealth) {
      return { targetUrl: lanUrl, healthData: lanHealth };
    }
  }
  return { targetUrl: clean, healthData };
};

export const isElectronApp = () => typeof window !== 'undefined' && Boolean(window.electronAPI?.getDiscoveredServer);

// True on public hosted web (e.g. Vercel): not Electron and not on a private/LAN address
export const isHostedWebEnv = () =>
  typeof window !== 'undefined' &&
  Boolean(window.location) &&
  !isPrivateHost(window.location.hostname) &&
  !window.electronAPI;

/**
 * Cloud URL: Strictly the remote online cloud server (Render or custom online server).
 * When internet is available, all requests go here by default.
 */
export const getCloudUrl = () => {
  if (typeof window !== 'undefined') {
    try {
      const customCloud = (localStorage.getItem('verity_cloud_url') || '').trim().replace(/\/$/, '');
      if (customCloud && !customCloud.includes('localhost') && !customCloud.includes('127.0.0.1') && !customCloud.includes('vercel.app')) {
        const host = customCloud.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
        if (!isPrivateHost(host)) {
          return customCloud;
        }
      }
    } catch (_) {}
  }
  const envUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  return DEFAULT_CLOUD_API_URL;
};

/**
 * Local API URL: Used when offline or cloud is down.
 * In a ComLab, this automatically resolves to the Teacher's LAN IP via UDP Auto-Discovery!
 * If standalone offline, it resolves to localhost:3001.
 */
export const getLocalApiUrl = () => {
  // 1. Live auto-discovered LAN server
  if (state.autoDiscoveredLanServer) {
    return state.autoDiscoveredLanServer;
  }

  // 2. Saved custom LAN/local server in localStorage
  if (typeof window !== 'undefined') {
    try {
      const savedLan = localStorage.getItem('verity_lan_server') || localStorage.getItem('verity_custom_server');
      if (savedLan) {
        return savedLan.trim().replace(/\/$/, '');
      }
    } catch (_) {}
  }

  // 3. Web client accessed via LAN IP (phones, tablets, browser)
  if (typeof window !== 'undefined' && window.location && isPrivateHost(window.location.hostname) && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `http://${window.location.hostname}:3001`;
  }

  // 4. Default to local embedded server
  return LOCAL_DEV_API_URL;
};

export const LOCAL_API_URL = getLocalApiUrl();

/**
 * Resolves the socket URL for the code execution/compiler engine.
 * Priority:
 * 1. If a custom server URL is saved in localStorage (e.g. Teacher LAN IP), use it.
 * 2. In Electron desktop app, or when offline / cloud is down, or on localhost / private network:
 *    ALWAYS use the local embedded server (http://localhost:3001 or LAN IP).
 * 3. On hosted web (with internet): use Cloud URL.
 */
export const getCompilerSocketUrl = () => {
  const isElectron = typeof window !== 'undefined' && (
    Boolean(window.electronAPI) ||
    Boolean(navigator.userAgent && navigator.userAgent.includes('TheVerity'))
  );

  const isWebHosted = typeof window !== 'undefined' &&
                      window.location &&
                      !isPrivateHost(window.location.hostname) &&
                      !isElectron;

  // In Electron desktop app, compile using the student device's local embedded engine (http://localhost:3001)
  // This isolates all code execution to the client PC and offloads CPU strain from the central LAN/cloud server.
  if (isElectron) {
    return LOCAL_DEV_API_URL;
  }

  // LAN browser/mobile clients (e.g. http://192.168.x.x) or offline/cloud-down mode route to getLocalApiUrl()
  if (state.isCloudDown || !isWebHosted) {
    return getLocalApiUrl();
  }

  return getCloudUrl();
};

