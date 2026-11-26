import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../data/api';
import { notifyUserListeners } from './useCurrentUser';
import { normalizeSavedUser, clearAuthStorage } from '../utils/authSessionUtils';

export { normalizeSavedUser };

export function useAppAuth({
  isAdminApp,
  socket,
  getSocket,
  releaseLockdown,
  setCurrentScreen,
  currentScreen,
  setActiveClassroom,
  setActiveAssignment,
  getCurrentScreen
}) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem('currentUser') || localStorage.getItem('verity_user');
      const savedUser = normalizeSavedUser(savedUserStr ? JSON.parse(savedUserStr) : null);
      if (isAdminApp && savedUser && savedUser.role !== 'Admin') {
        return null;
      }
      return savedUser;
    } catch (e) {
      console.warn('Failed to parse currentUser from localStorage', e);
      return null;
    }
  });

  const hasRestoredRef = useRef(false);
  const setCurrentScreenRef = useRef(setCurrentScreen);
  useEffect(() => {
    setCurrentScreenRef.current = setCurrentScreen;
  }, [setCurrentScreen]);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    let isMounted = true;
    const restoreAccountSession = async () => {
      // 1. If currentUser is already resolved from localStorage, no need to overwrite
      const localUserStr = localStorage.getItem('currentUser') || localStorage.getItem('verity_user');
      if (localUserStr) {
        return;
      }

      let savedUser = null;
      let savedToken = null;
      let savedTokenOrigin = null;
      let savedScreen = null;

      if (window.electronAPI?.localDB?.getLocal) {
        try {
          savedUser = await window.electronAPI.localDB.getLocal('verity_saved_session_user');
          savedToken = await window.electronAPI.localDB.getLocal('verity_saved_session_token');
          savedTokenOrigin = await window.electronAPI.localDB.getLocal('verity_saved_session_token_origin');
          savedScreen = await window.electronAPI.localDB.getLocal('verity_saved_session_screen');
        } catch (err) {
          console.warn('[App] Electron localDB session check failed:', err);
        }
      }

      if (!isMounted || !savedUser) return;

      savedUser = normalizeSavedUser(savedUser);
      if (isAdminApp && savedUser.role !== 'Admin') return;

      localStorage.setItem('currentUser', JSON.stringify(savedUser));
      localStorage.setItem('verity_user', JSON.stringify(savedUser));
      if (savedToken) {
        localStorage.setItem('verity_token', savedToken);
        localStorage.setItem('token', savedToken);
      }
      if (savedTokenOrigin) {
        localStorage.setItem('verity_token_origin', savedTokenOrigin);
      }

      setCurrentUser(savedUser);
      notifyUserListeners(savedUser);

      let destScreen = savedScreen;
      if (!destScreen || destScreen === 'login' || destScreen === 'admin_login') {
        if (isAdminApp || savedUser.role === 'Admin') {
          destScreen = 'admin_dashboard';
        } else if (savedUser.role === 'Teacher') {
          destScreen = 'teacher_dashboard';
        } else {
          destScreen = 'student_dashboard';
        }
      }

      if (typeof setCurrentScreenRef.current === 'function') {
        setCurrentScreenRef.current(destScreen);
        localStorage.setItem('currentScreen', destScreen);
      }
    };

    restoreAccountSession();
    return () => { isMounted = false; };
  }, [isAdminApp]);

  const handleLogout = useCallback(() => {
    hasRestoredRef.current = true;

    const activeSocket = typeof getSocket === 'function' ? getSocket() : socket;

    const activeScreen = (typeof getCurrentScreen === 'function' ? getCurrentScreen() : null) || currentScreen;

    if (currentUser?.role === 'Student') {
      const studentName = currentUser.name || currentUser.email || 'Student';
      const studentId = currentUser.id || currentUser.email || studentName;
      const screenLabel = activeScreen ? activeScreen.replace('_', ' ') : 'session';
      const desc = `Student exited the system: ${studentName} logged out of session (${screenLabel})`;

      if (activeSocket && typeof activeSocket.emit === 'function') {
        activeSocket.emit('proctor_alert', {
          studentId,
          name: studentName,
          email: currentUser.email || '',
          action: 'Exited System (Logout)',
          desc,
          color: '#f59e0b'
        });
      }

      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: studentName,
          type: 'System Exit Violation',
          severity: 'Warning',
          desc
        })
      }).catch(() => {});
    }

    if (typeof releaseLockdown === 'function') releaseLockdown();

    const wasAdmin = isAdminApp || currentUser?.role === 'Admin';
    const targetScreen = wasAdmin ? 'admin_login' : 'login';

    // 1. Wipe storage according to Admin Setting: data.clearLocalStorageOnLogout
    let shouldClearAll = true;
    try {
      const savedPref = localStorage.getItem('verity_clear_storage_on_logout');
      if (savedPref === 'false') shouldClearAll = false;
    } catch (_) {}
    clearAuthStorage(shouldClearAll);
    localStorage.removeItem('currentScreen');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('verity_user');
    localStorage.removeItem('activeClassroom');
    localStorage.removeItem('activeAssignment');
    localStorage.removeItem('verity_token');
    localStorage.removeItem('token');
    localStorage.removeItem('verity_token_origin');

    if (window.electronAPI?.localDB?.setLocal) {
      window.electronAPI.localDB.setLocal('verity_saved_session_user', null).catch(() => {});
      window.electronAPI.localDB.setLocal('verity_saved_session_token', null).catch(() => {});
      window.electronAPI.localDB.setLocal('verity_saved_session_token_origin', null).catch(() => {});
      window.electronAPI.localDB.setLocal('verity_saved_session_screen', null).catch(() => {});
    }

    // 2. Wipe active navigation and user state
    if (typeof setActiveClassroom === 'function') {
      setActiveClassroom(null);
    }
    if (typeof setActiveAssignment === 'function') {
      setActiveAssignment(null);
    }
    if (typeof setCurrentScreen === 'function') {
      setCurrentScreen(targetScreen);
    }

    setCurrentUser(null);
    notifyUserListeners(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('verity:user-updated', { detail: null }));
    }
  }, [currentUser, currentScreen, socket, getSocket, releaseLockdown, isAdminApp, setCurrentScreen, setActiveClassroom, setActiveAssignment, getCurrentScreen]);

  useEffect(() => {
    const onAuthInvalid = (e) => {
      if (!currentUser) return;
      if (!localStorage.getItem('verity_token') && !localStorage.getItem('token')) return;
      try {
        sessionStorage.setItem(
          'verity_auth_notice',
          e?.detail?.message || 'Your session was signed by a different server or expired. Please sign in again.'
        );
      } catch (_) {}
      handleLogout();
    };
    window.addEventListener('verity:auth-invalid', onAuthInvalid);
    return () => window.removeEventListener('verity:auth-invalid', onAuthInvalid);
  }, [currentUser, handleLogout]);

  const currentUserRole = currentUser?.role;
  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/maintenance-status`);
        if (res.ok) {
          const data = await res.json();
          if (data.enabled && currentUserRole && currentUserRole !== 'Admin') {
            handleLogout();
          }
        }
      } catch (_) {}
    };
    checkMaintenance();
    const interval = setInterval(checkMaintenance, 30000);

    // Sync clearLocalStorageOnLogout setting for logout enforcement
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    if (token) {
      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          const cfg = d?.settings?.global_config || d?.settings;
          if (cfg?.data && typeof cfg.data.clearLocalStorageOnLogout === 'boolean') {
            try { localStorage.setItem('verity_clear_storage_on_logout', String(cfg.data.clearLocalStorageOnLogout)); } catch (_) {}
          }
        })
        .catch(() => {});
    }

    const activeSock = typeof getSocket === 'function' ? getSocket() : socket;
    const onSettingsUpdated = (payload) => {
      const cfg = payload?.settings?.global_config || payload?.settings || {};
      if (cfg?.data && typeof cfg.data.clearLocalStorageOnLogout === 'boolean') {
        try { localStorage.setItem('verity_clear_storage_on_logout', String(cfg.data.clearLocalStorageOnLogout)); } catch (_) {}
      }
      if (cfg?.general?.maintenanceMode && currentUserRole && currentUserRole !== 'Admin') {
        handleLogout();
      }
    };
    if (activeSock) activeSock.on('system_settings_updated', onSettingsUpdated);

    return () => {
      clearInterval(interval);
      if (activeSock) activeSock.off('system_settings_updated', onSettingsUpdated);
    };
  }, [currentUserRole, handleLogout, socket, getSocket]);

  useEffect(() => {
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    if (token) {
      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/profile`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.user) {
            setCurrentUser(prev => {
              if (!prev) return null;
              if (prev?.email && data.user.email && prev.email.trim().toLowerCase() !== data.user.email.trim().toLowerCase()) {
                return prev;
              }
              const updated = normalizeSavedUser({ ...prev, ...data.user });
              localStorage.setItem('currentUser', JSON.stringify(updated));
              localStorage.setItem('verity_user', JSON.stringify(updated));
              return updated;
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleUserUpdate = (e) => {
      if (e.detail !== undefined) {
        setCurrentUser(prev => {
          if (!prev && !e.detail) return null;
          if (prev && e.detail && JSON.stringify(prev) === JSON.stringify(e.detail)) return prev;
          return e.detail;
        });
      }
    };
    window.addEventListener('verity:user-updated', handleUserUpdate);
    return () => window.removeEventListener('verity:user-updated', handleUserUpdate);
  }, []);

  useEffect(() => {
    const activeSocket = typeof getSocket === 'function' ? getSocket() : socket;

    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      localStorage.setItem('verity_user', JSON.stringify(currentUser));
      notifyUserListeners(currentUser);
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      if (activeSocket) {
        Reflect.set(activeSocket, 'auth', { token });
        activeSocket.emit('authenticate', { token, user: currentUser });
      }
      if (window.electronAPI?.localDB?.setLocal) {
        window.electronAPI.localDB.setLocal('verity_saved_session_user', currentUser).catch(() => {});
        if (token) {
          window.electronAPI.localDB.setLocal('verity_saved_session_token', token).catch(() => {});
        }
        try {
          const origin = localStorage.getItem('verity_token_origin');
          if (origin) window.electronAPI.localDB.setLocal('verity_saved_session_token_origin', origin).catch(() => {});
        } catch (_) {}
        if (currentScreen && !['login', 'admin_login'].includes(currentScreen)) {
          window.electronAPI.localDB.setLocal('verity_saved_session_screen', currentScreen).catch(() => {});
        }
      }
    } else {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('verity_user');
      notifyUserListeners(null);
      if (activeSocket) Reflect.set(activeSocket, 'auth', {});
      if (window.electronAPI?.localDB?.setLocal) {
        window.electronAPI.localDB.setLocal('verity_saved_session_user', null).catch(() => {});
        window.electronAPI.localDB.setLocal('verity_saved_session_token', null).catch(() => {});
        window.electronAPI.localDB.setLocal('verity_saved_session_token_origin', null).catch(() => {});
        window.electronAPI.localDB.setLocal('verity_saved_session_screen', null).catch(() => {});
      }
    }
  }, [currentUser, currentScreen, socket, getSocket]);

  const handleUserLogin = (user, token) => {
    hasRestoredRef.current = true;
    localStorage.removeItem('verity_teacher_classrooms');
    localStorage.removeItem('verity_classrooms');
    localStorage.removeItem('verity_student_classrooms_default');
    localStorage.removeItem('verity_teacher_classrooms_default');
    const normalized = normalizeSavedUser(user);
    localStorage.setItem('currentUser', JSON.stringify(normalized));
    localStorage.setItem('verity_user', JSON.stringify(normalized));
    if (token) {
      localStorage.setItem('verity_token', token);
      localStorage.setItem('token', token);
    }

    let targetScreen;
    if (normalized?.role === 'Admin') {
      targetScreen = 'admin_login';
    } else if (normalized?.role === 'Teacher') {
      targetScreen = 'teacher_dashboard';
    } else {
      targetScreen = 'student_dashboard';
    }
    localStorage.setItem('currentScreen', targetScreen);

    if (window.electronAPI?.localDB?.setLocal) {
      window.electronAPI.localDB.setLocal('verity_saved_session_user', normalized).catch(() => {});
      if (token) window.electronAPI.localDB.setLocal('verity_saved_session_token', token).catch(() => {});
      try {
        const origin = localStorage.getItem('verity_token_origin');
        if (origin) window.electronAPI.localDB.setLocal('verity_saved_session_token_origin', origin).catch(() => {});
      } catch (_) {}
      window.electronAPI.localDB.setLocal('verity_saved_session_screen', targetScreen).catch(() => {});
    }

    setCurrentUser(normalized);
    notifyUserListeners(normalized);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('verity:user-updated', { detail: normalized }));
    }
    if (normalized?.role === 'Admin') {
      if (typeof setCurrentScreen === 'function') setCurrentScreen('admin_login');
      return;
    } else if (normalized?.role === 'Teacher') {
      if (typeof setCurrentScreen === 'function') setCurrentScreen('teacher_dashboard');
    } else {
      if (typeof setCurrentScreen === 'function') setCurrentScreen('student_dashboard');
    }
  };

  return {
    currentUser,
    setCurrentUser,
    handleLogout,
    handleUserLogin,
    normalizeSavedUser
  };
}
