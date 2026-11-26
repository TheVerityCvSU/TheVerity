// Classroom banner theme: loads and saves the theme for a classroom.
import { apiFetch } from './api';
import { THEME_PRESETS } from '../utils/themePresets';

/**
 * Returns all potential storage keys for a classroom object to guarantee matching
 * between teacher and student views regardless of whether classroom is identified
 * by id, code, section, or name.
 */
export const getThemeStorageKeys = (classroom) => {
  const keys = [];
  if (!classroom) return [];

  if (classroom.id !== undefined && classroom.id !== null) {
    keys.push(`verity_classroom_theme_${classroom.id}`);
  }
  if (classroom.code) {
    keys.push(`verity_classroom_theme_code_${String(classroom.code).trim().toLowerCase()}`);
  }
  if (classroom.section) {
    keys.push(`verity_classroom_theme_code_${String(classroom.section).trim().toLowerCase()}`);
  }
  if (classroom.name) {
    keys.push(`verity_classroom_theme_name_${String(classroom.name).trim().toLowerCase()}`);
  }
  return keys;
};

/**
 * Resolves the active theme for a classroom object.
 */
export const getClassroomTheme = (classroom) => {
  if (classroom?.theme) {
    if (typeof classroom.theme === 'object' && classroom.theme !== null && (classroom.theme.primary || classroom.theme.customImageUrl || classroom.theme.id)) {
      return classroom.theme;
    }
    if (typeof classroom.theme === 'string') {
      try {
        const parsed = JSON.parse(classroom.theme);
        if (parsed && (parsed.primary || parsed.customImageUrl || parsed.id)) {
          return parsed;
        }
      } catch {}
    }
  }
  const keys = getThemeStorageKeys(classroom);
  for (const key of keys) {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.primary || parsed.customImageUrl || parsed.id)) {
          return parsed;
        }
      }
    } catch {}
  }
  // Default preset based on classroom ID hash
  const idx = Math.abs(Number(classroom?.id) || 0) % THEME_PRESETS.length;
  return THEME_PRESETS[idx] || THEME_PRESETS[0];
};

/**
 * Saves classroom theme across all canonical keys, updates local caches,
 * dispatches local events, emits socket event, and updates server DB via REST API.
 */
export const applyClassroomThemeLocally = (classroom, theme, { emitWindowEvent = false } = {}) => {
  if (!theme) return [];
  const themeJson = JSON.stringify(theme);
  const keys = getThemeStorageKeys(classroom);

  keys.forEach(key => {
    try {
      localStorage.setItem(key, themeJson);
    } catch {}
  });

  // Sync to stored classroom objects in localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('verity_teacher_classrooms') || k.startsWith('verity_student_classrooms') || k === 'verity_classrooms' || k === 'verity_global_classrooms')) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              let updatedAny = false;
              const updatedArr = arr.map(c => {
                if (
                  (classroom?.id != null && String(c.id) === String(classroom.id)) ||
                  (classroom?.code && c.code && String(c.code).toLowerCase() === String(classroom.code).toLowerCase()) ||
                  (classroom?.section && c.section && String(c.section).toLowerCase() === String(classroom.section).toLowerCase()) ||
                  (classroom?.name && c.name && String(c.name).toLowerCase() === String(classroom.name).toLowerCase())
                ) {
                  updatedAny = true;
                  return { ...c, theme };
                }
                return c;
              });
              if (updatedAny) {
                localStorage.setItem(k, JSON.stringify(updatedArr));
              }
            }
          }
        } catch {}
      }
    }
  }

  if (emitWindowEvent && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('verity:banner-updated', {
      detail: {
        classroomId: classroom?.id,
        code: classroom?.code || classroom?.section,
        name: classroom?.name,
        theme,
        keys
      }
    }));
  }

  return keys;
};

/**
 * Persists a classroom banner theme across all candidate storage keys,
 * dispatches local events, emits socket event, and updates server DB via REST API.
 */
export const saveClassroomTheme = (classroom, theme, socket = null, { persist = true } = {}) => {
  if (!theme) return;
  const keys = applyClassroomThemeLocally(classroom, theme, { emitWindowEvent: persist });
  if (!persist) return;

  const detailPayload = {
    classroomId: classroom?.id,
    code: classroom?.code || classroom?.section,
    name: classroom?.name,
    theme,
    keys
  };

  // Emit socket event for real-time server/client propagation
  if (socket) {
    socket.emit('classroom_theme_updated', detailPayload);
  }

  // Persist to backend database via REST API
  if (classroom?.id) {
    apiFetch(`/classrooms/${classroom.id}/theme`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme })
    }).catch(err => {
      console.warn('[ClassroomTheme] Failed to save theme via API:', err?.message || err);
    });
  }
};
