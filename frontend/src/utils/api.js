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
    localStorage.removeItem('verity_custom_server');
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

// In-memory holder for auto-discovered LAN host from Electron UDP discovery
let autoDiscoveredLanServer = null;

const isElectronApp = () => typeof window !== 'undefined' && Boolean(window.electronAPI?.getDiscoveredServer);

// In the desktop app, Electron's LAN client is the single source of truth for the host address.
// A cached address from a previous session may now belong to THIS laptop (DHCP reassignment),
// which would silently route logins to our own empty embedded server. Drop it on startup.
if (isElectronApp()) {
  try { localStorage.removeItem('verity_lan_server'); } catch (_) {}
}

/**
 * Waits (up to timeoutMs) for Electron's LAN client to lock onto the Host server.
 * Returns the discovered URL or null.
 */
export const waitForLanServer = async (timeoutMs = 6000) => {
  if (autoDiscoveredLanServer) return autoDiscoveredLanServer;
  if (!isElectronApp()) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const found = await window.electronAPI.getDiscoveredServer();
      if (found) {
        autoDiscoveredLanServer = found;
        try { localStorage.setItem('verity_lan_server', found); } catch (_) {}
        notifyListeners();
        return found;
      }
    } catch (_) {
      return null;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
};

// Initialize LAN auto-discovery listener in Electron
if (typeof window !== 'undefined') {
  // Query initial discovered server from Electron main process
  if (window.electronAPI?.getDiscoveredServer) {
    window.electronAPI.getDiscoveredServer().then((discovered) => {
      if (discovered && !autoDiscoveredLanServer) {
        console.log('📡 [Network] Detected Verity Host via LAN Auto-Discovery:', discovered);
        autoDiscoveredLanServer = discovered;
        try { localStorage.setItem('verity_lan_server', discovered); } catch (_) {}
        checkLocalHealth();
        notifyListeners();
      }
    }).catch(() => {});
  }

  // Subscribe to real-time LAN host discovery events
  if (window.electronAPI?.onLanServerDiscovered) {
    window.electronAPI.onLanServerDiscovered((discovered) => {
      if (discovered && discovered !== autoDiscoveredLanServer) {
        console.log('📡 [Network] Live Verity Host discovered on LAN:', discovered);
        autoDiscoveredLanServer = discovered;
        try { localStorage.setItem('verity_lan_server', discovered); } catch (_) {}
        checkLocalHealth();
        notifyListeners();
      } else if (!discovered && autoDiscoveredLanServer) {
        console.log('📡 [Network] LAN Host disconnected. Returning to offline state.');
        autoDiscoveredLanServer = null;
        try { localStorage.removeItem('verity_lan_server'); } catch (_) {}
        checkLocalHealth();
        notifyListeners();
      }
    });
  }
}

/**
 * Cloud URL: Strictly the remote cloud (Render).
 * When internet is available, all requests go here.
 */
