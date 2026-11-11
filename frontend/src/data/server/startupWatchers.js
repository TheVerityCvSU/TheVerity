/**
 * Startup watchers: runs once when the app loads.
 * Listens for Electron LAN discovery, probes the servers, and keeps
 * re-checking in the background so the app recovers automatically.
 */
import { state } from './connectionState';
import { getLocalApiUrl, isHostedWebEnv } from './serverUrls';
import { notifyListeners, getIsLanConnected } from './connectionStatus';
import { checkCloudHealth, checkLocalHealth } from './healthChecks';
import { attemptAutoLanReconnect } from './lanDiscovery';

// Asks the local server to sync with the cloud (fire-and-forget)
const pingLocalSync = () => {
  try {
    fetch(`${getLocalApiUrl()}/api/sync`, { method: 'POST' }).catch(() => {});
  } catch (_) {}
};

// --- Electron LAN auto-discovery listeners ---
if (typeof window !== 'undefined') {
  // Query initial discovered server from Electron main process
  if (window.electronAPI?.getDiscoveredServer) {
    window.electronAPI.getDiscoveredServer().then((discovered) => {
      if (discovered && !state.autoDiscoveredLanServer) {
        console.log('[Network] Detected Verity Host via LAN Auto-Discovery:', discovered);
        state.autoDiscoveredLanServer = discovered;
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
        console.log('[Network] Live Verity Host discovered on LAN:', discovered);
        state.autoDiscoveredLanServer = discovered;
        state.isLocalServerUp = true;
        try { localStorage.setItem('verity_lan_server', discovered); } catch (_) {}
        checkLocalHealth();
        notifyListeners();
      } else if (state.autoDiscoveredLanServer) {
        console.log('[Network] LAN Host disconnected. Returning to offline state.');
        state.autoDiscoveredLanServer = null;
        state.isLocalServerUp = false;
        state.localHealthData = null;
        notifyListeners();
      }
    });
  }
}

// --- Network probes on startup + periodic auto-recovery ---
if (typeof window !== 'undefined') {
  const hostedWeb = isHostedWebEnv();

  // Immediate initial health probe on app load
  if (state.userPreferredMode === 'lan') {
    checkLocalHealth().then(() => {
      if (!hostedWeb) checkCloudHealth();
    });
  } else {
    checkCloudHealth().then((cloudOk) => {
      if (!hostedWeb) {
        checkLocalHealth().then((localOk) => {
          if (!cloudOk && !localOk) {
            attemptAutoLanReconnect();
          }
        });
      }
    });
  }

  // Background auto-recovery check:
  // - Prioritize checking cloud health so we stay on or recover to Online Cloud Server when internet is available
  // - Auto-probe LAN if not on hosted web and cloud is down or user explicitly selected LAN mode
  setInterval(() => {
    if (state.isCloudDown || Date.now() - state.lastCloudCheckTime > 15000) {
      checkCloudHealth();
    }

    if (!hostedWeb) {
      if (state.userPreferredMode === 'lan' || state.isCloudDown || (typeof navigator !== 'undefined' && !navigator.onLine)) {
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
    console.log('[Network] Internet connectivity restored.');
    checkCloudHealth();
    if (!hostedWeb) {
      checkLocalHealth();
      pingLocalSync();
    }
  });

  window.addEventListener('offline', () => {
    console.log('[Network] Network connectivity lost. Immediately switching to Offline Mode.');
    state.autoDiscoveredLanServer = null;
    state.isLocalServerUp = false;
    state.localHealthData = null;
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
      pingLocalSync();
    }
  });

  // Automatic background synchronization between LAN and Cloud (only when running local/LAN server)
  if (!hostedWeb) {
    setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && state.isLocalServerUp) {
        pingLocalSync();
      }
    }, 15000);

    window.addEventListener('focus', () => {
      if (typeof navigator !== 'undefined' && navigator.onLine && state.isLocalServerUp) {
        pingLocalSync();
      }
    });
  }
}

