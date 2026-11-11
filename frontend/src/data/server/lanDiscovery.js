/**
 * LAN discovery: finds a Verity Host server on the local network (ComLab).
 */
import { state } from './connectionState';
import { isElectronApp, isHostedWebEnv } from './serverUrls';
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
          state.autoDiscoveredLanServer = clean;
          state.localHealthData = data;
          state.isLocalServerUp = true;
          try { localStorage.setItem('verity_lan_server', clean); } catch (_) {}
          if (window.electronAPI?.setLanServer) {
            window.electronAPI.setLanServer(clean).catch(() => {});
          }
          notifyListeners();
          console.log('[Network] Auto-connected to LAN Host:', clean);
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
        state.autoDiscoveredLanServer = found;
        try { localStorage.setItem('verity_lan_server', found); } catch (_) {}
        await checkLocalHealth();
        notifyListeners();
        return true;
      }
    } catch (_) {}
  }

  return false;
};

