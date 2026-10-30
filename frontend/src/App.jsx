import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';

// IMPORT ALL PAGES
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import ClassroomView from './pages/ClassroomView';
import StudentActivityDetail from './pages/StudentActivityDetail';
import StudentView from './pages/StudentView';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherClasswork from './pages/TeacherClasswork';
import TeacherGrading from './pages/TeacherGrading';
import TeacherView from './pages/TeacherView';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/admin/AdminLogin';
import ProtectedRoute from './components/ProtectedRoute';
import NotFound from './pages/NotFound';
import syncService from './services/syncService';
import { subscribeConnectionStatus, getConnectionStatus, getCloudUrl, getLocalApiUrl, getActiveSocketUrl, apiFetch } from './utils/api';
import { saveClassroomTheme } from './utils/classroomUtils';
import { notifyUserListeners } from './hooks/useCurrentUser';
import { useMediaQuery } from './hooks/useMediaQuery';
import { isDesktopWebBrowser, isMobileDevice, isDevToolsOrEmulation } from './utils/deviceUtils';
import ComLabWebBlocker from './components/ComLabWebBlocker';
import NetworkStatusIndicator from './components/NetworkStatusIndicator';
import { useDarkMode } from './hooks/useDarkMode';
import { ShieldAlert } from 'lucide-react';

export const createVeritySocket = (targetUrl) => {
  const url = targetUrl || getActiveSocketUrl();
  const sock = io(url, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 6000,
    transports: ['websocket', 'polling'],
    auth: (cb) => {
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      cb({ token });
    }
  });

  sock.on('connect', () => {
    console.log(`📡 [Socket.IO] Connected to ${url}`);
  });

  return sock;
};

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

