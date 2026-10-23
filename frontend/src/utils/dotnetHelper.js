import { LOCAL_DEV_API_URL } from './api';

const LOCAL_BASE = LOCAL_DEV_API_URL || 'http://localhost:3001';

/**
 * Trigger the global .NET Setup modal from anywhere in the app.
 */
export const openDotnetSetup = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('verity:open-dotnet-setup'));
  }
};

/**
 * Fetch current .NET SDK status from the local Verity backend.
 */
export const fetchDotnetStatus = async () => {
  try {
    const res = await fetch(`${LOCAL_BASE}/api/system/dotnet-status`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return { installed: false, error: err.message, stage: 'idle' };
  }
};

/**
 * Request the local backend to download and install .NET SDK automatically.
 */
export const triggerInstallDotnet = async () => {
  try {
    const res = await fetch(`${LOCAL_BASE}/api/system/install-dotnet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    throw err;
  }
};

/**
 * Cancel an active .NET SDK download.
 */
export const cancelInstallDotnet = async () => {
  try {
    const res = await fetch(`${LOCAL_BASE}/api/system/cancel-dotnet-install`, {
      method: 'POST'
    });
    return await res.json();
  } catch (err) {
    return { cancelled: false, error: err.message };
  }
};
