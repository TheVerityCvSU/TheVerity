// Theme mode persistence: manages saving, loading, and applying dark mode
// to localStorage and the document element across tabs and windows.

const STORAGE_KEY = 'verity_dark_mode';

const getInitialDark = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

let globalIsDark = getInitialDark();
export const themeListeners = new Set();

export const applyDomClass = (dark) => {
  if (typeof document !== 'undefined' && document.documentElement) {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

// Initial DOM sync on module load
applyDomClass(globalIsDark);

export const notifyThemeListeners = () => {
  applyDomClass(globalIsDark);
  themeListeners.forEach((listener) => {
    try {
      listener(globalIsDark);
    } catch (e) {
      console.error('Error notifying dark mode listener:', e);
    }
  });
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      globalIsDark = e.newValue === 'true';
      notifyThemeListeners();
    }
  });
}

export const getIsDark = () => globalIsDark;

export const setStoredDarkMode = (val) => {
  globalIsDark = !!val;
  try {
    localStorage.setItem(STORAGE_KEY, String(globalIsDark));
  } catch { /* storage unavailable */ }
  notifyThemeListeners();
};

export const toggleStoredDarkMode = () => {
  setStoredDarkMode(!globalIsDark);
};

