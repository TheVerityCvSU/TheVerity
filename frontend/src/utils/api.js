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
    // Prioritize online server when there is an internet connection on startup
    if (typeof navigator === 'undefined' || navigator.onLine) {
      localStorage.removeItem('verity_preferred_mode');
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
let userPreferredMode = (() => {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('verity_preferred_mode') || null;
    } catch (_) {
      return null;
    }
  }
  return null;
})();

export const getUserPreferredMode = () => userPreferredMode;

const isElectronApp = () => typeof window !== 'undefined' && Boolean(window.electronAPI?.getDiscoveredServer);

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
      if (discovered) {
        console.log('📡 [Network] Live Verity Host discovered on LAN:', discovered);
        autoDiscoveredLanServer = discovered;
        isLocalServerUp = true;
        try { localStorage.setItem('verity_lan_server', discovered); } catch (_) {}
        checkLocalHealth();
        notifyListeners();
      } else if (autoDiscoveredLanServer) {
        console.log('📡 [Network] LAN Host disconnected. Returning to offline state.');
        autoDiscoveredLanServer = null;
        isLocalServerUp = false;
        localHealthData = null;
        notifyListeners();
      }
    });
  }
}

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
  if (autoDiscoveredLanServer) {
    return autoDiscoveredLanServer;
  }

  // 2. Web client accessed via LAN IP (phones, tablets, browser)
  if (typeof window !== 'undefined' && window.location && isPrivateHost(window.location.hostname) && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `http://${window.location.hostname}:3001`;
  }

  // 3. Default to local embedded server
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
let isLocalServerUp = false;
let localHealthPromise = null;
const statusListeners = new Set();

const isHostedWebEnv = () =>
  typeof window !== 'undefined' &&
  Boolean(window.location) &&
  !isPrivateHost(window.location.hostname) &&
  !window.electronAPI;

// Probe Local Server health to discover LAN interface and ComLab host status
export const checkLocalHealth = async () => {
  // Never probe localhost:3001 from public hosted web (e.g. Vercel)
  if (isHostedWebEnv()) {
    isLocalServerUp = false;
    localHealthData = null;
    return false;
  }
  if (localHealthPromise) return localHealthPromise;
  const localUrl = getLocalApiUrl();
  localHealthPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
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

    // If localUrl was autoDiscoveredLanServer and unreachable, clear it immediately
    if (autoDiscoveredLanServer && localUrl === autoDiscoveredLanServer) {
      console.log('⚠️ [Network] LAN Host unreachable. Clearing active LAN server.');
      autoDiscoveredLanServer = null;
    }
    isLocalServerUp = false;
    localHealthData = null;
    notifyListeners();
    return false;
  })().finally(() => {
    localHealthPromise = null;
  });
  return localHealthPromise;
};

