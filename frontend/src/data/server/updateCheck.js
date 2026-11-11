/**
 * Update check: asks both the cloud and local servers for the latest app version
 * and returns whichever reports the newer update.
 */
import { state } from './connectionState';

// True if version v1 is newer than v2 (e.g. "1.2.0" vs "1.1.9")
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

/**
 * Returns a Response with the best update info, or null if neither server answered.
 */
export const fetchBestUpdateInfo = async ({ primaryCloudUrl, localFallbackUrl, localUrl, isWebHosted, options, headers }) => {
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
        } else if ((state.isCloudDown || !cloudData) && !best.downloadUrl.startsWith(localUrl)) {
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
  return null;
};

