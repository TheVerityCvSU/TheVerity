import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../data/api';
import { isDesktopWebBrowser } from '../utils/deviceUtils';
import { normalize, parseTimeoutMs } from '../utils/studentViewUtils';
import { useStudentViewProctorLogs } from './useStudentViewProctorLogs';

export function useStudentViewKiosk({
  socket,
  currentUser,
  assignment,
  classroom,
  assignmentId,
  classroomId,
  studentActualId,
  safeUsername,
  submitted,
  codeRef,
  codeHistoryRef,
  persistHistoryFn,
  emitToSockets,
  setStrictCompiler
}) {
  const [kioskRules, setKioskRules] = useState({
    flagTabExits: true,
    strictClipboardBlocking: true,
    flagMultipleLogins: true,
    violationThreshold: 3,
    sessionTimeout: '30m',
    cognitivePauseThreshold: 45,
    enforceSingleMonitor: false,
    disableWindowsKeyAltTab: true,
    blockVirtualMachine: true
  });
  const kioskRulesRef = useRef(kioskRules);
  useEffect(() => {
    kioskRulesRef.current = kioskRules;
  }, [kioskRules]);

  const [examDefaults, setExamDefaults] = useState({
    treatWarningsAsErrors: false,
    autoSaveInterval: '30s',
    defaultExamTimer: 60
  });
  const [multiMonitorDetected, setMultiMonitorDetected] = useState(false);
  const [vmDetected, setVmDetected] = useState(false);
  const [vmReasons, setVmReasons] = useState([]);
  const [isDesktopWeb, setIsDesktopWeb] = useState(() => isDesktopWebBrowser());
  const [idleWarning, setIdleWarning] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const isExitingCleanlyRef = useRef(false);
  const lastTabExitLogRef = useRef(0);
  const copiedInternallyRef = useRef(new Set());

  const { proctorLogs, setProctorLogs, proctorLogsRef, addProctorLog } = useStudentViewProctorLogs({
    assignment,
    classroom,
    assignmentId,
    classroomId,
    studentActualId,
    safeUsername,
    submitted,
    currentUser,
    codeRef,
    codeHistoryRef,
    persistHistoryFn,
    emitToSockets
  });

  // Sync settings and socket auth
  useEffect(() => {
    let isMounted = true;
    const applySettings = (settingsObj) => {
      if (!isMounted || !settingsObj) return;
      const cfg = settingsObj.global_config || settingsObj;
      if (cfg?.examDefaults) {
        setExamDefaults((prev) => ({ ...prev, ...cfg.examDefaults }));
        if (cfg.examDefaults.treatWarningsAsErrors !== undefined) {
          setStrictCompiler(!!cfg.examDefaults.treatWarningsAsErrors);
        }
      }
      if (cfg?.security) {
        setKioskRules((prev) => ({ ...prev, ...cfg.security }));
      }
    };

    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((d) => {
        if (d?.settings) applySettings(d.settings);
      })
      .catch(() => {});

    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/kiosk-settings`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (isMounted && data?.settings) setKioskRules((prev) => ({ ...prev, ...data.settings }));
      })
      .catch(() => {});

    if (socket) {
      const sendAuth = () => {
        const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
        socket.emit('authenticate', { token, user: currentUser });
      };
      sendAuth();
      socket.on('connect', sendAuth);

      const handleSettingsUpdate = (data) => {
        if (data?.settings) applySettings(data.settings);
      };
      const handleKioskSettings = (newSettings) => {
        if (newSettings) setKioskRules((prev) => ({ ...prev, ...newSettings }));
      };

      socket.on('system_settings_updated', handleSettingsUpdate);
      socket.on('kiosk_settings', handleKioskSettings);
      return () => {
        isMounted = false;
        socket.off('connect', sendAuth);
        socket.off('system_settings_updated', handleSettingsUpdate);
        socket.off('kiosk_settings', handleKioskSettings);
      };
    }
    return () => {
      isMounted = false;
    };
  }, [socket, currentUser, setStrictCompiler]);

  // Lockdown in Electron
  useEffect(() => {
    window.electronAPI?.enableLockdown?.({ disableWindowsKeyAltTab: kioskRules.disableWindowsKeyAltTab });
  }, [kioskRules.disableWindowsKeyAltTab]);

  // Monitor count enforcement
  useEffect(() => {
    if (!kioskRules.enforceSingleMonitor) {
      setMultiMonitorDetected(false);
      return;
    }
    const checkMonitors = async () => {
      try {
        const count = await window.electronAPI?.getDisplayCount?.();
        setMultiMonitorDetected(count > 1);
      } catch (_) {}
    };
    checkMonitors();
    const interval = setInterval(checkMonitors, 3000);
    return () => clearInterval(interval);
  }, [kioskRules.enforceSingleMonitor]);

  // VM detection
  useEffect(() => {
    if (kioskRules.blockVirtualMachine === false) {
      setVmDetected(false);
      return;
    }
    let isMounted = true;
    const checkVm = async () => {
      if (window.electronAPI && typeof window.electronAPI.checkVmStatus === 'function') {
        try {
          const res = await window.electronAPI.checkVmStatus();
          if (!isMounted) return;
          if (res?.isVm) {
            setVmDetected(true);
            setVmReasons(res.reasons || []);
            emitToSockets('proctor_alert', {
              studentId: studentActualId,
              name: safeUsername,
              email: currentUser?.email || '',
              action: 'Virtual Machine Detected',
              desc: `VM Detected during exam: ${res.reasons?.[0] || 'Virtualized environment detected'}`,
              color: '#ef4444'
            });
          } else {
            setVmDetected(false);
          }
        } catch (_) {}
      }
    };
    checkVm();
    const interval = setInterval(checkVm, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [kioskRules.blockVirtualMachine, emitToSockets, studentActualId, safeUsername, currentUser]);

  // Desktop Web browser check
  useEffect(() => {
    if (window.electronAPI) return;
    const checkEnv = () => {
      const isDesktop = isDesktopWebBrowser();
      setIsDesktopWeb((prev) => (prev !== isDesktop ? isDesktop : prev));
    };
    window.addEventListener('resize', checkEnv);
    window.addEventListener('orientationchange', checkEnv);
    const timer = setInterval(checkEnv, 600);
    return () => {
      window.removeEventListener('resize', checkEnv);
      window.removeEventListener('orientationchange', checkEnv);
      clearInterval(timer);
    };
  }, []);

  // Idle session timeout
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    const timeoutMs = parseTimeoutMs(kioskRules.sessionTimeout);
    const interval = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      setIdleWarning(idleTime >= timeoutMs - 60000);
    }, 5000);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      clearInterval(interval);
    };
  }, [kioskRules.sessionTimeout]);

  // Tab exits listener
  useEffect(() => {
    const handleTabExit = (actionLabel = 'Exit tab') => {
      if (kioskRulesRef.current?.flagTabExits === false) return;
      const isRecentCrash = window.verityCrashTime && Date.now() - window.verityCrashTime < 2500;
      if (isRecentCrash || isExitingCleanlyRef.current) return;
      const now = Date.now();
      if (now - lastTabExitLogRef.current < 1500) return;
      lastTabExitLogRef.current = now;
      addProctorLog(actionLabel, '#eab308');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleTabExit('Alt Tab');
    };
    const handleWindowBlur = () => {
      if (document.activeElement?.tagName === 'IFRAME') return;
      handleTabExit('Alt Tab');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [addProctorLog]);

  const resetCognitivePauseTimer = useCallback(() => {}, []);

  // Capture internal copy/cut anywhere in the DOM
  useEffect(() => {
    const captureAnyInternalCopy = () => {
      let text = window.getSelection ? window.getSelection().toString() || '' : '';
      const active = document.activeElement;
      if (!text && active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && typeof active.selectionStart === 'number') {
        text = active.value.substring(active.selectionStart, active.selectionEnd) || '';
      }
      const key = normalize(text);
      if (key) copiedInternallyRef.current.add(key);
    };
    window.addEventListener('copy', captureAnyInternalCopy, true);
    window.addEventListener('cut', captureAnyInternalCopy, true);
    return () => {
      window.removeEventListener('copy', captureAnyInternalCopy, true);
      window.removeEventListener('cut', captureAnyInternalCopy, true);
    };
  }, []);

  return {
    kioskRules,
    examDefaults,
    multiMonitorDetected,
    vmDetected,
    vmReasons,
    isDesktopWeb,
    idleWarning,
    proctorLogs,
    setProctorLogs,
    proctorLogsRef,
    addProctorLog,
    resetCognitivePauseTimer,
    isExitingCleanlyRef,
    copiedInternallyRef
  };
}
