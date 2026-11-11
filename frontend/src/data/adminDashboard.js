import { apiFetch } from './api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Fetches the classrooms list and maps classroom IDs to names.
 */
export async function fetchClassroomsMap() {
  try {
    const res = await apiFetch(`${API_BASE}/classrooms`);
    if (res.ok) {
      const data = await res.json();
      const map = {};
      (data.classrooms || []).forEach(c => {
        map[c.id] = c.name;
      });
      return map;
    }
  } catch (_) {}
  return {};
}

/**
 * Checks if the backend server is reachable.
 */
export async function checkServerHealth() {
  try {
    const res = await apiFetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Performs a diagnostic health check and returns response data with round-trip latency.
 */
export async function runServerDiagnostic() {
  const start = Date.now();
  try {
    const res = await apiFetch(`${API_BASE}/health`);
    const data = await res.json();
    return { ...data, latency: Date.now() - start };
  } catch (_) {
    return { status: 'error', error: 'Server unreachable', latency: Date.now() - start };
  }
}

/**
 * Fetches audit logs for a specific user identifier (name or email).
 */
export async function fetchUserAuditLogs(identifier) {
  try {
    const encoded = encodeURIComponent(identifier);
    const res = await apiFetch(`${API_BASE}/audit-logs/user/${encoded}`);
    const data = await res.json();
    return data.logs || [];
  } catch {
    return [];
  }
}