export default function App() {
  const isAdminApp = isRunningInAdminMode();
  const [socket, setSocket] = useState(() => createVeritySocket(getActiveSocketUrl()));
  const currentSocketUrlRef = useRef(getActiveSocketUrl());

  useEffect(() => {
    const unsubscribe = subscribeConnectionStatus((status) => {
      const desiredUrl = getActiveSocketUrl();
      if (desiredUrl && desiredUrl !== currentSocketUrlRef.current) {
        console.log(`📡 [Socket.IO] Active network target shifted from ${currentSocketUrlRef.current} to ${desiredUrl}. Reconstructing socket...`);
        currentSocketUrlRef.current = desiredUrl;
        setSocket((prev) => {
          if (prev) {
            try { prev.disconnect(); } catch (_) {}
          }
          return createVeritySocket(desiredUrl);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isDark } = useDarkMode();
  const [isDesktopWeb, setIsDesktopWeb] = useState(() => isDesktopWebBrowser());
  const [vmDetected, setVmDetected] = useState(false);
  const [vmReasons, setVmReasons] = useState([]);

  // Real-time Virtual Machine (VM) detection monitor in Electron
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
      } catch (_) {}
    };

    checkVmEnvironment();
    const timer = setInterval(checkVmEnvironment, 8000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Real-time DevTools and viewport resize monitor
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

  // Prevent F12, DevTools shortcuts, and right-click inspection on web browser
  useEffect(() => {
    if (window.electronAPI) return;

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

  // 1. INITIALIZE STATE FROM LOCAL STORAGE
  const [currentScreen, setCurrentScreen] = useState(() => {
    let savedUser = null;
    try {
      const savedUserStr = localStorage.getItem('currentUser') || localStorage.getItem('verity_user');
      savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
    } catch (_) {}

    if (isAdminApp) {
      if (savedUser && savedUser.role === 'Admin') return 'admin_dashboard';
      return 'admin_login';
    }

    // Standard path (e.g. / or /login)
    if (!savedUser) {
      return 'login';
    }

    const savedScreen = localStorage.getItem('currentScreen');
    if (savedScreen && savedScreen !== 'admin_login' && savedScreen !== 'admin_dashboard') {
      return savedScreen;
    }

    if (savedUser.role === 'Admin') return 'admin_dashboard';
    if (savedUser.role === 'Teacher') return 'teacher_dashboard';
    return 'student_dashboard';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem('currentUser') || localStorage.getItem('verity_user');
      const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
      if (isAdminApp && savedUser && savedUser.role !== 'Admin') {
        return null;
      }
      return savedUser;
    } catch (e) {
      console.warn('Failed to parse currentUser from localStorage', e);
      return null;
    }
  });

  // Restore persistent account session in Electron (.exe) from SQLite localDB
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

      // If missing from localStorage or in Electron, check localDB
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
  }, [isAdminApp]);

  // Strict screen guard: If in Admin App, enforce that only admin screens can ever be shown
  useEffect(() => {
    if (isAdminApp) {
      if (currentUser?.role === 'Admin') {
        if (currentScreen !== 'admin_dashboard') {
          setCurrentScreen('admin_dashboard');
        }
      } else {
        if (currentScreen !== 'admin_login') {
          setCurrentScreen('admin_login');
        }
      }
    }
  }, [isAdminApp, currentUser, currentScreen]);

    const [activeClassroom, setActiveClassroom] = useState(() => {
      try {
        const savedClass = localStorage.getItem('activeClassroom');
        return savedClass ? JSON.parse(savedClass) : null;
      } catch (e) {
        console.warn('Failed to parse activeClassroom from localStorage', e);
        return null;
      }
    });

    // The assignment the teacher is currently monitoring (carries its instruction).
    const [activeAssignment, setActiveAssignment] = useState(() => {
      try {
        const saved = localStorage.getItem('activeAssignment');
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        console.warn('Failed to parse activeAssignment from localStorage', e);
        return null;
      }
    });

  const [selectedStudentForPlayback, setSelectedStudentForPlayback] = useState(() => {
    try {
      const saved = sessionStorage.getItem('verity_playback_student');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [proctoringReturnScreen, setProctoringReturnScreen] = useState(() => {
    return sessionStorage.getItem('verity_proctoring_return') || 'teacher_classwork';
  });

  const [proctoringMode, setProctoringMode] = useState(() => {
    return sessionStorage.getItem('verity_proctoring_mode') || 'live';
  });

  const [workspaceReturnScreen, setWorkspaceReturnScreen] = useState(() => {
    return sessionStorage.getItem('verity_workspace_return') || 'classroom_view';
  });

  useEffect(() => {
    if (selectedStudentForPlayback) {
      sessionStorage.setItem('verity_playback_student', JSON.stringify(selectedStudentForPlayback));
    } else {
      sessionStorage.removeItem('verity_playback_student');
    }
  }, [selectedStudentForPlayback]);

  useEffect(() => {
    if (proctoringReturnScreen) {
      sessionStorage.setItem('verity_proctoring_return', proctoringReturnScreen);
    }
  }, [proctoringReturnScreen]);

  useEffect(() => {
    if (proctoringMode) {
      sessionStorage.setItem('verity_proctoring_mode', proctoringMode);
    }
  }, [proctoringMode]);

  useEffect(() => {
    if (workspaceReturnScreen) {
      sessionStorage.setItem('verity_workspace_return', workspaceReturnScreen);
    }
  }, [workspaceReturnScreen]);

  // ── Intelligent Navigation History Stack (Browser Back & UI Back Sync) ──
  const [navigationStack, setNavigationStack] = useState(() => {
    try {
      const raw = sessionStorage.getItem('verity_nav_stack');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const isProgrammaticBackRef = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem('verity_nav_stack', JSON.stringify(navigationStack));
    } catch {}
  }, [navigationStack]);

  const getDefaultFallbackScreen = (screen, role) => {
    const isTeacher = role === 'Teacher';
    switch (screen) {
      case 'teacher_proctoring':
      case 'teacher_live_monitoring':
      case 'teacher_playback':
        return proctoringReturnScreen || 'teacher_grading';
      case 'teacher_grading':
        return 'teacher_classwork';
      case 'teacher_classwork':
        return 'teacher_dashboard';
      case 'student_workspace':
        return workspaceReturnScreen || 'classroom_view';
      case 'student_activity_detail':
        return workspaceReturnScreen === 'student_dashboard' ? 'student_dashboard' : 'classroom_view';
      case 'classroom_view':
        return 'student_dashboard';
      case 'sandbox_workspace':
        return 'student_dashboard';
      default:
        return isTeacher ? 'teacher_dashboard' : 'student_dashboard';
    }
  };

  const navigateTo = (targetScreen, context = {}) => {
    const isSameScreen = targetScreen === currentScreen;
    if (isSameScreen && !context.force && !context.classroom && !context.assignment) return;

    const snapshot = {
      screen: currentScreen,
      classroom: activeClassroom,
      assignment: activeAssignment,
      selectedStudent: selectedStudentForPlayback,
      proctoringMode,
      proctoringReturnScreen,
      workspaceReturnScreen,
      teacherTab: activeClassroom?.id
        ? (sessionStorage.getItem(`verity_teacher_classwork_tab_${activeClassroom.id}`) || sessionStorage.getItem('verity_teacher_classwork_tab_active'))
        : null,
      studentTab: activeClassroom?.id
        ? (sessionStorage.getItem(`verity_student_classroom_tab_${activeClassroom.id}`) || sessionStorage.getItem('verity_student_classroom_tab_active'))
        : null,
      timestamp: Date.now()
    };

    setNavigationStack(prev => [...prev.slice(-30), snapshot]);

    if (context.classroom !== undefined) setActiveClassroom(context.classroom);
    if (context.assignment !== undefined) setActiveAssignment(context.assignment);
    if (context.student !== undefined) setSelectedStudentForPlayback(context.student);
    if (context.proctoringMode !== undefined) setProctoringMode(context.proctoringMode);
    if (context.proctoringReturnScreen !== undefined) setProctoringReturnScreen(context.proctoringReturnScreen);
    if (context.workspaceReturnScreen !== undefined) setWorkspaceReturnScreen(context.workspaceReturnScreen);
    if (context.tab && (context.classroom?.id || activeClassroom?.id)) {
      const cid = context.classroom?.id || activeClassroom?.id;
      if (currentUser?.role === 'Teacher') {
        try {
          sessionStorage.setItem(`verity_teacher_classwork_tab_${cid}`, context.tab);
          sessionStorage.setItem('verity_teacher_classwork_tab_active', context.tab);
        } catch {}
      } else {
        try {
          sessionStorage.setItem(`verity_student_classroom_tab_${cid}`, context.tab);
          sessionStorage.setItem('verity_student_classroom_tab_active', context.tab);
        } catch {}
      }
    }

    if (typeof window !== 'undefined' && window.history?.pushState) {
      try {
        window.history.pushState({ screen: targetScreen, time: Date.now() }, '', window.location.pathname);
      } catch {}
    }

    setCurrentScreen(targetScreen);
    try {
      localStorage.setItem('currentScreen', targetScreen);
    } catch {}
  };

  const executeGoBack = (fallbackScreen) => {
    setNavigationStack(prev => {
      if (prev && prev.length > 0) {
        const nextStack = [...prev];
        const target = nextStack.pop();

        if (target.classroom !== undefined) setActiveClassroom(target.classroom);
        if (target.assignment !== undefined) setActiveAssignment(target.assignment);
        if (target.selectedStudent !== undefined) setSelectedStudentForPlayback(target.selectedStudent);
        if (target.proctoringMode !== undefined) setProctoringMode(target.proctoringMode);
        if (target.proctoringReturnScreen !== undefined) setProctoringReturnScreen(target.proctoringReturnScreen);
        if (target.workspaceReturnScreen !== undefined) setWorkspaceReturnScreen(target.workspaceReturnScreen);
        if (target.teacherTab && target.classroom?.id) {
          try {
            sessionStorage.setItem(`verity_teacher_classwork_tab_${target.classroom.id}`, target.teacherTab);
            sessionStorage.setItem('verity_teacher_classwork_tab_active', target.teacherTab);
          } catch {}
        }
        if (target.studentTab && target.classroom?.id) {
          try {
            sessionStorage.setItem(`verity_student_classroom_tab_${target.classroom.id}`, target.studentTab);
            sessionStorage.setItem('verity_student_classroom_tab_active', target.studentTab);
          } catch {}
        }

        setCurrentScreen(target.screen);
        try {
          localStorage.setItem('currentScreen', target.screen);
        } catch {}
        return nextStack;
      }

      const defaultFallback = fallbackScreen || getDefaultFallbackScreen(currentScreen, currentUser?.role);
      setCurrentScreen(defaultFallback);
      try {
        localStorage.setItem('currentScreen', defaultFallback);
      } catch {}
      return [];
    });
  };

  const handleBack = (fallbackScreen) => {
    if (typeof window !== 'undefined' && window.history && window.history.state && navigationStack.length > 0) {
      isProgrammaticBackRef.current = true;
      window.history.back();
    } else {
      executeGoBack(fallbackScreen);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.history && !window.history.state) {
      try {
        window.history.replaceState({ screen: currentScreen, initial: true }, '', window.location.pathname);
      } catch {}
    }

    const handlePopState = () => {
      if (currentScreen === 'student_workspace' && (activeAssignment?.disableBack || activeAssignment?.disable_back)) {
        const cId = activeClassroom?.id != null ? String(activeClassroom.id) : (activeAssignment?.classroom_id || 'none');
        const aId = activeAssignment?.id != null ? String(activeAssignment.id) : 'none';
        const sId = currentUser?.id != null ? String(currentUser.id) : (currentUser?.email || currentUser?.name || 'none');
        const sKeys = [
          `verity_sub_${cId}_${aId}_${sId}`,
          `verity_sub_${cId}_${aId}_${currentUser?.name}`,
          `verity_sub_${cId}_${aId}`
        ];
        const isSub = sKeys.some(k => {
          try { return Boolean(localStorage.getItem(k)); } catch { return false; }
        });
        if (!isSub) {
          try {
            window.history.pushState({ screen: 'student_workspace' }, '', window.location.pathname);
          } catch {}
          return;
        }
      }
      executeGoBack();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentScreen, currentUser, activeAssignment, activeClassroom]);

  const [connStatus, setConnStatus] = useState(() => getConnectionStatus());

  useEffect(() => {
    const unsub = subscribeConnectionStatus(setConnStatus);
    return () => unsub();
  }, []);

  // Setup offline sync queue handler
  useEffect(() => {
    syncService.initAutoSync(() => localStorage.getItem('verity_token') || localStorage.getItem('token'));
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    if (token) {
      syncService.syncOfflineQueue(token);
    }
  }, []);

  // ────────────────────────────── Auto‑logout on Maintenance ──────────────────────────────
  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/maintenance-status`);
        if (res.ok) {
          const data = await res.json();
          if (data.enabled && currentUser && currentUser.role !== 'Admin') {
            // Force logout for students/teachers when maintenance is active
            handleLogout();
          }
        }
      } catch (_) {}
    };
    checkMaintenance();
    const interval = setInterval(checkMaintenance, 30000); // every 30 seconds
    return () => clearInterval(interval);
  }, [currentUser]);

  // Hydrate real permanent user profile (including avatar) from database
  useEffect(() => {
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    if (token) {
      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/profile`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.user) {
            setCurrentUser(prev => {
              const updated = { ...prev, ...data.user };
              localStorage.setItem('currentUser', JSON.stringify(updated));
              return updated;
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleAvatarBroadcast = (data) => {
      if (data && currentUser && (String(data.userId) === String(currentUser.id) || data.email === currentUser.email)) {
        setCurrentUser(prev => {
          const updated = { ...prev, avatar: data.avatar, name: data.name };
          localStorage.setItem('currentUser', JSON.stringify(updated));
          return updated;
        });
      }
    };
    socket.on('user_avatar_updated', handleAvatarBroadcast);
    return () => socket.off('user_avatar_updated', handleAvatarBroadcast);
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('currentScreen', currentScreen);
  }, [currentScreen]);

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
      socket.auth = { token };
      socket.emit('authenticate', { token, user: currentUser });

      // Persist to Electron SQLite storage so closing .exe remembers the login
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
      socket.auth = {};
      if (window.electronAPI?.localDB?.setLocal) {
        window.electronAPI.localDB.setLocal('verity_saved_session_user', null).catch(() => {});
        window.electronAPI.localDB.setLocal('verity_saved_session_token', null).catch(() => {});
        window.electronAPI.localDB.setLocal('verity_saved_session_screen', null).catch(() => {});
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const handleConnect = () => {
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      if (token || currentUser) {
        socket.emit('authenticate', { token, user: currentUser });
      }
    };
    socket.on('connect', handleConnect);
    if (socket.connected) handleConnect();
    return () => socket.off('connect', handleConnect);
  }, [currentUser]);

  useEffect(() => {
    if (activeClassroom) {
      localStorage.setItem('activeClassroom', JSON.stringify(activeClassroom));
    } else {
      localStorage.removeItem('activeClassroom');
    }
  }, [activeClassroom]);

  useEffect(() => {
    if (activeAssignment) {
      localStorage.setItem('activeAssignment', JSON.stringify(activeAssignment));
    } else {
      localStorage.removeItem('activeAssignment');
    }
  }, [activeAssignment]);

  // Keep activeAssignment in sync if instructor modifies it in real time
  useEffect(() => {
    if (!socket) return;
    const handleClassworkChanged = (payload) => {
      if (Array.isArray(payload?.classwork)) {
        setActiveAssignment(prev => {
          if (!prev) return prev;
          const match = payload.classwork.find(cw => String(cw.id) === String(prev.id));
          return match ? { ...prev, ...match } : prev;
        });
      }
    };
    socket.on('classwork_changed', handleClassworkChanged);
    return () => socket.off('classwork_changed', handleClassworkChanged);
  }, [socket]);

  // Keep classroom themes in sync in real-time across all views, tabs, and student sessions
  useEffect(() => {
    if (!socket) return;
    const handleThemeChanged = (data) => {
      if (!data || !data.theme) return;

      const targetClassroom = {
        id: data.classroomId,
        code: data.code,
        name: data.name,
        section: data.code || data.section
      };

      // Save locally to localStorage, update stored classroom lists, and dispatch verity:banner-updated
      saveClassroomTheme(targetClassroom, data.theme, null);

      // Keep activeClassroom in sync if it's currently open
      setActiveClassroom(prev => {
        if (!prev) return prev;
        const matches =
          (data.classroomId != null && String(prev.id) === String(data.classroomId)) ||
          (data.code && prev.code && String(prev.code).toLowerCase() === String(data.code).toLowerCase()) ||
          (data.code && prev.section && String(prev.section).toLowerCase() === String(data.code).toLowerCase()) ||
          (data.name && prev.name && String(prev.name).toLowerCase() === String(data.name).toLowerCase());

        if (matches) {
          const updated = { ...prev, theme: data.theme };
          localStorage.setItem('activeClassroom', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    };

    socket.on('classroom_theme_changed', handleThemeChanged);
    return () => socket.off('classroom_theme_changed', handleThemeChanged);
  }, [socket]);

  // Keep all dashboard views automatically synchronized when background differential sync fires
  useEffect(() => {
    if (!socket) return;
    const handleDataSynced = () => {
      window.dispatchEvent(new CustomEvent('verity:classrooms-changed'));
      window.dispatchEvent(new CustomEvent('verity:users-changed'));
      window.dispatchEvent(new CustomEvent('verity:sync-completed'));
    };
    socket.on('classrooms_updated', handleDataSynced);
    socket.on('users_updated', handleDataSynced);
    socket.on('verity_data_synced', handleDataSynced);
    return () => {
      socket.off('classrooms_updated', handleDataSynced);
      socket.off('users_updated', handleDataSynced);
      socket.off('verity_data_synced', handleDataSynced);
    };
  }, [socket]);


  // Lockdown helpers — no-op outside Electron (e.g. browser dev).
  const lockDown = () => window.electronAPI?.enableLockdown?.();
  const releaseLockdown = () => window.electronAPI?.disableLockdown?.();

  const verifyEnvironmentBeforeExam = async () => {
    if (isDesktopWebBrowser()) {
      alert('🚫 Desktop Web Browser Blocked\n\nIn the Computer Laboratory or on desktop/laptop computers, all exams and coding activities must be conducted using the official "The Verity.exe" desktop application for kiosk lockdown and exam integrity.\n\nWeb access is strictly reserved for mobile phones.\n\nPlease close this browser and launch The Verity (.exe).');
      return false;
    }

    if (window.electronAPI && typeof window.electronAPI.checkVmStatus === 'function') {
      try {
        const vmStatus = await window.electronAPI.checkVmStatus();
        if (vmStatus && vmStatus.isVm) {
          alert('🚫 Virtual Machine Detected\n\nRunning The Verity inside a Virtual Machine (VMware, VirtualBox, Hyper-V, QEMU, etc.) is strictly prohibited during exams.\n\nPlease launch The Verity directly on your physical operating system.');
          return false;
        }
      } catch (_) {}
    }
    return true;
  };

  // Re-assert lockdown on app reload if a student session was restored from
  // localStorage (otherwise a refresh would drop them out of kiosk mode).
  useEffect(() => {
    if (currentUser?.role === 'Student' && currentScreen !== 'login') {
      lockDown();
    }
  }, []);

  // Proctoring & System Exit monitor for students even outside the workspace
  useEffect(() => {
    if (currentUser?.role !== 'Student') return;

    let lastExitTabTime = 0;
    const handleWindowExit = () => {
      // If student is currently inside student_workspace, StudentView handles workspace proctoring
      if (currentScreen === 'student_workspace') return;
      const now = Date.now();
      if (now - lastExitTabTime < 1500) return; // 1.5s debounce
      lastExitTabTime = now;

      const studentName = currentUser.name || currentUser.email || 'Student';
      const studentId = currentUser.id || currentUser.email || studentName;
      const screenLabel = currentScreen ? currentScreen.replace('_', ' ') : 'dashboard';

      // 1. Live socket alert so Admin immediately receives notification & stats update
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

      // 2. Persist directly to audit_logs
      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: studentName,
          type: 'Exit Tab Violation',
          severity: 'Warning',
          desc: `Alt Tab / Window Exit: ${studentName} exited the application window outside workspace (${screenLabel})`
        })
      }).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleWindowExit();
    };
    const handleBlur = () => {
      handleWindowExit();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    // Detect when student exits the system entirely (closing window/tab, navigating away, pagehide)
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
      } catch (_) {}

      try {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/audit-logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: payload,
          keepalive: true
        }).catch(() => {});
      } catch (_) {}
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

  // 3. SECURE LOGOUT (Wipes the memory)
  const handleLogout = () => {
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
    localStorage.removeItem('currentScreen');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('activeClassroom');
    localStorage.removeItem('activeAssignment');
    localStorage.removeItem('verity_token');
    localStorage.removeItem('token');
    localStorage.removeItem('verity_user');
    // Clear persistent Electron session
    if (window.electronAPI?.localDB?.setLocal) {
      window.electronAPI.localDB.setLocal('verity_saved_session_user', null).catch(() => {});
      window.electronAPI.localDB.setLocal('verity_saved_session_token', null).catch(() => {});
      window.electronAPI.localDB.setLocal('verity_saved_session_screen', null).catch(() => {});
    }
    // Clear un-scoped legacy keys so accounts never bleed into each other
    localStorage.removeItem('verity_teacher_classrooms');
    localStorage.removeItem('verity_classrooms');
    localStorage.removeItem('verity_student_classrooms_default');
    localStorage.removeItem('verity_student_classrooms_anon');
    localStorage.removeItem('verity_teacher_classrooms_anon');
    localStorage.removeItem('verity_teacher_classrooms_default');
    localStorage.removeItem('verity_cached_classrooms');
    sessionStorage.clear();
  };

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
      lockDown(); // students only
      setCurrentScreen('student_dashboard');
    }
  };

// ==========================
//      ROUTING LOGIC
// ==========================

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentUser ? 'logged-in' : 'logged-out'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}
        >
          {/* --- ADMIN APP EXCLUSIVE ROUTES --- */}
          {isAdminApp ? (
            <>
              {currentScreen === 'admin_dashboard' && currentUser?.role === 'Admin' ? (
                <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen} requiredRole="Admin">
                  <AdminDashboard currentUser={currentUser} onLogout={handleLogout} socket={socket} />
                </ProtectedRoute>
              ) : (
                <AdminLogin
                  onLogin={(user, token) => {
                    localStorage.removeItem('verity_teacher_classrooms');
                    localStorage.removeItem('verity_classrooms');
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    localStorage.setItem('verity_user', JSON.stringify(user));
                    if (token) {
                      localStorage.setItem('verity_token', token);
                      localStorage.setItem('token', token);
                    }
                    localStorage.setItem('currentScreen', 'admin_dashboard');

                    if (window.electronAPI?.localDB?.setLocal) {
                      window.electronAPI.localDB.setLocal('verity_saved_session_user', user).catch(() => {});
                      if (token) window.electronAPI.localDB.setLocal('verity_saved_session_token', token).catch(() => {});
                      window.electronAPI.localDB.setLocal('verity_saved_session_screen', 'admin_dashboard').catch(() => {});
                    }

                    setCurrentUser(user);
                    notifyUserListeners(user);
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('verity:user-updated', { detail: user }));
                    }
                    setCurrentScreen('admin_dashboard');
                  }}
                />
              )}
            </>
          ) : (
            <>
          {/* --- AUTH ROUTES --- */}
          {currentScreen === 'admin_login' && (
            <AdminLogin
              onLogin={(user, token) => {
                localStorage.removeItem('verity_teacher_classrooms');
                localStorage.removeItem('verity_classrooms');
                localStorage.setItem('currentUser', JSON.stringify(user));
                localStorage.setItem('verity_user', JSON.stringify(user));
                if (token) {
                  localStorage.setItem('verity_token', token);
                  localStorage.setItem('token', token);
                }
                localStorage.setItem('currentScreen', 'admin_dashboard');

                if (window.electronAPI?.localDB?.setLocal) {
                  window.electronAPI.localDB.setLocal('verity_saved_session_user', user).catch(() => {});
                  if (token) window.electronAPI.localDB.setLocal('verity_saved_session_token', token).catch(() => {});
                  window.electronAPI.localDB.setLocal('verity_saved_session_screen', 'admin_dashboard').catch(() => {});
                }

                setCurrentUser(user);
                notifyUserListeners(user);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('verity:user-updated', { detail: user }));
                }
                setCurrentScreen('admin_dashboard');
              }}
            />
          )}

          {currentScreen === 'login' && (
            <Login
              onLogin={handleUserLogin}
              onGoToRegister={() => setCurrentScreen('register')}
            />
          )}

          {currentScreen === 'register' && (
            <Register
              onBackToLogin={() => setCurrentScreen('login')}
              onLogin={handleUserLogin}
            />
          )}

          {/* --- STUDENT ROUTES (Protected) --- */}
          {currentUser?.role === 'Student' && isDesktopWeb ? (
            <ComLabWebBlocker currentUser={currentUser} onLogout={handleLogout} />
          ) : currentUser?.role === 'Student' && vmDetected ? (
            <div style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              backgroundColor: isDark ? '#090d16' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            }}>
              <div style={{
                maxWidth: '640px',
                width: '100%',
                backgroundColor: isDark ? '#111827' : '#ffffff',
                borderRadius: '20px',
                border: isDark ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid #fecaca',
                padding: '36px 32px',
                textAlign: 'center',
                boxShadow: isDark
                  ? '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(220, 38, 38, 0.2)'
                  : '0 25px 50px -12px rgba(220, 38, 38, 0.15), 0 10px 25px -5px rgba(0, 0, 0, 0.08)',
                color: isDark ? '#f3f4f6' : '#1f2937'
              }}>
                <div style={{ width: '84px', height: '84px', borderRadius: '24px', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#fef2f2', border: isDark ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)' }}>
                  <ShieldAlert size={44} color="#ef4444" strokeWidth={2.2} />
                </div>
                <h2 style={{ fontSize: '1.85rem', fontWeight: 'bold', marginBottom: '12px', color: '#f87171' }}>
                  Virtual Machine Detected — Exam Blocked
                </h2>
                <p style={{ fontSize: '1rem', color: isDark ? '#cbd5e1' : '#4b5563', lineHeight: 1.6, marginBottom: '20px' }}>
                  The Verity Exam Integrity System has detected that this session is running inside a <strong>Virtual Machine (VM)</strong>. Taking exams or executing code within virtualized environments (VMware, VirtualBox, Hyper-V, QEMU, etc.) is strictly prohibited.
                </p>
                {vmReasons.length > 0 && (
                  <div style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc', border: isDark ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', textAlign: 'left' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fca5a5', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Hardware & System Indicators:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: isDark ? '#cbd5e1' : '#64748b', lineHeight: 1.5 }}>
                      {vmReasons.slice(0, 4).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    onClick={() => {
                      if (window.electronAPI?.closeApp) {
                        window.electronAPI.closeApp();
                      } else {
                        handleLogout();
                      }
                    }}
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 28px',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Exit Application
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{
                      backgroundColor: 'transparent',
                      color: isDark ? '#94a3b8' : '#64748b',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '12px 20px',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {currentScreen === 'student_dashboard' && (
                <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
                  <StudentDashboard
                    socket={socket}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onEnterClassroom={(classroom) => {
                      navigateTo('classroom_view', { classroom });
                    }}
                    onOpenAssignment={(classroom, task) => {
                      navigateTo('student_activity_detail', { classroom, assignment: task, workspaceReturnScreen: 'student_dashboard' });
                    }}
                    onOpenSandbox={() => navigateTo('sandbox_workspace')}
                  />
                </ProtectedRoute>
              )}

              {currentScreen === 'classroom_view' && (
                <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
                  <ClassroomView
                    key={activeClassroom?.id ? `student_class_${activeClassroom.id}` : 'classroom_view'}
                    onEnterClassroom={(classroom) => {
                      setActiveClassroom(classroom);
                      navigateTo('classroom_view', { classroom, force: true });
                    }}
                    socket={socket}
                    currentUser={currentUser}
                    classroom={activeClassroom}
                    onLogout={handleLogout}
                    onBack={() => handleBack('student_dashboard')}
                    onNavigateView={(view) => {
                      localStorage.setItem('verity_student_view', view);
                      navigateTo('student_dashboard');
                    }}
                    onOpenAssignment={(task) => {
                      navigateTo('student_activity_detail', { assignment: task, classroom: activeClassroom || task.classroom, workspaceReturnScreen: 'classroom_view' });
                    }}
                    onStartAssignment={async (task) => {
                      const allowed = await verifyEnvironmentBeforeExam();
                      if (!allowed) return;
                      navigateTo('student_workspace', { assignment: task, classroom: activeClassroom || task.classroom, workspaceReturnScreen: 'classroom_view' });
                    }}
                  />
                </ProtectedRoute>
              )}

              {currentScreen === 'student_activity_detail' && (
                <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
                  <StudentActivityDetail
                    socket={socket}
                    currentUser={currentUser}
                    classroom={activeClassroom}
                    assignment={activeAssignment}
                    onBack={() => handleBack(workspaceReturnScreen === 'student_dashboard' ? 'student_dashboard' : 'classroom_view')}
                    onNavigateView={(view) => {
                      localStorage.setItem('verity_student_view', view);
                      navigateTo('student_dashboard');
                    }}
                    onStartCoding={async () => {
                      const allowed = await verifyEnvironmentBeforeExam();
                      if (!allowed) return;
                      navigateTo('student_workspace', {
                        assignment: activeAssignment,
                        classroom: activeClassroom || activeAssignment?.classroom,
                        workspaceReturnScreen: 'student_activity_detail'
                      });
                    }}
                    onEnterClassroom={(classroom) => {
                      navigateTo('classroom_view', { classroom });
                    }}
                    onLogout={handleLogout}
                  />
                </ProtectedRoute>
              )}

              {currentScreen === 'student_workspace' && (
                <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
                  <StudentView
                    key={activeAssignment?.id ? `student_view_${activeAssignment.id}` : 'student_view'}
                    socket={socket}
                    currentUser={currentUser}
                    username={currentUser?.name}
                    assignment={activeAssignment}
                    classroom={activeClassroom}
                    onBack={() => handleBack(workspaceReturnScreen || 'classroom_view')}
                  />
                </ProtectedRoute>
              )}

              {currentScreen === 'sandbox_workspace' && (
                <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
                  <StudentView
                    socket={socket}
                    currentUser={currentUser}
                    username={currentUser?.name}
                    isSandbox={true}
                    onBack={() => handleBack('student_dashboard')}
                  />
                </ProtectedRoute>
              )}
            </>
          )}

          {/* --- ADMIN ROUTES (Protected) --- */}
          {currentScreen === 'admin_dashboard' && (
            <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
              <AdminDashboard currentUser={currentUser} onLogout={handleLogout} socket={socket} />
            </ProtectedRoute>
          )}

          {/* --- TEACHER ROUTES (Protected) --- */}
          {currentScreen === 'teacher_dashboard' && (
            <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
              <TeacherDashboard
                currentUser={currentUser}
                onLogout={handleLogout}
                socket={socket}
                onEnterClassroom={(classroom) => {
                  navigateTo('teacher_classwork', { classroom });
                }}
              />
            </ProtectedRoute>
          )}

          {currentScreen === 'teacher_classwork' && (
            <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
              <TeacherClasswork
                key={activeClassroom?.id ? `teacher_class_${activeClassroom.id}` : 'teacher_classwork'}
                onEnterClassroom={(classroom) => {
                  setActiveClassroom(classroom);
                  navigateTo('teacher_classwork', { classroom, force: true });
                }}
                socket={socket}
                classroom={activeClassroom}
                onLogout={handleLogout}
                onBack={() => handleBack('teacher_dashboard')}
                onNavigateView={(view) => {
                  localStorage.setItem('verity_teacher_view', view);
                  navigateTo('teacher_dashboard');
                }}
                onStartMonitoring={(assignment) => {
                  navigateTo('teacher_live_monitoring', {
                    assignment,
                    student: null,
                    proctoringMode: 'live',
                    proctoringReturnScreen: 'teacher_classwork'
                  });
                }}
                onOpenGrading={(assignment, tab) => {
                  navigateTo('teacher_grading', {
                    assignment,
                    tab: tab || 'classwork'
                  });
                }}
                currentUser={currentUser}
                onOpenPlayback={(assignment, student) => {
                  navigateTo('teacher_playback', {
                    assignment,
                    student,
                    proctoringMode: 'playback',
                    proctoringReturnScreen: 'teacher_classwork'
                  });
                }}
              />
            </ProtectedRoute>
          )}

          {currentScreen === 'teacher_grading' && (
            <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
              <TeacherGrading
                socket={socket}
                classroom={activeClassroom}
                assignment={activeAssignment}
                onLogout={handleLogout}
                onBack={() => handleBack('teacher_classwork')}
                onEnterClassroom={(classroom) => {
                  navigateTo('teacher_classwork', { classroom });
                }}
                onNavigateView={(view) => {
                  localStorage.setItem('verity_teacher_view', view);
                  navigateTo('teacher_dashboard');
                }}
                onOpenPlayback={(assignment, student) => {
                  navigateTo('teacher_playback', {
                    assignment,
                    student,
                    proctoringMode: 'playback',
                    proctoringReturnScreen: 'teacher_grading'
                  });
                }}
                onStartMonitoring={(assignment, student) => {
                  navigateTo('teacher_live_monitoring', {
                    assignment,
                    student: student || null,
                    proctoringMode: 'live',
                    proctoringReturnScreen: 'teacher_grading'
                  });
                }}
                currentUser={currentUser}
              />
            </ProtectedRoute>
          )}

          {/* Screen para sa Live Monitoring at Replay Playback */}
          {(currentScreen === 'teacher_proctoring' || currentScreen === 'teacher_live_monitoring' || currentScreen === 'teacher_playback') && (
            <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
              <TeacherView
                key={activeAssignment?.id ? `teacher_view_${activeAssignment.id}_${currentScreen}` : 'teacher_view'}
                socket={socket}
                currentUser={currentUser}
                assignment={activeAssignment}
                classroom={activeClassroom}
                initialStudent={selectedStudentForPlayback}
                mode={currentScreen === 'teacher_playback' ? 'playback' : (currentScreen === 'teacher_live_monitoring' ? 'live' : proctoringMode)}
                onSwitchMode={(newMode) => {
                  setProctoringMode(newMode);
                  setCurrentScreen(newMode === 'playback' ? 'teacher_playback' : 'teacher_live_monitoring');
                  try {
                    localStorage.setItem('verity_proctoring_mode', newMode);
                  } catch {}
                }}
                onBack={() => {
                  if (proctoringMode === 'playback' || currentScreen === 'teacher_playback') {
                    setSelectedStudentForPlayback(null);
                  }
                  handleBack(proctoringReturnScreen || 'teacher_grading');
                }}
                onLogout={() => {
                  setSelectedStudentForPlayback(null);
                  handleBack(proctoringReturnScreen || 'teacher_classwork');
                }}
              />
            </ProtectedRoute>
          )}

          {/* Fallback kapag hindi kilala ang screen */}
          {currentUser && !['student_dashboard', 'classroom_view', 'student_activity_detail', 'student_workspace', 'sandbox_workspace', 'admin_dashboard', 'teacher_dashboard', 'teacher_classwork', 'teacher_grading', 'teacher_proctoring', 'teacher_live_monitoring', 'teacher_playback'].includes(currentScreen) && (
            <NotFound />
          )}

          {/* Login fallback para iwas white screen */}
          {!currentUser && !['login', 'register', 'admin_login'].includes(currentScreen) && (
            (typeof window !== 'undefined' && (window.location.pathname.startsWith('/admin') || Boolean(window.IS_ADMIN_APP))) ? (
              <AdminLogin
                onLogin={(user, token) => {
                  setCurrentUser(user);
                  notifyUserListeners(user);
                  if (token) localStorage.setItem('verity_token', token);
                  setCurrentScreen('admin_dashboard');
                }}
              />
            ) : (
              <Login
                onLogin={(user, token) => {
                  setCurrentUser(user);
                  if (token) localStorage.setItem('verity_token', token);
                  if (user.role === 'Admin') {
                    setCurrentScreen('admin_login');
                    return;
                  } else if (user.role === 'Teacher') {
                    setCurrentScreen('teacher_dashboard');
                  } else {
                    lockDown(); // students only
                    setCurrentScreen('student_dashboard');
                  }
                }}
                onGoToRegister={() => setCurrentScreen('register')}
              />
            )
          )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Network Connection Indicator Dot & Config Popover (Right Side) */}
      {!['student_workspace', 'sandbox_workspace', 'teacher_live_monitoring', 'teacher_proctoring', 'teacher_playback'].includes(currentScreen) && (
        <NetworkStatusIndicator position="right" />
      )}
    </div>
  );
}