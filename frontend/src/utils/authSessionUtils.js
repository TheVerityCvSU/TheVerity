export const normalizeSavedUser = (u) => {
  if (!u || typeof u !== 'object') return u;
  return u;
};

const SERVER_PRESERVED_KEYS = new Set([
  'verity_lan_server',
  'verity_custom_server',
  'verity_cloud_url',
  'verity_preferred_mode',
  'verity_dark_mode',
  'verity_saved_email',
  'verity_clear_storage_on_logout'
]);

export const clearAuthStorage = (clearAllLocal = true) => {
  const sessionOnlyKeys = [
    'currentScreen', 'currentUser', 'activeClassroom', 'activeAssignment',
    'verity_token', 'token', 'verity_token_origin', 'verity_user'
  ];

  if (clearAllLocal) {
    try {
      const allKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) allKeys.push(k);
      }
      allKeys.forEach(k => {
        if (!SERVER_PRESERVED_KEYS.has(k) && (sessionOnlyKeys.includes(k) || k.startsWith('verity_'))) {
          try { localStorage.removeItem(k); } catch (_) {}
        }
      });
    } catch (_) {
      sessionOnlyKeys.forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
    }
  } else {
    sessionOnlyKeys.forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
  }
  try { sessionStorage.clear(); } catch (_) {}
};