export const getHasExplicitLanServer = () => {
  return Boolean(
    (autoDiscoveredLanServer && !autoDiscoveredLanServer.includes('localhost') && !autoDiscoveredLanServer.includes('127.0.0.1')) ||
    (typeof window !== 'undefined' && window.location && isPrivateHost(window.location.hostname) && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  );
};

export const getIsLanConnected = () => {
  if (userPreferredMode === 'cloud') return false;
  // If local server or LAN endpoint is down, we are NOT connected to LAN!
  if (!isLocalServerUp) return false;
  const hasExplicitLanServer = getHasExplicitLanServer();
  const isHost = Boolean(localHealthData && localHealthData.isHost === true);
  return hasExplicitLanServer || isHost;
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

/**
 * Fast auto-reconnection to LAN host:
 * Automatically probes previously saved LAN server and common host IPs.
 * Locks on within milliseconds without user clicking 'Connect to LAN'.
 */
export const attemptAutoLanReconnect = async () => {
  if (isHostedWebEnv()) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }

  let saved = null;
  if (typeof window !== 'undefined') {
    try { saved = localStorage.getItem('verity_lan_server'); } catch (_) {}
  }

  const candidates = [
    saved,
    'http://192.168.254.100:3001',
    'http://192.168.254.101:3001',
    'http://192.168.1.10:3001',
    'http://192.168.1.100:3001'
  ].filter(Boolean);

  const myHostnames = new Set(['localhost', '127.0.0.1', '::1']);

  for (const cand of candidates) {
    let clean = cand.trim().replace(/\/$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    try {
      const u = new URL(clean);
      if (myHostnames.has(u.hostname)) continue;
    } catch (_) {
      continue;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${clean}/health`, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.app === 'the-verity') {
          autoDiscoveredLanServer = clean;
          localHealthData = data;
          isLocalServerUp = true;
          try { localStorage.setItem('verity_lan_server', clean); } catch (_) {}
          if (window.electronAPI?.setLanServer) {
            window.electronAPI.setLanServer(clean).catch(() => {});
          }
          notifyListeners();
          console.log('⚡ [Network] Auto-connected to LAN Host:', clean);
          return true;
        }
      }
    } catch (_) {}
  }

  // Trigger Electron discovery scanner if available
  if (window.electronAPI?.scanLanServers) {
    try {
      const found = await window.electronAPI.scanLanServers();
      if (found) {
        autoDiscoveredLanServer = found;
        try { localStorage.setItem('verity_lan_server', found); } catch (_) {}
        await checkLocalHealth();
        notifyListeners();
        return true;
      }
    } catch (_) {}
  }

  return false;
};

// Run network probes immediately on startup and keep checking periodically for auto-recovery
if (typeof window !== 'undefined') {
  const hostedWeb = isHostedWebEnv();

  // Immediate initial health probe on app load (Cloud prioritized first)
  checkCloudHealth().then((cloudOk) => {
    if (!hostedWeb) {
      checkLocalHealth().then((localOk) => {
        if (!cloudOk && !localOk) {
          attemptAutoLanReconnect();
        }
      });
    }
  });

  // Background auto-recovery check:
  // - Prioritize checking cloud health so we stay on or recover to Online Cloud Server when internet is available
  // - Only auto-probe LAN if not on hosted web and cloud is down or user explicitly selected LAN mode
  setInterval(() => {
    if (isCloudDown || Date.now() - lastCloudCheckTime > 15000) {
      checkCloudHealth();
    }

    if (!hostedWeb) {
      if (userPreferredMode === 'lan' || isCloudDown || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        if (getIsLanConnected()) {
          checkLocalHealth();
        } else {
          attemptAutoLanReconnect();
        }
      } else if (getIsLanConnected()) {
        checkLocalHealth();
      }
    }
  }, 2500);

  window.addEventListener('online', () => {
    console.log('🟢 [Network] Internet connectivity restored. Prioritizing Online Cloud Server...');
    // Automatically prioritize Online Cloud Server when internet is restored
    if (userPreferredMode === 'lan') {
      userPreferredMode = null;
      try { localStorage.removeItem('verity_preferred_mode'); } catch (_) {}
    }
    checkCloudHealth();
    if (!hostedWeb) {
      checkLocalHealth();
      try {
        fetch(`${getLocalApiUrl()}/api/sync`, { method: 'POST' }).catch(() => {});
      } catch (_) {}
    }
  });

  window.addEventListener('offline', () => {
    console.log('🔴 [Network] Network connectivity lost. Immediately switching to Offline Mode.');
    autoDiscoveredLanServer = null;
    isLocalServerUp = false;
    localHealthData = null;
    notifyListeners();
    if (!hostedWeb) {
      checkLocalHealth();
    }
  });

  window.addEventListener('verity:lan-discovered', () => {
    if (!hostedWeb) checkLocalHealth();
  });
  window.addEventListener('verity:server-changed', () => {
    if (!hostedWeb) {
      checkLocalHealth();
      try {
        fetch(`${getLocalApiUrl()}/api/sync`, { method: 'POST' }).catch(() => {});
      } catch (_) {}
    }
  });

  // Automatic background synchronization between LAN and Cloud (only when running local/LAN server)
  if (!hostedWeb) {
    setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && isLocalServerUp) {
        try {
          fetch(`${getLocalApiUrl()}/api/sync`, { method: 'POST' }).catch(() => {});
        } catch (_) {}
      }
    }, 15000);

    window.addEventListener('focus', () => {
      if (typeof navigator !== 'undefined' && navigator.onLine && isLocalServerUp) {
        try {
          fetch(`${getLocalApiUrl()}/api/sync`, { method: 'POST' }).catch(() => {});
        } catch (_) {}
      }
    });
  }
}

export const setCustomLanServer = async (url) => {
  if (!url) {
    autoDiscoveredLanServer = null;
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
    userPreferredMode = 'cloud';
    autoDiscoveredLanServer = null;
    isCloudDown = false;
    lastCloudCheckTime = Date.now();
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('verity:server-changed', { detail: clean }));
      window.dispatchEvent(new CustomEvent('verity:classrooms-changed'));
      window.dispatchEvent(new CustomEvent('verity:users-changed'));
    }

    notifyListeners();
    return { success: true, url: clean, mode: 'cloud' };
  }

  // Otherwise, connect in LAN Mode
  userPreferredMode = 'lan';
  autoDiscoveredLanServer = clean;
  localHealthData = healthData;
  isLocalServerUp = true;
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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('verity:server-changed', { detail: clean }));
    window.dispatchEvent(new CustomEvent('verity:lan-discovered', { detail: clean }));
    window.dispatchEvent(new CustomEvent('verity:classrooms-changed'));
    window.dispatchEvent(new CustomEvent('verity:users-changed'));
  }

  checkLocalHealth();
  notifyListeners();
  return { success: true, url: clean, mode: 'lan' };
};

export const switchToCloudMode = () => {
  userPreferredMode = 'cloud';
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
  autoDiscoveredLanServer = null;
  isCloudDown = false;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('verity:server-changed', { detail: getCloudUrl() }));
    window.dispatchEvent(new CustomEvent('verity:classrooms-changed'));
    window.dispatchEvent(new CustomEvent('verity:users-changed'));
  }
  checkCloudHealth();
  notifyListeners();
};

export const switchToLanMode = async () => {
  userPreferredMode = 'lan';
  try {
    localStorage.setItem('verity_preferred_mode', 'lan');
    if (window.electronAPI?.localDB?.setLocal) {
      window.electronAPI.localDB.setLocal('verity_preferred_mode', 'lan').catch(() => {});
    }
  } catch (_) {}
  await checkLocalHealth();
  const localUrl = getLocalApiUrl();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('verity:server-changed', { detail: localUrl }));
    window.dispatchEvent(new CustomEvent('verity:lan-discovered', { detail: localUrl }));
    window.dispatchEvent(new CustomEvent('verity:classrooms-changed'));
    window.dispatchEvent(new CustomEvent('verity:users-changed'));
  }
  notifyListeners();
  return { success: true, url: localUrl };
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
      if (!liveDiscovered) {
        liveDiscovered = await waitForLanServer(1500);
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
    const fetchWithTimeout = async (targetUrl, timeoutMs = 15000) => {
      if (options.signal) {
        return fetch(targetUrl, { ...options, headers });
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(targetUrl, { ...options, headers, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      const response = await fetchWithTimeout(primaryCloudUrl, 15000);
      if (isCloudDown) {
        isCloudDown = false;
        notifyListeners();
      }
      return response;
    } catch (err) {
      // If a custom cloud URL in localStorage failed, reset to DEFAULT_CLOUD_API_URL and retry immediately
      const defaultTargetUrl = `${DEFAULT_CLOUD_API_URL}${pathWithQuery}`;
      if (cloudUrl !== DEFAULT_CLOUD_API_URL) {
        try { localStorage.removeItem('verity_cloud_url'); } catch (_) {}
      }
      try {
        const retryResponse = await fetchWithTimeout(defaultTargetUrl, 20000);
        if (isCloudDown) {
          isCloudDown = false;
          notifyListeners();
        }
        return retryResponse;
      } catch (retryErr) {
        isCloudDown = true;
        notifyListeners();
        console.warn(`[apiFetch] Request to cloud server failed: ${defaultTargetUrl}`, retryErr.message);
        throw new Error('Could not reach the online server. Please check your connection or try again in a moment.');
      }
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

  // 2. Desktop / Electron / Local dev: Prioritize Online Cloud Server when internet is available!
  // Only route to LAN server first if user explicitly switched to LAN mode, or if Online Cloud is unavailable.
  const isOnlineCloudAvailable = Boolean(
    cloudUrl &&
    cloudUrl !== localUrl &&
    !isCloudDown &&
    (typeof navigator === 'undefined' || navigator.onLine)
  );
  const isLanMode = userPreferredMode === 'lan'
    ? getIsLanConnected()
    : (userPreferredMode === 'cloud' ? false : (!isOnlineCloudAvailable && getIsLanConnected()));
  if (isLanMode) {
    try {
      const currentLocalUrl = getLocalApiUrl();
      const currentFallbackUrl = `${currentLocalUrl}${pathWithQuery}`;
      const localRes = await fetch(currentFallbackUrl, { ...options, headers });
      const method = (options.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        fetch(`${currentLocalUrl}/api/sync`, { method: 'POST' }).catch(() => {});
      }
      return localRes;
    } catch (lanErr) {
      console.warn(`[apiFetch] Direct request to LAN server failed (${localFallbackUrl}):`, lanErr.message);
      // Fall through to try cloud if available
    }
  }

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
