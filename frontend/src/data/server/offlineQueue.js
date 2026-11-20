/**
 * Offline queue: remembers a failed save (POST/PUT/DELETE/PATCH) so it can be
 * sent again automatically when the connection comes back.
 */
export const queueOfflineMutation = (pathWithQuery, method, body) => {
  try {
    if (typeof window !== 'undefined') {
      const normalizedBody = body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
      if (window.electronAPI?.localDB?.addToSyncQueue) {
        window.electronAPI.localDB.addToSyncQueue('api_mutation', pathWithQuery, method, body || null);
      } else {
        const q = JSON.parse(localStorage.getItem('verity_sync_queue') || '[]');
        const last = q[q.length - 1];
        const lastBody = last?.body == null ? null : (typeof last.body === 'string' ? last.body : JSON.stringify(last.body));
        if (last && last.url === pathWithQuery && last.method === method && lastBody === normalizedBody) {
          return;
        }
        q.push({ id: Date.now(), action: 'api_mutation', url: pathWithQuery, method, body: body || null, created_at: new Date().toISOString() });
        localStorage.setItem('verity_sync_queue', JSON.stringify(q));
      }
      console.log(`[apiFetch] Offline: Queued ${method} ${pathWithQuery} for automatic sync upon reconnection.`);
    }
  } catch (_) {}
};

