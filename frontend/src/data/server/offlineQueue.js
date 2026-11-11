/**
 * Offline queue: remembers a failed save (POST/PUT/DELETE/PATCH) so it can be
 * sent again automatically when the connection comes back.
 */
export const queueOfflineMutation = (pathWithQuery, method, body) => {
  try {
    if (typeof window !== 'undefined') {
      if (window.electronAPI?.localDB?.addToSyncQueue) {
        window.electronAPI.localDB.addToSyncQueue('api_mutation', pathWithQuery, method, body || null);
      } else {
        const q = JSON.parse(localStorage.getItem('verity_sync_queue') || '[]');
        q.push({ id: Date.now(), action: 'api_mutation', url: pathWithQuery, method, body: body || null, created_at: new Date().toISOString() });
        localStorage.setItem('verity_sync_queue', JSON.stringify(q));
      }
      console.log(`[apiFetch] Offline: Queued ${method} ${pathWithQuery} for automatic sync upon reconnection.`);
    }
  } catch (_) {}
};