export const getCloudUrl = () => {
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
  if (autoDiscoveredLanServer) {
    return autoDiscoveredLanServer;
  }

  // 2. Cached LAN server from previous discovery session (web/browser clients only;
  //    in Electron the live discovery above is authoritative)
  if (typeof window !== 'undefined' && !isElectronApp()) {
    try {
      const cached = localStorage.getItem('verity_lan_server');
      if (cached && cached.trim()) {
        return cached.trim().replace(/\/$/, '');
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
    Boolean(window.location && isPrivateHost(window.location.hostname)) ||
    (navigator.userAgent && navigator.userAgent.includes('TheVerity'))
  );

  const isWebHosted = typeof window !== 'undefined' &&
                      window.location &&
                      !isPrivateHost(window.location.hostname) &&
                      !isElectron;

  // In Electron desktop app, or when offline / cloud is down, or on localhost / LAN:
  // always compile using the local engine!
  if (isElectron || isCloudDown || !isWebHosted) {
    return getLocalApiUrl();
  }

  return getCloudUrl();
};

// Tracking state
let isCloudDown = false;
let lastCloudCheckTime = 0;
let healthCheckPromise = null;
let localHealthData = null;
let isLocalServerUp = true;
let localHealthPromise = null;
const statusListeners = new Set();

// Probe Local Server health to discover LAN interface and ComLab host status
export const checkLocalHealth = async () => {
  if (localHealthPromise) return localHealthPromise;
  const localUrl = getLocalApiUrl();
  localHealthPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${localUrl}/health`, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.app === 'the-verity') {
          localHealthData = data;
          isLocalServerUp = true;
          notifyListeners();
          return true;
        }
      }
    } catch (_) {}
    isLocalServerUp = false;
    notifyListeners();
    return false;
  })().finally(() => {
    localHealthPromise = null;
  });
  return localHealthPromise;
};

export const getConnectionStatus = () => {
  const isWebHosted = typeof window !== 'undefined' && 
                      window.location && 
                      !isPrivateHost(window.location.hostname) &&
                      !window.electronAPI;

  const cloudUrl = getCloudUrl();
  const localUrl = getLocalApiUrl();
  const hasCloud = Boolean(cloudUrl && cloudUrl !== localUrl);
  const isNavOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Determine whether this client is connected to a LAN Server:
  // 1. autoDiscoveredLanServer is active (UDP beacon discovered the Teacher host on LAN router)
  // 2. OR custom LAN server configured in localStorage (not localhost/127.0.0.1)
  // 3. OR web client running on a private LAN IP (e.g. phones/tablets or browser connected to teacher IP)
  // 4. OR local server is running and broadcasting on physical LAN interface (ComLab host mode)
  const hasExplicitLanServer = Boolean(
    autoDiscoveredLanServer ||
    (typeof window !== 'undefined' && (
      (localStorage.getItem('verity_lan_server') && !localStorage.getItem('verity_lan_server').includes('localhost') && !localStorage.getItem('verity_lan_server').includes('127.0.0.1')) ||
      (window.location && isPrivateHost(window.location.hostname) && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ))
  );

  const isLocalHostOnLan = Boolean(
    isLocalServerUp && (
      hasExplicitLanServer ||
      (localHealthData && localHealthData.isHost === true)
    )
  );

  const isLanConnected = hasExplicitLanServer || isLocalHostOnLan;

  let activeMode = 'cloud';
  if (isWebHosted) {
    if (isCloudDown || !isNavOnline) {
      activeMode = isLanConnected ? 'lan' : 'offline';
    } else {
      activeMode = 'cloud';
    }
  } else {
    // Desktop / Electron
    if (hasCloud && !isCloudDown && isNavOnline) {
      activeMode = 'cloud';
    } else if (isLanConnected) {
      activeMode = 'lan';
    } else {
      activeMode = 'offline';
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
    isOnline: !isCloudDown && isNavOnline,
    isCloudDown,
    isNavOnline,
    activeMode, // 'cloud' | 'lan' | 'offline'
    isLanConnected,
    lanHostDisplay,
    cloudUrl,
    localUrl,
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

// Probe Cloud Server health with active network verification
export const checkCloudHealth = async () => {
  const cloudUrl = getCloudUrl();
  if (!cloudUrl) {
    isCloudDown = true;
    notifyListeners();
    return false;
  }

  if (healthCheckPromise) return healthCheckPromise;

  healthCheckPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${cloudUrl}/health`, { 
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timer);

      if (res.ok) {
        if (isCloudDown) {
          console.log('🟢 [Network] Cloud server is reachable. Connected to Render Cloud Mode.');
        }
        isCloudDown = false;
        lastCloudCheckTime = Date.now();
        notifyListeners();
        return true;
      }
    } catch (_) {
      // Cloud unreachable
    }

    isCloudDown = true;
    lastCloudCheckTime = Date.now();
    notifyListeners();
    return false;
  })().finally(() => {
    healthCheckPromise = null;
  });

  return healthCheckPromise;
};

// Run network probes immediately on startup and keep checking periodically for auto-recovery
if (typeof window !== 'undefined') {
  // Immediate initial health probe on app load
  checkCloudHealth();
  checkLocalHealth();

  // Background auto-recovery check: probe every 8 seconds when cloud is down to instantly pop back online
  setInterval(() => {
    if (isCloudDown || Date.now() - lastCloudCheckTime > 30000) {
      checkCloudHealth();
    }
    checkLocalHealth();
  }, 8000);

  window.addEventListener('online', () => {
    console.log('[Network] Network connectivity restored. Probing cloud and local servers...');
    checkCloudHealth();
    checkLocalHealth();
    try {
      fetch(`${getLocalApiUrl()}/api/sync`, { method: 'POST' }).catch(() => {});
    } catch (_) {}
  });

  window.addEventListener('offline', () => {
    // Probe rather than blindly marking offline, to avoid false positives on multi-adapter/Wi-Fi setups
    checkCloudHealth();
    checkLocalHealth();
  });

  window.addEventListener('verity:lan-discovered', () => {
    checkLocalHealth();
  });
  window.addEventListener('verity:server-changed', () => {
    checkLocalHealth();
  });
}

