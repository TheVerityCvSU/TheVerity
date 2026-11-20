/**
 * Server API — the single place screens import server/network helpers from.
 *
 * Behavior (Hybrid Cloud-First with Local Offline Fallback):
 * 1. Cloud-First: Directs API requests to Cloud Server (Render / Supabase: https://the-verity.onrender.com).
 * 2. Instant Local Fallback (Desktop/Electron/Dev): If device has no internet or cloud is down,
 *    automatically reroutes to local embedded server (http://localhost:3001).
 * 3. Hosted Web Safe: On hosted web platforms (e.g. Vercel), requests always target the cloud server
 *    and never mistakenly attempt to route to localhost:3001 or domain:3001.
 *
 * The actual code lives in ./server/ — one job per file:
 *   connectionState.js  shared values (which server, is cloud down, ...)
 *   serverUrls.js       works out cloud / local / LAN addresses
 *   connectionStatus.js current mode + notifies the UI of changes
 *   healthChecks.js     pings servers to see if they are up
 *   lanDiscovery.js     finds a teacher's Host server on the LAN
 *   serverSwitching.js  user picks cloud / LAN / custom server
 *   startupWatchers.js  runs on app load and keeps re-checking
 *   apiFetch.js         sends a request with automatic fallback
 */
import './server/startupWatchers';

export { getUserPreferredMode } from './server/connectionState';
export {
  DEFAULT_CLOUD_API_URL,
  LOCAL_DEV_API_URL,
  LOCAL_API_URL,
  isPrivateHost,
  isElectronApp,
  getCloudUrl,
  getLocalApiUrl,
  getCompilerSocketUrl,
} from './server/serverUrls';
export {
  getHasExplicitLanServer,
  getIsLanConnected,
  getConnectionStatus,
  getActiveSocketUrl,
  subscribeConnectionStatus,
} from './server/connectionStatus';
export { checkLocalHealth, checkCloudHealth } from './server/healthChecks';
export { waitForLanServer, attemptAutoLanReconnect } from './server/lanDiscovery';
export { setCustomLanServer, switchToCloudMode, switchToLanMode } from './server/serverSwitching';
export { apiFetch } from './server/apiFetch';
export { default } from './server/apiFetch';

