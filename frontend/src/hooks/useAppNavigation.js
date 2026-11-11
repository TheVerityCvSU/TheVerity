import { useState, useEffect, useRef } from 'react';
import { getInitialAppScreen, getDefaultFallbackScreen } from '../utils/appNavigationUtils';

export function useAppNavigation({ isAdminApp, currentUser }) {
  const resolveUser = () => {
    if (currentUser) return currentUser;
    try {
      const saved = localStorage.getItem('currentUser') || localStorage.getItem('verity_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const [currentScreen, setCurrentScreen] = useState(() => getInitialAppScreen(isAdminApp));

  const [activeClassroom, setActiveClassroom] = useState(() => {
    try {
      const savedClass = localStorage.getItem('activeClassroom');
      return savedClass ? JSON.parse(savedClass) : null;
    } catch (e) {
      console.warn('Failed to parse activeClassroom from localStorage', e);
      return null;
    }
  });

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

  useEffect(() => {
    localStorage.setItem('currentScreen', currentScreen);
  }, [currentScreen]);

  useEffect(() => {
    const activeUser = currentUser || resolveUser();
    const roleLower = String(activeUser?.role || '').toLowerCase();
    if (isAdminApp) {
      if (roleLower === 'admin') {
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

  useEffect(() => {
    if (currentScreen === 'login' || currentScreen === 'admin_login' || !currentUser) {
      setNavigationStack([]);
      try { sessionStorage.removeItem('verity_nav_stack'); } catch {}
    }
  }, [currentScreen, currentUser]);

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
      const activeUser = currentUser || resolveUser();
      const roleLower = String(activeUser?.role || '').toLowerCase();
      if (roleLower === 'teacher' || roleLower === 'instructor') {
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

      const activeUser = currentUser || resolveUser();
      const defaultFallback = fallbackScreen || getDefaultFallbackScreen(currentScreen, activeUser?.role, proctoringReturnScreen, workspaceReturnScreen);
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
      const activeUser = currentUser || resolveUser();
      if (currentScreen === 'student_workspace' && (activeAssignment?.disableBack || activeAssignment?.disable_back)) {
        const cId = activeClassroom?.id != null ? String(activeClassroom.id) : (activeAssignment?.classroom_id || 'none');
        const aId = activeAssignment?.id != null ? String(activeAssignment.id) : 'none';
        const sId = activeUser?.id != null ? String(activeUser.id) : (activeUser?.email || activeUser?.name || 'none');
        const sKeys = [
          `verity_sub_${cId}_${aId}_${sId}`,
          `verity_sub_${cId}_${aId}_${activeUser?.name}`,
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

  return {
    currentScreen,
    setCurrentScreen,
    activeClassroom,
    setActiveClassroom,
    activeAssignment,
    setActiveAssignment,
    selectedStudentForPlayback,
    setSelectedStudentForPlayback,
    proctoringReturnScreen,
    proctoringMode,
    setProctoringMode,
    workspaceReturnScreen,
    navigateTo,
    handleBack
  };
}
