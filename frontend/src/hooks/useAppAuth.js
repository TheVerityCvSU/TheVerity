import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../data/api';
import { notifyUserListeners } from './useCurrentUser';
import { normalizeSavedUser, clearAuthStorage } from '../utils/authSessionUtils';

export { normalizeSavedUser };

export function useAppAuth({ isAdminApp, socket, lockDown, releaseLockdown, setCurrentScreen, currentScreen, setActiveClassroom }) {
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

  useEffect(() => {
    const restoreAccountSession = async () => {
      let savedUser = null;
      let savedToken = null;
      let savedScreen = null;

      try {
        const savedUserStr = localStorage.getItem('currentUser') || localStorage.getItem('verity_user');
        if (savedUserStr) savedUser = JSON.parse(savedUserStr);
        savedToken = localStorage.getItem('verity_token') || localStorage.getItem('token');
        savedScreen = localStorage.getItem('currentScreen');
      } catch (_) {}

      if (window.electronAPI?.localDB?.getLocal) {
        try {
          if (!savedUser) {
            savedUser = await window.electronAPI.localDB.getLocal('verity_saved_session_user');
          }
          if (!savedToken) {
            savedToken = await window.electronAPI.localDB.getLocal('verity_saved_session_token');
          }
          if (!savedScreen) {
            savedScreen = await window.electronAPI.localDB.getLocal('verity_saved_session_screen');
          }
        } catch (err) {
          console.warn('[App] Electron localDB session check failed:', err);
        }
      }

      if (savedUser) {
        savedUser = normalizeSavedUser(savedUser);
        if (isAdminApp && savedUser.role !== 'Admin') return;

        localStorage.setItem('currentUser', JSON.stringify(savedUser));
        localStorage.setItem('verity_user', JSON.stringify(savedUser));
        if (savedToken) {
          localStorage.setItem('verity_token', savedToken);
          localStorage.setItem('token', savedToken);
        }

        if (window.electronAPI?.localDB?.setLocal) {
          window.electronAPI.localDB.setLocal('verity_saved_session_user', savedUser).catch(() => {});
          if (savedToken) window.electronAPI.localDB.setLocal('verity_saved_session_token', savedToken).catch(() => {});
        }

        setCurrentUser(savedUser);
        notifyUserListeners(savedUser);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('verity:user-updated', { detail: savedUser }));
        }

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

        if (savedUser.role === 'Student' && destScreen !== 'login') {
          lockDown();
        }

        setCurrentScreen(destScreen);
        localStorage.setItem('currentScreen', destScreen);
        if (window.electronAPI?.localDB?.setLocal) {
          window.electronAPI.localDB.setLocal('verity_saved_session_screen', destScreen).catch(() => {});
        }
      }
    };

    restoreAccountSession();
  }, [isAdminApp, lockDown, setCurrentScreen]);

  const handleLogout = useCallback(() => {
    if (currentUser?.role === 'Student') {
      const studentName = currentUser.name || currentUser.email || 'Student';
      const studentId = currentUser.id || currentUser.email || studentName;
      const screenLabel = currentScreen ? currentScreen.replace('_', ' ') : 'session';
      const desc = `Student exited the system: ${studentName} logged out of session (${screenLabel})`;

      if (socket && typeof socket.emit === 'function') {
        socket.emit('proctor_alert', {
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

    releaseLockdown();
    const wasAdmin = isAdminApp || currentUser?.role === 'Admin';
    setCurrentUser(null);
    notifyUserListeners(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('verity:user-updated', { detail: null }));
    }
    setActiveClassroom(null);
    setCurrentScreen(wasAdmin ? 'admin_login' : 'login');
    clearAuthStorage();
    if (window.electronAPI?.localDB?.setLocal) {
      window.electronAPI.localDB.setLocal('verity_saved_session_user', null).catch(() => {});
      window.electronAPI.localDB.setLocal('verity_saved_session_token', null).catch(() => {});
      window.electronAPI.localDB.setLocal('verity_saved_session_screen', null).catch(() => {});
    }
  }, [currentUser, currentScreen, socket, releaseLockdown, isAdminApp, setCurrentScreen, setActiveClassroom]);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/maintenance-status`);
        if (res.ok) {
          const data = await res.json();
          if (data.enabled && currentUser && currentUser.role !== 'Admin') {
            handleLogout();
          }
        }
      } catch (_) {}
    };
    checkMaintenance();
    const interval = setInterval(checkMaintenance, 30000);
    return () => clearInterval(interval);
  }, [currentUser, handleLogout]);

  useEffect(() => {
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    if (token) {
      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/profile`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.user) {
            setCurrentUser(prev => {
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
      if (e.detail) {
        setCurrentUser(e.detail);
      }
    };
    window.addEventListener('verity:user-updated', handleUserUpdate);
    return () => window.removeEventListener('verity:user-updated', handleUserUpdate);
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      localStorage.setItem('verity_user', JSON.stringify(currentUser));
      notifyUserListeners(currentUser);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('verity:user-updated', { detail: currentUser }));
      }
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      if (socket) {
        socket.auth = { token };
        socket.emit('authenticate', { token, user: currentUser });
      }
      if (window.electronAPI?.localDB?.setLocal) {
        window.electronAPI.localDB.setLocal('verity_saved_session_user', currentUser).catch(() => {});
        if (token) {
          window.electronAPI.localDB.setLocal('verity_saved_session_token', token).catch(() => {});
        }
        window.electronAPI.localDB.setLocal('verity_saved_session_screen', currentScreen).catch(() => {});
      }
    } else {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('verity_user');
      notifyUserListeners(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('verity:user-updated', { detail: null }));
      }
      if (socket) socket.auth = {};
      if (window.electronAPI?.localDB?.setLocal) {
        window.electronAPI.localDB.setLocal('verity_saved_session_user', null).catch(() => {});
        window.electronAPI.localDB.setLocal('verity_saved_session_token', null).catch(() => {});
        window.electronAPI.localDB.setLocal('verity_saved_session_screen', null).catch(() => {});
      }
    }
  }, [currentUser, currentScreen, socket]);

  const handleUserLogin = (user, token) => {
    localStorage.removeItem('verity_teacher_classrooms');
    localStorage.removeItem('verity_classrooms');
    localStorage.removeItem('verity_student_classrooms_default');
    localStorage.removeItem('verity_teacher_classrooms_default');
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('verity_user', JSON.stringify(user));
    if (token) {
      localStorage.setItem('verity_token', token);
      localStorage.setItem('token', token);
    }

    let targetScreen = 'student_dashboard';
    if (user.role === 'Admin') {
      targetScreen = 'admin_login';
    } else if (user.role === 'Teacher') {
      targetScreen = 'teacher_dashboard';
    } else {
      targetScreen = 'student_dashboard';
    }
    localStorage.setItem('currentScreen', targetScreen);

    if (window.electronAPI?.localDB?.setLocal) {
      window.electronAPI.localDB.setLocal('verity_saved_session_user', user).catch(() => {});
      if (token) window.electronAPI.localDB.setLocal('verity_saved_session_token', token).catch(() => {});
      window.electronAPI.localDB.setLocal('verity_saved_session_screen', targetScreen).catch(() => {});
    }

    setCurrentUser(user);
    notifyUserListeners(user);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('verity:user-updated', { detail: user }));
    }
    if (user.role === 'Admin') {
      setCurrentScreen('admin_login');
      return;
    } else if (user.role === 'Teacher') {
      setCurrentScreen('teacher_dashboard');
    } else {
      lockDown();
      setCurrentScreen('student_dashboard');
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
