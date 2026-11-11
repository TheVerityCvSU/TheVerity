// Reactive hook for dark mode. Synchronizes across all components in real-time.
import { useState, useEffect } from 'react';
import {
  getIsDark,
  themeListeners,
  setStoredDarkMode,
  toggleStoredDarkMode
} from '../data/themeMode';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(getIsDark);

  useEffect(() => {
    const handleChange = (newVal) => {
      setIsDark(newVal);
    };

    themeListeners.add(handleChange);
    setIsDark(getIsDark());

    return () => {
      themeListeners.delete(handleChange);
    };
  }, []);

  const toggle = () => {
    toggleStoredDarkMode();
  };

  const setDark = (val) => {
    setStoredDarkMode(val);
  };

  return { isDark, toggle, toggleDarkMode: toggle, setDark };
}

export default useDarkMode;
