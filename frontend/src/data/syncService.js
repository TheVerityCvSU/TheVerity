import localStore from './localStore';
import { apiFetch, getConnectionStatus } from './api';

/**
 * Offline Sync Service
 * 
 * Replays queued mutations (submissions, drafts, updates) stored in the local
 * SQLite database whenever internet/server connectivity is re-established.
 */

let isSyncing = false;

export const syncService = {
    // Process all pending mutations in the local SQLite/storage queue
    async syncOfflineQueue(authToken) {
        if (isSyncing) return { synced: 0, status: 'already_running' };

        const queue = await localStore.getSyncQueue();
        if (!queue || queue.length === 0) return { synced: 0, status: 'empty' };

        const status = getConnectionStatus();
        // Skip flushing while completely offline (never clear queue against embedded loopback SQLite)
        if (!status.isOnline && typeof navigator !== 'undefined' && navigator.onLine === false) {
            return { synced: 0, status: 'offline' };
        }
        const useCloudOnly = status.activeMode !== 'lan';

        isSyncing = true;
        let syncedCount = 0;

        console.log(`[SyncService] Found ${queue.length} pending offline actions in local storage. Syncing...`);

        for (const item of queue) {
            try {
                const headers = {
                    'Content-Type': 'application/json'
                };
                if (authToken) {
                    headers['Authorization'] = `Bearer ${authToken}`;
                }

                const res = await apiFetch(item.url, {
                    method: item.method || 'POST',
                    headers,
                    body: typeof item.body === 'object' ? JSON.stringify(item.body) : item.body,
                    cloudOnly: useCloudOnly
                });

                if (res.ok) {
                    await localStore.removeFromSyncQueue(item.id);
                    syncedCount++;
                } else if (res.status >= 400 && res.status < 500 && ![401, 408, 429].includes(res.status)) {
                    // Permanent client error (e.g. invalid format), remove from queue so it doesn't block forever
                    console.warn(`[SyncService] Item ${item.id} returned HTTP ${res.status}. Dropping from queue.`);
                    await localStore.removeFromSyncQueue(item.id);
                } else {
                    // Transient/auth error — pause and retry next cycle
                    console.warn(`[SyncService] HTTP ${res.status} on sync. Will retry later.`);
                    break;
                }
            } catch (err) {
                console.warn('[SyncService] Network error during sync item processing:', err.message);
                break;
            }
        }

        isSyncing = false;
        console.log(`[SyncService] Sync cycle complete. Synced ${syncedCount} items.`);
        return { synced: syncedCount, status: 'complete' };
    },

    // Setup automatic listener to flush queue on reconnect (online event or LAN server found)
    initAutoSync(getAuthToken) {
        if (typeof window === 'undefined') return;

        const trigger = () => {
            console.log('[SyncService] Connectivity event detected. Triggering offline queue sync...');
            const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
            syncService.syncOfflineQueue(token);
        };

        window.addEventListener('online', trigger);
        window.addEventListener('verity:lan-discovered', trigger);
        window.addEventListener('verity:server-changed', trigger);

        // Periodic check every 15 seconds to flush queue whenever local or cloud server is reachable
        setInterval(() => {
            const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
            syncService.syncOfflineQueue(token);
        }, 15000);
    }
};

export default syncService;
