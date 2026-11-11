import { DEFAULT_CLOUD_API_URL } from './api';

export const normalizeServerUrl = (raw) => {
  let u = (raw || '').trim();
  if (!u) return DEFAULT_CLOUD_API_URL;
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = `http://${u}`;
  }
  // If it looks like a raw IP without port (e.g. http://192.168.1.10), add :3001
  const match = u.match(/^http:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (match) {
    u = `${u}:3001`;
  }
  return u.replace(/\/$/, '');
};

export const testServerHealth = async (target) => {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${target}/health`, { signal: controller.signal });
    clearTimeout(timer);
    const latency = Date.now() - startTime;

    if (res.ok) {
      return {
        success: true,
        message: `Connected successfully! (${latency}ms) — Server is online and ready.`
      };
    } else {
      return {
        success: false,
        message: `Server returned HTTP ${res.status}. Verify the server is running on the Host PC.`
      };
    }
  } catch (err) {
    return {
      success: false,
      message: `Could not reach ${target}. Ensure the Host PC is on the same Wi-Fi router, port 3001 is open, and server.js is running.`
    };
  }
};

