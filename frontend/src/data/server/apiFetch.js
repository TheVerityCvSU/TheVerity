/**
 * apiFetch: the one function every screen uses to talk to the server.
 * Tries the cloud server first and falls back to the local/LAN server automatically.
 */
import { state } from './connectionState';
import { DEFAULT_CLOUD_API_URL, getCloudUrl, getLocalApiUrl, isHostedWebEnv } from './serverUrls';
import { notifyListeners, getIsLanConnected } from './connectionStatus';
import { waitForLanServer } from './lanDiscovery';
import { buildRequestPath } from './buildRequestPath';
import { fetchBestUpdateInfo } from './updateCheck';
import { queueOfflineMutation } from './offlineQueue';

const MUTATION_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

// Asks the local server to sync with the cloud (fire-and-forget)
const pingSync = (baseUrl) => {
  fetch(`${baseUrl}/api/sync`, { method: 'POST' }).catch(() => {});
};

const markCloudUp = () => {
  if (state.isCloudDown) {
    state.isCloudDown = false;
    notifyListeners();
  }
};

// Make sure we use the latest LAN server discovered by Electron
const refreshDiscoveredLanServer = async () => {
  if (state.autoDiscoveredLanServer || typeof window === 'undefined' || !window.electronAPI?.getDiscoveredServer) return;
  try {
    let liveDiscovered = await window.electronAPI.getDiscoveredServer();
    if (!liveDiscovered) {
      liveDiscovered = await waitForLanServer(1500);
    }
    if (liveDiscovered) {
      state.autoDiscoveredLanServer = liveDiscovered;
      try { localStorage.setItem('verity_lan_server', liveDiscovered); } catch (_) {}
    }
  } catch (_) {}
};

// Hosted Web (e.g. Vercel): pure cloud mode, with one retry against the default cloud URL
const fetchHostedWeb = async ({ cloudUrl, primaryCloudUrl, pathWithQuery, options, headers }) => {
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
    markCloudUp();
    return response;
  } catch (err) {
    // If a custom cloud URL in localStorage failed, reset to DEFAULT_CLOUD_API_URL and retry immediately
    const defaultTargetUrl = `${DEFAULT_CLOUD_API_URL}${pathWithQuery}`;
    if (cloudUrl !== DEFAULT_CLOUD_API_URL) {
      try { localStorage.removeItem('verity_cloud_url'); } catch (_) {}
    }
    try {
      const retryResponse = await fetchWithTimeout(defaultTargetUrl, 20000);
      markCloudUp();
      return retryResponse;
    } catch (retryErr) {
      state.isCloudDown = true;
      notifyListeners();
      console.warn(`[apiFetch] Request to cloud server failed: ${defaultTargetUrl}`, retryErr.message);
      throw new Error('Could not reach the online server. Please check your connection or try again in a moment.');
    }
  }
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

  await refreshDiscoveredLanServer();

  const cloudUrl = getCloudUrl();
  const localUrl = getLocalApiUrl();
  const isWebHosted = isHostedWebEnv();
  const pathWithQuery = buildRequestPath(url, options);
  const method = (options.method || 'GET').toUpperCase();
  const isMutation = MUTATION_METHODS.includes(method);

  const primaryCloudUrl = `${cloudUrl}${pathWithQuery}`;
  const localFallbackUrl = `${localUrl}${pathWithQuery}`;

  // For update checking on desktop / dev, simultaneously probe both local and cloud servers.
  // Whichever reports a newer available version or updateAvailable = true wins!
  if (pathWithQuery.startsWith('/api/check-update')) {
    const updateResponse = await fetchBestUpdateInfo({ primaryCloudUrl, localFallbackUrl, localUrl, isWebHosted, options, headers });
    if (updateResponse) return updateResponse;
  }

  // 1. Hosted Web (e.g. Vercel): Pure cloud mode (no local fallback server)
  if (isWebHosted) {
    return fetchHostedWeb({ cloudUrl, primaryCloudUrl, pathWithQuery, options, headers });
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
    !state.isCloudDown &&
    (typeof navigator === 'undefined' || navigator.onLine)
  );
  const isLanMode = state.userPreferredMode === 'lan'
    ? getIsLanConnected()
    : (state.userPreferredMode === 'cloud' ? false : (!isOnlineCloudAvailable && getIsLanConnected()));
  if (isLanMode) {
    try {
      const currentLocalUrl = getLocalApiUrl();
      const localRes = await fetch(`${currentLocalUrl}${pathWithQuery}`, { ...options, headers });
      if (isMutation) pingSync(currentLocalUrl);
      return localRes;
    } catch (lanErr) {
      console.warn(`[apiFetch] Direct request to LAN server failed (${localFallbackUrl}):`, lanErr.message);
      // Fall through to try cloud if available
    }
  }

  // When cloud is marked down (e.g. offline ComLab), route directly to local/LAN server for instant response
  if (state.isCloudDown) {
    try {
      const localRes = await fetch(localFallbackUrl, { ...options, headers });
      if (isMutation) pingSync(localUrl);
      return localRes;
    } catch (localErr) {
      // If local server also fails, try cloud as last resort
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(primaryCloudUrl, { ...options, headers, signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          state.isCloudDown = false;
          notifyListeners();
          return res;
        }
      } catch (_) {}
      if (isMutation) queueOfflineMutation(pathWithQuery, method, options.body);
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
      markCloudUp();
      // If mutation, ping local server in background to sync immediately from Supabase
      if (isMutation && !isWebHosted) pingSync(localUrl);
      return response;
    }

    // If cloud returns 5xx (server error / cold start timeout), try local fallback
    if (response.status >= 500) {
      console.warn(`[apiFetch] Cloud returned HTTP ${response.status}. Attempting local fallback: ${localFallbackUrl}`);
      try {
        const localRes = await fetch(localFallbackUrl, { ...options, headers });
        if (localRes.ok || localRes.status < 500) {
          if (isMutation) pingSync(localUrl);
          return localRes;
        }
      } catch (_) {}
    }

    return response;
  } catch (err) {
    // Cloud request failed (network error, timeout, DNS failure)
    console.warn(`[apiFetch] Cloud server unreachable (${err.message}). Seamlessly falling back to local server: ${localFallbackUrl}`);
    state.isCloudDown = true;
    state.lastCloudCheckTime = Date.now();
    notifyListeners();

    // Discovery frequently completes while the cloud request was timing out — re-resolve the target
    await waitForLanServer(6000);
    const resolvedLocalUrl = getLocalApiUrl();

    try {
      const localRes = await fetch(`${resolvedLocalUrl}${pathWithQuery}`, { ...options, headers });
      if (isMutation) pingSync(resolvedLocalUrl);
      return localRes;
    } catch (localErr) {
      console.error('[apiFetch] Both cloud and local server failed:', localErr.message);
      if (isMutation) queueOfflineMutation(pathWithQuery, method, options.body);
      throw err;
    }
  }
};

export default apiFetch;

