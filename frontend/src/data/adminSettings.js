import { apiFetch } from './api';
import { logSecurityEvent } from './securityLogger';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const DEFAULT_SETTINGS = {
  general: {
    institutionName: 'Verity Institute of Technology',
    logoUrl: '',
    currentTerm: 'Fall 2026',
    termStart: '2026-09-01',
    termEnd: '2026-12-18',
    maintenanceMode: false,
    offlineMessage: 'Verity LMS is currently undergoing scheduled system maintenance. Kiosk examinations and live proctoring will resume shortly.',
  },
  security: {
    flagTabExits: true,
    blockCopyPaste: true,
    flagMultipleLogins: true,
    violationThreshold: 3,
    sessionTimeout: '30m',
    passwordPolicies: { specialChars: true, numbers: true, minLength8: true },
    cognitivePauseThreshold: 45,
    strictClipboardBlocking: true,
    enforceSingleMonitor: true,
    disableWindowsKeyAltTab: true,
    blockVirtualMachine: true,
  },
  examDefaults: {
    treatWarningsAsErrors: false,
    autoSaveInterval: '30s',
  },
  notifications: {
    soundAlerts: false,
    notifyOnSubmission: true,
    showToastWarnings: false,
    highSeverityBehavior: 'blinking',
  },
  roles: {
    allowDeleteCourses: false,
    allowManageStudents: true,
    requireAdminApproval: true,
  },
  data: {
    retentionPeriod: '3 Years',
    lastBackupTime: 'Today at 02:00 AM',
    autoArchiveAuditLogs: '30 Days',
    clearLocalStorageOnLogout: true,
  },
  uiPrefs: {
    auditTableDensity: 'Comfortable',
  },
};

export const tabVariants = {
  initial: (direction) => ({ opacity: 0, x: direction > 0 ? 30 : -30 }),
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: (direction) => ({ opacity: 0, x: direction > 0 ? -30 : 30, transition: { duration: 0.2, ease: 'easeIn' } })
};

/**
 * Recursive deep-merge helper: merges nested objects from server on top of defaults.
 */
export function deepMerge(defaults, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return defaults;
  }
  const result = { ...defaults };
  for (const key of Object.keys(incoming)) {
    if (key === '_updatedAt') continue;
    if (
      incoming[key] && typeof incoming[key] === 'object' && !Array.isArray(incoming[key]) &&
      defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])
    ) {
      result[key] = deepMerge(defaults[key], incoming[key]);
    } else {
      result[key] = incoming[key];
    }
  }
  return result;
}

/**
 * Loads system settings from backend, deep-merging with defaults.
 */
export async function loadSystemSettings() {
  try {
    const res = await apiFetch(`${API_BASE}/system-settings`);
    if (res.ok) {
      const d = await res.json();
      if (d.settings && Object.keys(d.settings).length > 0) {
        const serverData = d.settings.global_config || d.settings;
        return deepMerge(DEFAULT_SETTINGS, serverData);
      }
    }
  } catch (_) {}
  return DEFAULT_SETTINGS;
}

/**
 * Saves system settings to the backend (backend records the audit log & broadcasts socket updates).
 */
export async function saveSystemSettings(settings) {
  try {
    await apiFetch(`${API_BASE}/system-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { global_config: settings } }),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('verity:system-settings-updated', { detail: settings }));
    }
  } catch (e) {
    console.warn('Auto-save error:', e);
  }
}

