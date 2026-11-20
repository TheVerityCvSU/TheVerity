/**
 * LAN discovery: finds a Verity Host server on the local network (ComLab).
 */
import { state } from './connectionState';
import {
  isElectronApp,
  isHostedWebEnv,
  isPrivateHost,
  normalizeHttpUrl,
  isLoopbackUrl,
  probeVerityHealth,
  promoteLoopbackToLan
} from './serverUrls';
import { notifyListeners } from './connectionStatus';
import { checkLocalHealth } from './healthChecks';

/**
 * Waits (up to timeoutMs) for Electron's LAN client to lock onto the Host server.
 * Returns the discovered URL or null.
 */
export const waitForLanServer = async (timeoutMs = 6000) => {
  if (state.autoDiscoveredLanServer) return state.autoDiscoveredLanServer;
  if (!isElectronApp()) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const found = await window.electronAPI.getDiscoveredServer();
      if (found) {
        state.autoDiscoveredLanServer = found;
        try { localStorage.setItem('verity_lan_server', found); } catch (_) { }
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
    try { saved = localStorage.getItem('verity_lan_server') || localStorage.getItem('verity_custom_server'); } catch (_) { }
  }
  if (saved && isLoopbackUrl(saved)) {
    saved = null;
  }

  const currentHost = (typeof window !== 'undefined' && window.location) ? window.location.hostname : '';
  const isLanWebClient = isPrivateHost(currentHost) && currentHost !== 'localhost' && currentHost !== '127.0.0.1';

  const candidates = [
    saved,
    isLanWebClient ? `http://${currentHost}:3001` : null,
    'http://localhost:3001'
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidates)];

  for (const cand of uniqueCandidates) {
    const clean = normalizeHttpUrl(cand);
    const data = await probeVerityHealth(clean, 1000);
    if (!data) continue;

    const { targetUrl, healthData } = await promoteLoopbackToLan(clean, data, 1000);
    const targetIsLoopback = isLoopbackUrl(targetUrl);
    const isRealLanOrDevHost = !targetIsLoopback || healthData.isHost === true || healthData.hasCloudDb === true;

    state.localHealthData = healthData;
    state.isLocalServerUp = true;

    if (!targetIsLoopback) {
      state.autoDiscoveredLanServer = targetUrl;
      try { localStorage.setItem('verity_lan_server', targetUrl); } catch (_) {}
      if (window.electronAPI?.setLanServer) {
        window.electronAPI.setLanServer(targetUrl).catch(() => {});
      }
      console.log('[Network] Auto-connected to LAN Host:', targetUrl);
    }

    notifyListeners();
    return isRealLanOrDevHost;
  }

  // Trigger Electron discovery scanner if available
  if (window.electronAPI?.scanLanServers) {
    try {
      const found = await window.electronAPI.scanLanServers();
      if (found && !isLoopbackUrl(found)) {
        state.autoDiscoveredLanServer = found;
        try { localStorage.setItem('verity_lan_server', found); } catch (_) { }
        await checkLocalHealth();
        notifyListeners();
        return true;
      }
    } catch (_) { }
  }

  return false;
};

