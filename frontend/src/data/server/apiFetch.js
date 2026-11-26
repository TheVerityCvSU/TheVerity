/**
 * apiFetch: the one function every screen uses to talk to the server.
 * Tries the cloud server first and falls back to the local/LAN server automatically.
 */
import { state } from './connectionState';
import { DEFAULT_CLOUD_API_URL, getCloudUrl, getLocalApiUrl, isHostedWebEnv } from './serverUrls';
import { notifyListeners, hasDedicatedLanOrLocalDb } from './connectionStatus';
import { waitForLanServer } from './lanDiscovery';
import { buildRequestPath } from './buildRequestPath';
import { fetchBestUpdateInfo } from './updateCheck';
import { queueOfflineMutation } from './offlineQueue';

const MUTATION_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

const isAuthTokenPath = (pathWithQuery) =>
  Boolean(pathWithQuery) && (
    pathWithQuery.startsWith('/admin/login') ||
    pathWithQuery.startsWith('/login') ||
    pathWithQuery.startsWith('/register') ||
    pathWithQuery.startsWith('/verify-otp') ||
    pathWithQuery.startsWith('/auth/verify-otp') ||
    pathWithQuery.startsWith('/auth/google')
  );

// Email-delivery auth endpoints require cloud credentials (Brevo/Resend/SMTP) that packaged desktop apps do not ship.
const isEmailDeliveryAuthPath = (pathWithQuery) =>
  Boolean(pathWithQuery) && (
    pathWithQuery.startsWith('/auth/send-otp') ||
    pathWithQuery.startsWith('/auth/resend-otp') ||
    pathWithQuery.startsWith('/auth/verify-otp') ||
    pathWithQuery.startsWith('/users/send-email-change-otp')
  );

const recordAuthOrigin = (pathWithQuery, response, origin) => {
  if (!response || !response.ok || !isAuthTokenPath(pathWithQuery)) return;
  try {
    localStorage.setItem('verity_token_origin', origin);
    if (window.electronAPI?.localDB?.setLocal) {
      window.electronAPI.localDB.setLocal('verity_saved_session_token_origin', origin).catch(() => {});
    }
  } catch (_) {}
};

const handleServerResponse = async (response, { pathWithQuery, origin, hadAuthHeader }) => {
  recordAuthOrigin(pathWithQuery, response, origin);
  if (hadAuthHeader && response && (response.status === 401 || response.status === 403) && !isAuthTokenPath(pathWithQuery)) {
    try {
      const body = await response.clone().json().catch(() => null);
      const msg = String(body?.message || '').toLowerCase();
      if (msg.includes('invalid token') && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('verity:auth-invalid', {
          detail: {
            origin,
            message: 'Your session was signed by a different server or expired. Please sign in again.'
          }
        }));
      }
    } catch (_) {}
  }
  return response;
};

const shouldQueueClientOfflineMutation = (pathWithQuery, method) => {
  if (!MUTATION_METHODS.includes(method)) return false;
  if (!pathWithQuery) return false;
  if (pathWithQuery.startsWith('/api/sync')) return false;
  if (pathWithQuery.startsWith('/upload')) return false;
  if (pathWithQuery.startsWith('/login') || pathWithQuery.startsWith('/admin/login') || pathWithQuery.startsWith('/auth/')) return false;
  return true;
};

