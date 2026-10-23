/**
 * Hybrid Cloud-First with Local Offline Fallback API Client
 * 
 * Behavior:
 * 1. Cloud-First: Directs API requests to Cloud Server (Render / Supabase: https://verity-2z4v.onrender.com).
 * 2. Instant Local Fallback (Desktop/Electron/Dev): If device has no internet or cloud is down,
 *    automatically reroutes to local embedded server (http://localhost:3001).
 * 3. Hosted Web Safe: On hosted web platforms (e.g. Vercel), requests always target the cloud server
 *    and never mistakenly attempt to route to localhost:3001 or domain:3001.
 */

export const DEFAULT_CLOUD_API_URL = 'https://verity-2z4v.onrender.com';
export const LOCAL_DEV_API_URL = 'http://localhost:3001';

// Purge any stale or corrupted localStorage keys from older versions
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('verity_server_url');
    const cloud = localStorage.getItem('verity_cloud_url');
    if (cloud && (cloud.includes('localhost:3001') || cloud.includes('127.0.0.1:3001') || cloud.includes('vercel.app'))) {
      localStorage.removeItem('verity_cloud_url');
    }
  } catch (_) {}
}

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

export const getCloudUrl = () => {
  const isWebHosted = typeof window !== 'undefined' && 
                      window.location && 
                      !isPrivateHost(window.location.hostname) &&
                      !window.electronAPI;

  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('verity_cloud_url');
    if (custom && custom.trim() && !custom.includes('localhost:3001') && !custom.includes('127.0.0.1:3001') && !custom.includes('vercel.app')) {
      return custom.trim().replace(/\/$/, '');
    }
  }

  const envUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (envUrl) {
    if (isWebHosted && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return DEFAULT_CLOUD_API_URL;
    }
    return envUrl;
  }

  return DEFAULT_CLOUD_API_URL;
};

export const getLocalApiUrl = () => {
  if (typeof window !== 'undefined' && window.location && isPrivateHost(window.location.hostname) && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `http://${window.location.hostname}:3001`;
  }
  return LOCAL_DEV_API_URL;
};

export const LOCAL_API_URL = getLocalApiUrl();

// Tracking state
let isCloudDown = false;
const statusListeners = new Set();

export const getConnectionStatus = () => {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const isWebHosted = typeof window !== 'undefined' && 
                      window.location && 
                      !isPrivateHost(window.location.hostname) &&
                      !window.electronAPI;

  const cloudUrl = getCloudUrl();

  let activeMode = 'cloud';
  if (isWebHosted) {
    activeMode = (!isOnline || isCloudDown) ? 'offline' : 'cloud';
  } else {
    const hasCloud = Boolean(cloudUrl && cloudUrl !== LOCAL_API_URL);
    activeMode = (hasCloud && isOnline && !isCloudDown) ? 'cloud' : 'local';
  }

  return {
    isOnline,
    isCloudDown,
    activeMode, // 'cloud' | 'local' | 'offline'
    cloudUrl,
    localUrl: LOCAL_API_URL,
    isWebHosted
  };
};

export const subscribeConnectionStatus = (callback) => {
  statusListeners.add(callback);
  callback(getConnectionStatus());
  return () => statusListeners.delete(callback);
};

const notifyListeners = () => {
  const status = getConnectionStatus();
  statusListeners.forEach((fn) => {
    try { fn(status); } catch (_) {}
  });
};

// Probe Cloud Server health
export const checkCloudHealth = async () => {
  const cloudUrl = getCloudUrl();
  if (!cloudUrl || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    isCloudDown = true;
    notifyListeners();
    return false;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${cloudUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      if (isCloudDown) {
        console.log('🟢 [Network] Cloud server is online and operational. Switched to Cloud Mode.');
      }
      isCloudDown = false;
      notifyListeners();
      return true;
    }
  } catch (_) {
    // Cloud remains unreachable
  }

  isCloudDown = true;
  notifyListeners();
  return false;
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Network] Network connectivity restored. Probing cloud server...');
    checkCloudHealth();
  });

  window.addEventListener('offline', () => {
    console.warn('[Network] Network is offline.');
    isCloudDown = true;
    notifyListeners();
  });
}

/**
 * Universal apiFetch with automatic Cloud-to-Local fallback.
 */
