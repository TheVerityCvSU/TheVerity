/**
 * Health checks: pings the cloud and local servers to see if they are reachable.
 */
import { state } from './connectionState';
import { getCloudUrl, getLocalApiUrl, isHostedWebEnv, isLoopbackUrl, probeVerityHealth, promoteLoopbackToLan } from './serverUrls';
import { notifyListeners } from './connectionStatus';

let healthCheckPromise = null;
let localHealthPromise = null;

// Probe Local Server health to discover LAN interface and ComLab host status
export const checkLocalHealth = async () => {
  // Never probe localhost:3001 from public hosted web (e.g. Vercel)
  if (isHostedWebEnv()) {
    state.isLocalServerUp = false;
    state.localHealthData = null;
    return false;
  }
  if (localHealthPromise) return localHealthPromise;
  const localUrl = getLocalApiUrl();
  localHealthPromise = (async () => {
    const data = await probeVerityHealth(localUrl, 2000);
    if (data) {
      let finalData = data;
      // If localhost is running as a Host or Cloud-backed server, promote to its real LAN IP
      if (isLoopbackUrl(localUrl) && (data.isHost === true || data.hasCloudDb === true)) {
        const promoted = await promoteLoopbackToLan(localUrl, data, 1000);
        if (promoted.targetUrl && !isLoopbackUrl(promoted.targetUrl)) {
          finalData = promoted.healthData;
          state.autoDiscoveredLanServer = promoted.targetUrl;
          try { localStorage.setItem('verity_lan_server', promoted.targetUrl); } catch (_) {}
          if (typeof window !== 'undefined' && window.electronAPI?.setLanServer) {
            window.electronAPI.setLanServer(promoted.targetUrl).catch(() => {});
          }
        }
      }
      state.localHealthData = finalData;
      state.isLocalServerUp = true;
      notifyListeners();
      return true;
    }

    // If localUrl was autoDiscoveredLanServer and unreachable, clear it immediately
    if (state.autoDiscoveredLanServer && localUrl === state.autoDiscoveredLanServer) {
      console.log('[Network] LAN Host unreachable. Clearing active LAN server.');
      state.autoDiscoveredLanServer = null;
    }
    state.isLocalServerUp = false;
    state.localHealthData = null;
    notifyListeners();
    return false;
  })().finally(() => {
    localHealthPromise = null;
  });
  return localHealthPromise;
};

// Probe Cloud Server health with active network verification
export const checkCloudHealth = async () => {
  const cloudUrl = getCloudUrl();
  if (!cloudUrl) {
    state.isCloudDown = true;
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
        if (state.isCloudDown) {
          console.log('[Network] Cloud server is reachable. Connected to Render Cloud Mode.');
        }
        state.isCloudDown = false;
        state.lastCloudCheckTime = Date.now();
        notifyListeners();
        return true;
      }
    } catch (_) {
      // Cloud unreachable
    }

    state.isCloudDown = true;
    state.lastCloudCheckTime = Date.now();
    notifyListeners();
    return false;
  })().finally(() => {
    healthCheckPromise = null;
  });

  return healthCheckPromise;
};