export const setCustomLanServer = async (url) => {
  if (!url) return false;
  let clean = url.trim().replace(/\/$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `http://${clean}`;
  }
  if (!clean.replace(/^https?:\/\//, '').includes(':')) {
    clean = `${clean}:3001`;
  }
  autoDiscoveredLanServer = clean;
  try {
    localStorage.setItem('verity_lan_server', clean);
    if (window.electronAPI?.localDB?.setLocal) {
      await window.electronAPI.localDB.setLocal('verity_lan_server', clean);
    }
  } catch (_) {}
  notifyListeners();
  return true;
};

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

  // Ensure latest discovered server from Electron is applied
  if (!autoDiscoveredLanServer && typeof window !== 'undefined' && window.electronAPI?.getDiscoveredServer) {
    try {
      let liveDiscovered = await window.electronAPI.getDiscoveredServer();
      // If offline in ComLab and still waiting on discovery, give the background scan time to lock on
      const isNavOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (!liveDiscovered && (isCloudDown || isNavOffline)) {
        liveDiscovered = await waitForLanServer(6000);
      }
      if (liveDiscovered) {
        autoDiscoveredLanServer = liveDiscovered;
        try { localStorage.setItem('verity_lan_server', liveDiscovered); } catch (_) {}
      }
    } catch (_) {}
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

  // For update checking on desktop / dev, simultaneously probe both local and cloud servers.
  // Whichever reports a newer available version or updateAvailable = true wins!
  if (pathWithQuery.startsWith('/api/check-update')) {
    const isNewerVer = (v1, v2) => {
      if (!v1 || !v2) return false;
      const p1 = String(v1).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
      const p2 = String(v2).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const a = p1[i] || 0;
        const b = p2[i] || 0;
        if (a > b) return true;
        if (a < b) return false;
      }
      return false;
    };

    try {
      const promises = [
        fetch(primaryCloudUrl, { ...options, headers }).then(r => r.ok ? r.json() : null).catch(() => null)
      ];
      if (!isWebHosted) {
        promises.push(
          fetch(localFallbackUrl, { ...options, headers }).then(r => r.ok ? r.json() : null).catch(() => null)
        );
      }
      const [cloudData, localData] = await Promise.all(promises);

      let best = localData || cloudData;
      if (localData && cloudData) {
        if (localData.updateAvailable && !cloudData.updateAvailable) {
          best = localData;
        } else if (cloudData.updateAvailable && !localData.updateAvailable) {
          best = cloudData;
        } else if (isNewerVer(localData.latestVersion, cloudData.latestVersion)) {
          best = localData;
        } else if (isNewerVer(cloudData.latestVersion, localData.latestVersion)) {
          best = cloudData;
        } else {
          best = localData;
        }
      }

      if (best) {
        if (best.downloadUrl) {
          if (best.downloadUrl.startsWith('/')) {
            best.downloadUrl = `${localUrl}${best.downloadUrl}`;
          } else if (best.downloadUrl.includes('localhost:3001') && localUrl !== 'http://localhost:3001') {
            best.downloadUrl = best.downloadUrl.replace(/https?:\/\/localhost:3001/i, localUrl);
          } else if ((isCloudDown || !cloudData) && !best.downloadUrl.startsWith(localUrl)) {
            // Client is offline from internet: ensure download routes through verified LAN server
            const isAdminApp = best.downloadUrl.includes('admin');
            best.downloadUrl = `${localUrl}/api/download-update${isAdminApp ? '?app=admin' : ''}`;
          }
        }
        return new Response(JSON.stringify(best), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (_) {}
  }

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

  // When targeting a local dev URL directly as cloud, bypass cloud logic
  if (cloudUrl === localUrl) {
    try {
      return await fetch(localFallbackUrl, { ...options, headers });
    } catch (localErr) {
      console.warn(`[apiFetch] Request to local/LAN server failed: ${localFallbackUrl}`, localErr.message);
      throw localErr;
    }
  }

  // 2. Desktop / Electron / Local dev: Cloud-first with local fallback
  // When cloud is marked down (e.g. offline ComLab), route directly to local/LAN server for instant response
  if (isCloudDown) {
    try {
      const localRes = await fetch(localFallbackUrl, { ...options, headers });
      const method = (options.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        fetch(`${localUrl}/api/sync`, { method: 'POST' }).catch(() => {});
      }
      return localRes;
    } catch (localErr) {
      // If local server also fails, try cloud as last resort
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(primaryCloudUrl, { ...options, headers, signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          isCloudDown = false;
          notifyListeners();
          return res;
        }
      } catch (_) {}
      const method = (options.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        try {
          if (typeof window !== 'undefined') {
            if (window.electronAPI?.localDB?.addToSyncQueue) {
              window.electronAPI.localDB.addToSyncQueue('api_mutation', pathWithQuery, method, options.body || null);
            } else {
              const q = JSON.parse(localStorage.getItem('verity_sync_queue') || '[]');
              q.push({ id: Date.now(), action: 'api_mutation', url: pathWithQuery, method, body: options.body || null, created_at: new Date().toISOString() });
              localStorage.setItem('verity_sync_queue', JSON.stringify(q));
            }
            console.log(`📦 [apiFetch] Offline: Queued ${method} ${pathWithQuery} for automatic sync upon reconnection.`);
          }
        } catch (_) {}
      }
      throw localErr;
    }
  }

  // When cloud is operational (normal state), attempt cloud server first
  try {
    let cloudSignal = options.signal;
    let cloudTimer;
    if (!cloudSignal) {
      const controller = new AbortController();
      cloudTimer = setTimeout(() => controller.abort(), 5500);
      cloudSignal = controller.signal;
    }

    let response;
    try {
      response = await fetch(primaryCloudUrl, { ...options, headers, signal: cloudSignal });
    } finally {
      if (cloudTimer) clearTimeout(cloudTimer);
    }

    if (response.ok) {
      if (isCloudDown) {
        isCloudDown = false;
        notifyListeners();
      }
      // If mutation, ping local server in background to sync immediately from Supabase
      const method = (options.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && !isWebHosted) {
        fetch(`${localUrl}/api/sync`, { method: 'POST' }).catch(() => {});
      }
      return response;
    }

    // If cloud returns 5xx (server error / cold start timeout), try local fallback
    if (response.status >= 500) {
      console.warn(`⚠️ [apiFetch] Cloud returned HTTP ${response.status}. Attempting local fallback: ${localFallbackUrl}`);
      try {
        const localRes = await fetch(localFallbackUrl, { ...options, headers });
        if (localRes.ok || localRes.status < 500) {
          const method = (options.method || 'GET').toUpperCase();
          if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            fetch(`${localUrl}/api/sync`, { method: 'POST' }).catch(() => {});
          }
          return localRes;
        }
      } catch (_) {}
    }

    return response;
  } catch (err) {
    // Cloud request failed (network error, timeout, DNS failure)
    console.warn(`⚠️ [apiFetch] Cloud server unreachable (${err.message}). Seamlessly falling back to local server: ${localFallbackUrl}`);
    isCloudDown = true;
    lastCloudCheckTime = Date.now();
    notifyListeners();

    // Discovery frequently completes while the cloud request was timing out — re-resolve the target
    await waitForLanServer(6000);
    const resolvedLocalUrl = getLocalApiUrl();
    const resolvedFallbackUrl = `${resolvedLocalUrl}${pathWithQuery}`;

    try {
      const localRes = await fetch(resolvedFallbackUrl, { ...options, headers });
      const method = (options.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        fetch(`${resolvedLocalUrl}/api/sync`, { method: 'POST' }).catch(() => {});
      }
      return localRes;
    } catch (localErr) {
      console.error('❌ [apiFetch] Both cloud and local server failed:', localErr.message);
      const method = (options.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        try {
          if (typeof window !== 'undefined') {
            if (window.electronAPI?.localDB?.addToSyncQueue) {
              window.electronAPI.localDB.addToSyncQueue('api_mutation', pathWithQuery, method, options.body || null);
            } else {
              const q = JSON.parse(localStorage.getItem('verity_sync_queue') || '[]');
              q.push({ id: Date.now(), action: 'api_mutation', url: pathWithQuery, method, body: options.body || null, created_at: new Date().toISOString() });
              localStorage.setItem('verity_sync_queue', JSON.stringify(q));
            }
            console.log(`📦 [apiFetch] Offline: Queued ${method} ${pathWithQuery} for automatic sync upon reconnection.`);
          }
        } catch (_) {}
      }
      throw err;
    }
  }
};

export default apiFetch;