export const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
  const headers = {
    ...options.headers,
  };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cloudUrl = getCloudUrl();
  const localUrl = getLocalApiUrl();
  const isWebHosted = typeof window !== 'undefined' &&
                      window.location &&
                      !isPrivateHost(window.location.hostname) &&
                      !window.electronAPI;

  let targetUrl = url ? String(url).trim() : '';

  // Clean up any "undefined/" or "null/" prefix from missing env vars
  if (/^(?:undefined|null)\b/i.test(targetUrl)) {
    targetUrl = targetUrl.replace(/^(?:undefined|null)\/?/i, '/');
  }

  // Resolve relative URLs to current active base
  if (targetUrl.startsWith('/')) {
    targetUrl = `${isWebHosted ? cloudUrl : (cloudUrl || localUrl)}${targetUrl}`;
  }

  // On hosted web (e.g. Vercel), rewrite any accidentally passed localhost or loopback calls to cloudUrl
  if (isWebHosted) {
    if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(targetUrl)) {
      targetUrl = targetUrl.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i, cloudUrl);
    } else if (/https?:\/\/[^/]+:3001/i.test(targetUrl)) {
      targetUrl = targetUrl.replace(/https?:\/\/[^/]+:3001/i, cloudUrl);
    } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `${cloudUrl}/${targetUrl.replace(/^\/+/, '')}`;
    }
  }

  // Clean up any double slashes in the path portion (e.g. https://domain.com//login -> https://domain.com/login)
  targetUrl = targetUrl.replace(/([^:])\/{2,}/g, '$1/');

  // Cache busting for GET requests to prevent stale data
  if (!options.method || options.method.toUpperCase() === 'GET') {
    const sep = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${sep}_t=${Date.now()}`;
  }

  // 1. Hosted Web: Pure cloud mode (no local fallback server)
  if (isWebHosted) {
    try {
      const response = await fetch(targetUrl, { ...options, headers });
      if (isCloudDown) {
        isCloudDown = false;
        notifyListeners();
      }
      return response;
    } catch (err) {
      isCloudDown = true;
      notifyListeners();
      console.warn(`[apiFetch] Request to cloud server failed: ${targetUrl}`, err.message);
      throw err;
    }
  }

  // 2. Desktop / Electron / Local dev: Cloud with local fallback
  const isTargetingCloud = cloudUrl && targetUrl.startsWith(cloudUrl) && cloudUrl !== localUrl;
  const localFallbackUrl = isTargetingCloud ? targetUrl.replace(cloudUrl, localUrl) : targetUrl;

  if (isTargetingCloud && (!navigator.onLine || isCloudDown)) {
    try {
      return await fetch(localFallbackUrl, { ...options, headers });
    } catch (localErr) {
      console.warn('[apiFetch] Local offline server failed:', localErr.message);
      throw localErr;
    }
  }

  try {
    const response = await fetch(targetUrl, { ...options, headers });
    if (response.ok) {
      if (isCloudDown) {
        isCloudDown = false;
        notifyListeners();
      }
      return response;
    }

    // If cloud server returned a 5xx error (e.g. 500 mail timeout / platform crash)
    // and we are targeting cloud in Electron/desktop/dev where local server is present:
    if (isTargetingCloud && response.status >= 500) {
      console.warn(`⚠️ [apiFetch] Cloud server returned HTTP ${response.status}. Attempting local server fallback: ${localFallbackUrl}`);
      try {
        const localRes = await fetch(localFallbackUrl, { ...options, headers });
        if (localRes.ok || localRes.status < 500) {
          return localRes;
        }
      } catch (localErr) {
        console.warn('[apiFetch] Local fallback also failed:', localErr.message);
      }
    }

    return response;
  } catch (err) {
    if (isTargetingCloud) {
      console.warn(`⚠️ [apiFetch] Cloud server unreachable (${err.message}). Seamlessly falling back to local server: ${localFallbackUrl}`);
      isCloudDown = true;
      notifyListeners();

      try {
        const localRes = await fetch(localFallbackUrl, { ...options, headers });
        return localRes;
      } catch (localErr) {
        console.error('❌ [apiFetch] Both cloud and local server failed:', localErr.message);
        throw err;
      }
    }
    throw err;
  }
};

export default apiFetch;
