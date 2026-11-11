import { useState, useEffect } from 'react';
import { isDesktopWebBrowser, isMobileDevice, DISABLE_DESKTOP_WEB_BLOCKER } from '../utils/deviceUtils';
import { apiFetch } from '../data/api';

export const isRunningInAdminMode = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.IS_ADMIN_APP ||
    window.electronAPI?.isAdminApp ||
    window.location.pathname.startsWith('/admin') ||
    window.location.hash.startsWith('#/admin') ||
    new URLSearchParams(window.location.search).get('admin') === 'true' ||
    window.location.href.includes('admin')
  );
};

export const lockDown = () => {
  try { window.electronAPI?.enableLockdown?.(); } catch (_) {}
};

export const releaseLockdown = () => {
  try { window.electronAPI?.disableLockdown?.(); } catch (_) {}
};

export function useAppSecurity({ currentUser, currentScreen, socket }) {
  const isAdminApp = isRunningInAdminMode();
  const [isDesktopWeb, setIsDesktopWeb] = useState(() => isDesktopWebBrowser());
  const [vmDetected, setVmDetected] = useState(false);
  const [vmReasons, setVmReasons] = useState([]);

  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.checkVmStatus !== 'function') return;

    let isMounted = true;
    const checkVmEnvironment = async () => {
      try {
        const res = await window.electronAPI.checkVmStatus();
        if (!isMounted) return;
        if (res && res.isVm) {
          setVmDetected(true);
          setVmReasons(res.reasons || []);
        } else {
          setVmDetected(false);
        }
      } catch (_) { }
    };

    checkVmEnvironment();
    const timer = setInterval(checkVmEnvironment, 8000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (window.electronAPI) return;

    const checkEnvironment = () => {
      const isDesktop = isDesktopWebBrowser();
      setIsDesktopWeb(prev => prev !== isDesktop ? isDesktop : prev);
    };

    window.addEventListener('resize', checkEnvironment);
    window.addEventListener('orientationchange', checkEnvironment);
    const timer = setInterval(checkEnvironment, 600);

    return () => {
      window.removeEventListener('resize', checkEnvironment);
      window.removeEventListener('orientationchange', checkEnvironment);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (window.electronAPI || DISABLE_DESKTOP_WEB_BLOCKER) return;

    const handleKeyDown = (e) => {
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handleContextMenu = (e) => {
      if (!isMobileDevice()) {
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'Student' && currentScreen !== 'login') {
      lockDown();
    }
  }, [currentUser, currentScreen]);

  useEffect(() => {
    if (currentUser?.role !== 'Student' || DISABLE_DESKTOP_WEB_BLOCKER) return;

    let lastExitTabTime = 0;
    const handleWindowExit = () => {
      if (currentScreen === 'student_workspace') return;
      const now = Date.now();
      if (now - lastExitTabTime < 1500) return;
      lastExitTabTime = now;

      const studentName = currentUser.name || currentUser.email || 'Student';
      const studentId = currentUser.id || currentUser.email || studentName;
      const screenLabel = currentScreen ? currentScreen.replace('_', ' ') : 'dashboard';

      if (socket && typeof socket.emit === 'function') {
        socket.emit('proctor_alert', {
          studentId,
          name: studentName,
          email: currentUser.email || '',
          action: `Alt Tab outside workspace (${screenLabel})`,
          desc: `Alt Tab / Window Exit: ${studentName} exited the application window outside workspace (${screenLabel})`,
          color: '#eab308'
        });
      }

      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: studentName,
          type: 'Exit Tab Violation',
          severity: 'Warning',
          desc: `Alt Tab / Window Exit: ${studentName} exited the application window outside workspace (${screenLabel})`
        })
      }).catch(() => { });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleWindowExit();
    };
    const handleBlur = () => {
      handleWindowExit();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    const handleSystemExit = () => {
      const studentName = currentUser.name || currentUser.email || 'Student';
      const studentId = currentUser.id || currentUser.email || studentName;
      const screenLabel = currentScreen ? currentScreen.replace('_', ' ') : 'dashboard';
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      const inWorkspace = currentScreen === 'student_workspace';
      const desc = inWorkspace
        ? `Student exited the system: ${studentName} closed or exited the application while in workspace`
        : `Student exited the system: ${studentName} closed or exited the application outside workspace (${screenLabel})`;

      if (socket && typeof socket.emit === 'function') {
        socket.emit('proctor_alert', {
          studentId,
          name: studentName,
          email: currentUser.email || '',
          action: 'Exited System',
          desc,
          color: '#f59e0b'
        });
      }

      const payload = JSON.stringify({
        user: studentName,
        type: 'System Exit Violation',
        severity: 'Warning',
        desc
      });

      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/audit-logs?token=${encodeURIComponent(token || '')}`;

      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        }
      } catch (_) { }

      try {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/audit-logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: payload,
          keepalive: true
        }).catch(() => { });
      } catch (_) { }
    };

    window.addEventListener('beforeunload', handleSystemExit);
    window.addEventListener('pagehide', handleSystemExit);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleSystemExit);
      window.removeEventListener('pagehide', handleSystemExit);
    };
  }, [currentUser, currentScreen, socket]);

  const verifyEnvironmentBeforeExam = async () => {
    if (!DISABLE_DESKTOP_WEB_BLOCKER && isDesktopWebBrowser()) {
      alert('[ACCESS DENIED] Desktop Web Browser Blocked\n\nIn the Computer Laboratory or on desktop/laptop computers, all exams and coding activities must be conducted using the official "The Verity.exe" desktop application for kiosk lockdown and exam integrity.\n\nWeb access is strictly reserved for mobile phones.\n\nPlease close this browser and launch The Verity (.exe).');
      return false;
    }

    if (window.electronAPI && typeof window.electronAPI.checkVmStatus === 'function') {
      try {
        const vmStatus = await window.electronAPI.checkVmStatus();
        if (vmStatus && vmStatus.isVm) {
          alert('[ACCESS DENIED] Virtual Machine Detected\n\nRunning The Verity inside a Virtual Machine (VMware, VirtualBox, Hyper-V, QEMU, etc.) is strictly prohibited during exams.\n\nPlease launch The Verity directly on your physical operating system.');
          return false;
        }
      } catch (_) { }
    }
    return true;
  };

  return {
    isAdminApp,
    isDesktopWeb,
    vmDetected,
    vmReasons,
    lockDown,
    releaseLockdown,
    verifyEnvironmentBeforeExam
  };
}