// Asks the local server to sync with the cloud (fire-and-forget)
const pingSync = (baseUrl) => {
  const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('verity_token') || localStorage.getItem('token')) : null;
  fetch(`${baseUrl}/api/sync`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).catch(() => {});
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
    return handleServerResponse(response, { pathWithQuery, origin: 'cloud', hadAuthHeader: Boolean(headers['Authorization']) });
  } catch {
    // If a custom cloud URL in localStorage failed, reset to DEFAULT_CLOUD_API_URL and retry immediately
    const defaultTargetUrl = `${DEFAULT_CLOUD_API_URL}${pathWithQuery}`;
    if (cloudUrl !== DEFAULT_CLOUD_API_URL) {
      try { localStorage.removeItem('verity_cloud_url'); } catch (_) {}
    }
    try {
      const retryResponse = await fetchWithTimeout(defaultTargetUrl, 20000);
      markCloudUp();
      return handleServerResponse(retryResponse, { pathWithQuery, origin: 'cloud', hadAuthHeader: Boolean(headers['Authorization']) });
    } catch (retryErr) {
      state.isCloudDown = true;
      notifyListeners();
      console.warn(`[apiFetch] Request to cloud server failed: ${defaultTargetUrl}`, retryErr.message);
      throw new Error('Could not reach the online server. Please check your connection or try again in a moment.', { cause: retryErr });
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
  const hadAuthHeader = Boolean(headers['Authorization']);

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

  const { cloudOnly, timeoutMs, ...fetchOptions } = options;
  const requestTimeoutMs = Number(timeoutMs) > 0 ? Number(timeoutMs) : 15000;

  // 1. Hosted Web (e.g. Vercel): Pure cloud mode (no local fallback server)
  if (isWebHosted) {
    return fetchHostedWeb({ cloudUrl, primaryCloudUrl, pathWithQuery, options: fetchOptions, headers });
  }

  // Force strict cloud-only attempt (used by background sync queue or explicit cloud-mode Admin auth)
  if (cloudOnly) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(primaryCloudUrl, { ...fetchOptions, headers, signal: fetchOptions.signal || controller.signal });
      if (response.ok) markCloudUp();
      return handleServerResponse(response, { pathWithQuery, origin: 'cloud', hadAuthHeader });
    } finally {
      clearTimeout(timer);
    }
  }

  // When targeting a local dev URL directly as cloud, bypass cloud logic
  if (cloudUrl === localUrl) {
    try {
      const res = await fetch(localFallbackUrl, { ...fetchOptions, headers });
      return handleServerResponse(res, { pathWithQuery, origin: 'lan', hadAuthHeader });
    } catch (localErr) {
      console.warn(`[apiFetch] Request to local/LAN server failed: ${localFallbackUrl}`, localErr.message);
      throw localErr;
    }
  }

  let tokenOrigin = null;
  try {
    tokenOrigin = localStorage.getItem('verity_token_origin');
  } catch (_) {}

  const isEmailAuth = isEmailDeliveryAuthPath(pathWithQuery);
  const isNavOnlineNow = typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  const preferLanOrDevDb =
    state.userPreferredMode === 'lan' ||
    (!isEmailAuth && state.userPreferredMode !== 'cloud' && hasDedicatedLanOrLocalDb()) ||
    (!isEmailAuth && state.userPreferredMode !== 'cloud' && tokenOrigin === 'lan' && hadAuthHeader && !isAuthTokenPath(pathWithQuery));

  // 2. Local Dev DB / Explicit or Auto-Discovered ComLab LAN Host:
  // Prioritize Local/LAN server first for instant response!
  if (preferLanOrDevDb) {
    try {
      const currentLocalUrl = getLocalApiUrl();
      const localRes = await fetch(`${currentLocalUrl}${pathWithQuery}`, { ...fetchOptions, headers });
      if (localRes.ok || localRes.status < 500) {
        if (!state.isLocalServerUp) {
          state.isLocalServerUp = true;
          notifyListeners();
        }
        if (isMutation && state.localHealthData?.hasCloudDb) pingSync(currentLocalUrl);
        return handleServerResponse(localRes, { pathWithQuery, origin: 'lan', hadAuthHeader });
      }
    } catch (lanErr) {
      if (state.userPreferredMode === 'lan') {
        throw new Error(`Could not connect to Local/LAN server at ${getLocalApiUrl()}. Please check that the server is running.`, { cause: lanErr });
      }
      state.isLocalServerUp = false;
    }
  }

  const isNavOffline = !isNavOnlineNow;
  const shouldBypassCloudProbe = isNavOffline || (!isEmailAuth && state.isCloudDown && Date.now() - state.lastCloudCheckTime < 8000);

  // When offline / cloud recently down, route to embedded local fallback immediately
  if (shouldBypassCloudProbe) {
    try {
      const localRes = await fetch(localFallbackUrl, { ...fetchOptions, headers });
      if (localRes.ok && shouldQueueClientOfflineMutation(pathWithQuery, method) && !state.localHealthData?.hasCloudDb) {
        queueOfflineMutation(pathWithQuery, method, fetchOptions.body);
      } else if (isMutation && state.localHealthData?.hasCloudDb) {
        pingSync(localUrl);
      }
      return handleServerResponse(localRes, { pathWithQuery, origin: 'lan', hadAuthHeader });
    } catch (localErr) {
      if (!isNavOffline) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(primaryCloudUrl, { ...fetchOptions, headers, signal: controller.signal });
          clearTimeout(timer);
          if (res.ok) markCloudUp();
          return handleServerResponse(res, { pathWithQuery, origin: 'cloud', hadAuthHeader });
        } catch (_) {}
      }
      if (shouldQueueClientOfflineMutation(pathWithQuery, method)) {
        queueOfflineMutation(pathWithQuery, method, fetchOptions.body);
      }
      throw localErr;
    }
  }

  // Standalone desktop client (or Cloud Mode): route to Cloud server first, falling back to local offline server on failure
  try {
    let cloudSignal = fetchOptions.signal;
    let cloudTimer;
    if (!cloudSignal) {
      const controller = new AbortController();
      cloudTimer = setTimeout(() => controller.abort(), requestTimeoutMs);
      cloudSignal = controller.signal;
    }

    let response;
    try {
      response = await fetch(primaryCloudUrl, { ...fetchOptions, headers, signal: cloudSignal });
    } finally {
      if (cloudTimer) clearTimeout(cloudTimer);
    }

    if (response.ok) {
      markCloudUp();
      if (isMutation && !isWebHosted && state.localHealthData?.hasCloudDb) pingSync(localUrl);
      return handleServerResponse(response, { pathWithQuery, origin: 'cloud', hadAuthHeader });
    }

    // If cloud returns 5xx (server error / cold start timeout), try local fallback
    if (response.status >= 500) {
      let cloudEmailFailure = false;
      if (isEmailAuth) {
        try {
          const cloudBody = await response.clone().json();
          cloudEmailFailure = Boolean(cloudBody?.emailDeliveryFailed);
        } catch (_) {}
      }
      console.warn(`[apiFetch] Cloud returned HTTP ${response.status}. Attempting local fallback: ${localFallbackUrl}`);
      try {
        const localRes = await fetch(localFallbackUrl, { ...fetchOptions, headers });
        if (cloudEmailFailure ? localRes.ok : (localRes.ok || localRes.status < 500)) {
          if (localRes.ok && shouldQueueClientOfflineMutation(pathWithQuery, method) && !state.localHealthData?.hasCloudDb) {
            queueOfflineMutation(pathWithQuery, method, fetchOptions.body);
          } else if (isMutation && state.localHealthData?.hasCloudDb) {
            pingSync(localUrl);
          }
          return handleServerResponse(localRes, { pathWithQuery, origin: 'lan', hadAuthHeader });
        }
      } catch (_) {}
    }

    return handleServerResponse(response, { pathWithQuery, origin: 'cloud', hadAuthHeader });
  } catch (err) {
    // Cloud request failed (network error, timeout, DNS failure)
    console.warn(`[apiFetch] Cloud server unreachable (${err.message}). Seamlessly falling back to local server: ${localFallbackUrl}`);
    state.isCloudDown = true;
    state.lastCloudCheckTime = Date.now();
    notifyListeners();

    const resolvedLocalUrl = getLocalApiUrl();
    try {
      const localRes = await fetch(`${resolvedLocalUrl}${pathWithQuery}`, { ...fetchOptions, headers });
      if (localRes.ok && shouldQueueClientOfflineMutation(pathWithQuery, method) && !state.localHealthData?.hasCloudDb) {
        queueOfflineMutation(pathWithQuery, method, fetchOptions.body);
      } else if (isMutation && state.localHealthData?.hasCloudDb) {
        pingSync(resolvedLocalUrl);
      }
      return handleServerResponse(localRes, { pathWithQuery, origin: 'lan', hadAuthHeader });
    } catch (localErr) {
      console.error('[apiFetch] Both cloud and local server failed:', localErr.message);
      if (shouldQueueClientOfflineMutation(pathWithQuery, method)) {
        queueOfflineMutation(pathWithQuery, method, fetchOptions.body);
      }
      throw err;
    }
  }
};

export default apiFetch;

