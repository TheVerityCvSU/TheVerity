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
    if (cloud && (cloud.includes('localhost') || cloud.includes('127.0.0.1') || cloud.includes('vercel.app'))) {
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
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('verity_cloud_url');
    if (custom && custom.trim() && !custom.includes('localhost') && !custom.includes('127.0.0.1') && !custom.includes('vercel.app')) {
      return custom.trim().replace(/\/$/, '');
    }
  }

  const envUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  // If explicitly configured with a remote cloud URL (e.g. Render/AWS), use it
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // Always default to production Render Cloud URL
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

  let rawUrl = url ? String(url).trim() : '';

  // Clean up any "undefined/" or "null/" prefix from missing env vars
  if (/^(?:undefined|null)\b/i.test(rawUrl)) {
    rawUrl = rawUrl.replace(/^(?:undefined|null)\/?/i, '/');
  }

  // Extract path and query
  let pathWithQuery = rawUrl;
  if (/^https?:\/\/[^/]+/i.test(pathWithQuery)) {
    pathWithQuery = pathWithQuery.replace(/^https?:\/\/[^/]+/i, '');
  }
  if (!pathWithQuery.startsWith('/')) {
    pathWithQuery = '/' + pathWithQuery;
  }

  // Clean up any consecutive slashes in the path portion (e.g. //classrooms -> /classrooms)
  pathWithQuery = pathWithQuery.replace(/\/+/g, '/');

  // Cache busting for GET requests to prevent stale browser cache
  if (!options.method || options.method.toUpperCase() === 'GET') {
    const sep = pathWithQuery.includes('?') ? '&' : '?';
    pathWithQuery = `${pathWithQuery}${sep}_t=${Date.now()}`;
  }

  const primaryCloudUrl = `${cloudUrl}${pathWithQuery}`;
  const localFallbackUrl = `${localUrl}${pathWithQuery}`;

  // 1. Hosted Web (e.g. Vercel): Pure cloud mode (no local fallback server)
  if (isWebHosted) {
    try {
      const response = await fetch(primaryCloudUrl, { ...options, headers });
      if (isCloudDown) {
        isCloudDown = false;
        notifyListeners();
      }
      return response;
    } catch (err) {
      isCloudDown = true;
      notifyListeners();
      console.warn(`[apiFetch] Request to cloud server failed: ${primaryCloudUrl}`, err.message);
      throw err;
    }
  }

  // 2. Desktop / Electron / Local dev: Cloud-first with local fallback
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // If known offline or cloud is marked down, route directly to local server
  if (!isOnline || isCloudDown) {
    try {
      return await fetch(localFallbackUrl, { ...options, headers });
    } catch (localErr) {
      // If local server also fails, try cloud if online as last resort
      if (isOnline) {
        try {
          const res = await fetch(primaryCloudUrl, { ...options, headers });
          if (res.ok) {
            isCloudDown = false;
            notifyListeners();
            return res;
          }
        } catch (_) {}
      }
      throw localErr;
    }
  }

  // When online, attempt cloud server first
  try {
    const response = await fetch(primaryCloudUrl, { ...options, headers });
    if (response.ok) {
      if (isCloudDown) {
        isCloudDown = false;
        notifyListeners();
      }
      return response;
    }

    // If cloud returns 5xx (server error / cold start timeout), try local fallback
    if (response.status >= 500) {
      console.warn(`⚠️ [apiFetch] Cloud returned HTTP ${response.status}. Attempting local fallback: ${localFallbackUrl}`);
      try {
        const localRes = await fetch(localFallbackUrl, { ...options, headers });
        if (localRes.ok || localRes.status < 500) {
          return localRes;
        }
      } catch (_) {}
    }

    return response;
  } catch (err) {
    // Cloud request failed (network error, timeout, DNS)
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
};

export default apiFetch;
