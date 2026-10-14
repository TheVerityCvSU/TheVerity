import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import ProfileMenu from './ProfileMenu';
import { 
  Calendar, ClipboardList, Settings, Bell, MessageSquare, FileText, PlayCircle, MoreVertical, ArrowLeft, X, Link2, 
  Menu, Home, Archive, Info, Users, BookOpen, ChevronRight, CheckCircle2, TerminalSquare, Plus, Code2, Award, Clock, ArrowUpRight, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import Skeleton from '../components/Skeleton';
import { useDarkMode } from '../hooks/useDarkMode';
import { useSidebarNav } from '../hooks/useSidebarNav';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { THEME_PRESETS, getClassroomTheme, saveClassroomTheme, getClassroomStorageKey, getCachedClassrooms, saveCachedClassrooms, sortClassroomsAlphabetically } from '../utils/classroomUtils';
import ImagePreviewModal from '../components/ImagePreviewModal';
import VideoPreviewModal from '../components/VideoPreviewModal';
import IframePreviewModal from '../components/IframePreviewModal';
import AddStudentModal from '../components/AddStudentModal';
import VideoAttachment from '../components/VideoAttachment';
import AttachmentCard from '../components/AttachmentCard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatShortDate = (value) => {
  if (!value) return '';
  let d;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, day] = value.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(value);
  }
  if (isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

const isLegacyHardcoded = (item) => (item?.id === 1 || item?.id === 2) && (item?.title?.startsWith('Activity 1:') || item?.title?.startsWith('Activity 2:'));

const getStorageKey = (user) => getClassroomStorageKey(user, 'student');

const TAB_ORDER = { stream: 0, classwork: 1, people: 2 };

const tabSlideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { type: 'spring', stiffness: 350, damping: 30 },
      opacity: { duration: 0.18 },
    },
  },
  exit: (direction) => ({
    x: direction > 0 ? -50 : 50,
    opacity: 0,
    transition: {
      duration: 0.12,
      ease: 'easeIn',
    },
  }),
};

const classroomSlideVariants = {
  enter: (direction) => ({
    y: direction > 0 ? 35 : -35,
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
    transition: {
      y: { type: 'spring', stiffness: 350, damping: 30 },
      opacity: { duration: 0.18 },
    },
  },
  exit: (direction) => ({
    y: direction > 0 ? -35 : 35,
    opacity: 0,
    transition: {
      duration: 0.12,
      ease: 'easeIn',
    },
  }),
};



export default function ClassroomView({
  classroom,
  currentUser,
  onBack,
  onOpenAssignment,
  onStartAssignment,
  socket,
  onEnterClassroom,
  onNavigateView,
  onLogout
}) {
  const { isDark } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const styles = getStyles(isDark, isMobile);
  const textColor = isDark ? '#f8f9fa' : '#1e293b';
  const textMuted = isDark ? '#a3a3a3' : '#64748b';
  const cardBg = isDark ? '#262626' : '#ffffff';
  const bgColor = isDark ? '#1a1a1a' : '#f8f9fa';

  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [previewIframe, setPreviewIframe] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleExit = (action) => {
    setIsFadingOut(true);
    setTimeout(() => action(), 250);
  };
  const isPhantom = (c) => !c || !c.name || (/^Classroom \d+$/i.test(String(c.name).trim()) && (!c.section || !String(c.section).trim()) && (!c.subject || !String(c.subject).trim()));

  const [classrooms, setClassrooms] = useState(() => {
    return sortClassroomsAlphabetically(getCachedClassrooms(currentUser, 'student').filter(c => !isPhantom(c)));
  });

  useEffect(() => {
    const sync = () => {
      const cached = sortClassroomsAlphabetically(getCachedClassrooms(currentUser, 'student').filter(c => !isPhantom(c)));
      setClassrooms(cached);
    };
    sync();

    // Also fetch the student's enrolled classrooms from the server
    apiFetch(`${import.meta.env.VITE_API_URL}/classrooms`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        const list = sortClassroomsAlphabetically((Array.isArray(data) ? data : (data.classrooms || [])).filter(c => !isPhantom(c)));
        if (list.length > 0) {
          setClassrooms(list);
          saveCachedClassrooms(list, currentUser, 'student');
        }
      })
      .catch(() => {});

    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [currentUser]);

  const { collapsed, toggleSidebar, sidebarProps, isPinned } = useSidebarNav();
  const navRefs = useRef({});
  const enrolledRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState(() => {
    try {
      const savedTop = sessionStorage.getItem('verity_nav_indicator_top');
      const savedHeight = sessionStorage.getItem('verity_nav_indicator_height');
      if (savedTop !== null && !isNaN(Number(savedTop))) {
        return {
          top: Number(savedTop),
          height: savedHeight ? Number(savedHeight) : 42,
          opacity: 1,
          transition: true
        };
      }
    } catch { /* ignore */ }
    return { top: 0, height: 42, opacity: 0, transition: false };
  });

  useLayoutEffect(() => {
    const update = () => {
      let activeRef = null;
      if (classroom) {
        activeRef = enrolledRefs.current['cls_' + classroom.id];
      }
      if (!activeRef) {
        activeRef = navRefs.current['classrooms'];
      }

      if (activeRef) {
        try {
          sessionStorage.setItem('verity_nav_indicator_top', String(activeRef.offsetTop));
          sessionStorage.setItem('verity_nav_indicator_height', String(activeRef.offsetHeight));
        } catch { /* ignore */ }

        setIndicatorStyle(prev => {
          const distance = Math.abs(activeRef.offsetTop - prev.top);
          const bounceOvershoot = distance > 0 ? Math.min(0.42, Math.max(0.03, 16 / distance)) : 0;
          const bounceRatio = (1 + bounceOvershoot).toFixed(3);
          const duration = distance > 150 ? '0.46s' : '0.38s';
          const transitionStr = `top ${duration} cubic-bezier(0.34, ${bounceRatio}, 0.64, 1), height 0.25s ease, opacity 0.2s ease`;

          if (prev.top === activeRef.offsetTop && prev.height === activeRef.offsetHeight && prev.opacity === 1 && prev.transition === transitionStr) return prev;
          return { top: activeRef.offsetTop, height: activeRef.offsetHeight, opacity: 1, transition: transitionStr };
        });
      } else {
        setIndicatorStyle(prev => prev.opacity === 0 ? prev : { ...prev, opacity: 0 });
      }
    };

    update();
    const timer = setTimeout(update, 20);
    return () => clearTimeout(timer);
  }, [classroom, collapsed]);

  // Active Tab: strictly 'stream' | 'classwork' | 'people' (no 'grades' for students)
  const [activeTab, setActiveTab] = useState('stream');
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [tabDirection, setTabDirection] = useState(1);
  const [transitionMode, setTransitionMode] = useState('tab');
  const prevClassroomIdRef = useRef(classroom?.id);

  useEffect(() => {
    if (classroom?.id && prevClassroomIdRef.current !== classroom?.id) {
      prevClassroomIdRef.current = classroom?.id;
      setTransitionMode('classroom');
    }
  }, [classroom?.id]);

  const [headerIndicatorStyle, setHeaderIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const headerNavRefs = useRef({});

  useLayoutEffect(() => {
    // Top header always highlights "classrooms" since we're in ClassroomView
    const activeRef = headerNavRefs.current['classrooms'];
    if (activeRef) {
      setHeaderIndicatorStyle(prev => ({
        left: activeRef.offsetLeft,
        width: activeRef.offsetWidth,
        opacity: 1,
        transition: prev.opacity === 0 ? 'none' : 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
      }));
    }
  }, [isHeaderHovered]);

  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    const currentIdx = TAB_ORDER[activeTab] ?? 0;
    const newIdx = TAB_ORDER[newTab] ?? 0;
    setTabDirection(newIdx >= currentIdx ? 1 : -1);
    setTransitionMode('tab');
    setActiveTab(newTab);
  };

  // Banner Theme synced with instructor setting
  const [bannerTheme, setBannerTheme] = useState(() => getClassroomTheme(classroom));

  // Reset banner theme when classroom changes
  useEffect(() => {
    setBannerTheme(getClassroomTheme(classroom));
  }, [classroom?.id, classroom?.code, classroom?.section, classroom?.name, classroom?.theme]);

  useEffect(() => {
    const handleUpdate = (e) => {
      const detail = e.detail;
      if (!detail) return;
      const matches =
        (classroom?.id != null && String(detail.classroomId) === String(classroom.id)) ||
        (classroom?.code && detail.code && String(detail.code).toLowerCase() === String(classroom.code).toLowerCase()) ||
        (classroom?.section && detail.code && String(detail.code).toLowerCase() === String(classroom.section).toLowerCase()) ||
        (classroom?.name && detail.name && String(detail.name).toLowerCase() === String(classroom.name).toLowerCase()) ||
        (detail.keys && detail.keys.includes(`verity_classroom_theme_${classroom?.id}`));

      if (matches && detail.theme) {
        setBannerTheme(detail.theme);
        // Persist locally in student storage so tab switching doesn't revert
        saveClassroomTheme(classroom, detail.theme, null);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setBannerTheme(getClassroomTheme(classroom));
      }
    };

    window.addEventListener('verity:banner-updated', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibility);
    if (socket) {
      socket.on('classroom_theme_changed', (data) => handleUpdate({ detail: data }));
    }

    return () => {
      window.removeEventListener('verity:banner-updated', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (socket) {
        socket.off('classroom_theme_changed');
      }
    };
  }, [classroom?.id, classroom?.code, classroom?.section, classroom?.name, classroom?.theme, socket]);

  // Modal for class details
  const [isClassInfoModalOpen, setIsClassInfoModalOpen] = useState(false);


  // Classwork & Assignments state
  const [expandedId, setExpandedId] = useState(null);
  const [expandedInstructionId, setExpandedInstructionId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const visibleClasswork = assignments.filter(item => item.activityType !== 'Material');
  const visibleMaterials = assignments.filter(item => item.activityType === 'Material');

  // Track seen materials to notify student of new uploads
  const seenMaterialsKey = `verity_seen_materials_${classroom?.id ?? 'default'}_${currentUser?.email || currentUser?.id || 'anon'}`;
  const [seenMaterialIds, setSeenMaterialIds] = useState(() => {
    try {
      const saved = localStorage.getItem(seenMaterialsKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(seenMaterialsKey);
      setSeenMaterialIds(saved ? JSON.parse(saved) : []);
    } catch {
      setSeenMaterialIds([]);
    }
  }, [seenMaterialsKey]);

  const unseenMaterials = useMemo(() => {
    return visibleMaterials.filter(m => !seenMaterialIds.includes(m.id));
  }, [visibleMaterials, seenMaterialIds]);

  const hasUnseenMaterials = unseenMaterials.length > 0;

  const markMaterialsAsSeen = () => {
    try {
      const allIds = visibleMaterials.map(m => m.id);
      setSeenMaterialIds(allIds);
      localStorage.setItem(seenMaterialsKey, JSON.stringify(allIds));
    } catch {}
  };

  const handleOpenMaterials = () => {
    markMaterialsAsSeen();
    handleTabChange('materials');
  };

  useEffect(() => {
    if (activeTab === 'materials' && visibleMaterials.length > 0 && hasUnseenMaterials) {
      markMaterialsAsSeen();
    }
  }, [activeTab, visibleMaterials.length, hasUnseenMaterials]);

  useEffect(() => {
    const classroomId = classroom?.id ?? 'default';
    const storageKey = `verity_classwork_${classroomId}`;

    const applyList = (list) => {
      if (Array.isArray(list)) {
        setAssignments(list.filter(item => !item.archived && !isLegacyHardcoded(item)));
      } else {
        setAssignments([]);
      }
    };

    const loadFromLocal = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        applyList(saved ? JSON.parse(saved) : []);
      } catch {
        setAssignments([]);
      }
    };

    let cancelled = false;
    apiFetch(`${import.meta.env.VITE_API_URL}/classwork/${classroomId}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data.classwork) && data.classwork.length > 0) {
          applyList(data.classwork);
        } else {
          loadFromLocal();
        }
      })
      .catch(() => { if (!cancelled) loadFromLocal(); })
      .finally(() => { if (!cancelled) setLoadingAssignments(false); });

    const onClassworkChanged = (payload) => {
      if (String(payload?.classroomId) === String(classroomId) && Array.isArray(payload?.classwork)) {
        applyList(payload.classwork);
        try {
          localStorage.setItem(storageKey, JSON.stringify(payload.classwork));
        } catch (e) { }
      }
    };
    if (socket) socket.on('classwork_changed', onClassworkChanged);

    const onStorage = (e) => { if (e.key === storageKey) loadFromLocal(); };
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      if (socket) socket.off('classwork_changed', onClassworkChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [classroom, socket]);

  // Track submission status for all assignments
  const [submittedTasks, setSubmittedTasks] = useState({});

  useEffect(() => {
    const safeUsername = currentUser?.name || currentUser?.email || 'Student';
    const studentId = currentUser?.email || currentUser?.name || 'student';
    const classroomId = classroom?.id ?? 'default';

    const checkAllSubs = () => {
      const map = {};
      assignments.forEach(task => {
        const keys = [
          `verity_sub_${classroomId}_${task.id}_${studentId}`,
          `verity_sub_${classroomId}_${task.id}_${safeUsername}`,
          currentUser?.name ? `verity_sub_${classroomId}_${task.id}_${currentUser.name}` : null,
          currentUser?.email ? `verity_sub_${classroomId}_${task.id}_${currentUser.email}` : null,
          currentUser?.id ? `verity_sub_${classroomId}_${task.id}_id_${currentUser.id}` : null
        ].filter(Boolean);

        if (keys.some(k => { try { return !!localStorage.getItem(k); } catch { return false; } })) {
          map[task.id] = true;
        }
      });
      setSubmittedTasks(map);
    };

    checkAllSubs();

    assignments.forEach(task => {
      apiFetch(`${import.meta.env.VITE_API_URL}/submissions/${task.id}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data?.submissions)) {
            const targetEmail = (currentUser?.email || '').toLowerCase();
            const hasSub = data.submissions.some(s => {
              const sName = (s.student_name || s.studentName || '').toLowerCase();
              const sId = (s.student_id || s.studentId || '').toLowerCase();
              const targetName = safeUsername.toLowerCase();
              const targetId = studentId.toLowerCase();
              return sName === targetName || sName === targetId || sName === targetEmail ||
                     (sId && (sId === targetName || sId === targetId || sId === targetEmail));
            });
            if (hasSub) {
              setSubmittedTasks(prev => ({ ...prev, [task.id]: true }));
            }
          }
        })
        .catch(() => {});
    });

    const onStorage = () => checkAllSubs();
    window.addEventListener('storage', onStorage);

    const onSubChange = () => checkAllSubs();
    if (socket) {
      socket.on('student_unsubmitted', onSubChange);
      socket.on('teacher_receive_submission', onSubChange);
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      if (socket) {
        socket.off('student_unsubmitted', onSubChange);
        socket.off('teacher_receive_submission', onSubChange);
      }
    };
  }, [assignments, classroom?.id, currentUser, socket]);

  // People Tab: Enrolled students & Instructor info
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [refreshStudentsKey, setRefreshStudentsKey] = useState(0);
  const [instructorInfo, setInstructorInfo] = useState({
    name: classroom?.instructor || '',
    email: classroom?.instructorEmail || ''
  });
  
  const [allowManageStudents, setAllowManageStudents] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`)
      .then(res => res.json())
      .then(d => {
        if (!active) return;
        const config = d.settings?.global_config || d.settings || {};
        if (config.roles && typeof config.roles.allowManageStudents !== 'undefined') {
          setAllowManageStudents(config.roles.allowManageStudents);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!classroom?.id) return;
    setLoadingStudents(true);

    const loadStudents = async () => {
      const studentsMap = {};

      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL}/classroom-students/${classroom.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.instructor) {
            setInstructorInfo({
              name: data.instructor.name || classroom?.instructor || 'Instructor',
              email: data.instructor.email || classroom?.instructorEmail || '',
              avatar: data.instructor.avatar || null
            });
          }
          if (Array.isArray(data.students)) {
            data.students.forEach(s => {
              if (s && s.name) {
                studentsMap[s.name.toLowerCase()] = { 
                  name: s.name, 
                  email: s.email || `${s.name.toLowerCase().replace(/\s+/g, '.')}@student.verity.edu`,
                  avatar: s.avatar || null
                };
              }
            });
          }
        }
      } catch {}

      // Local explicit enrollments fallback/sync
      try {
        const localKey = `verity_classroom_enrollments_${classroom.id}`;
        const rawLocal = localStorage.getItem(localKey);
        if (rawLocal) {
          const arr = JSON.parse(rawLocal);
          if (Array.isArray(arr)) {
            arr.forEach(s => {
              if (s && s.name) {
                studentsMap[s.name.toLowerCase()] = {
                  name: s.name,
                  email: s.email || `${s.name.toLowerCase().replace(/\s+/g, '.')}@student.verity.edu`,
                  avatar: s.avatar || studentsMap[s.name.toLowerCase()]?.avatar || null
                };
              }
            });
          }
        }
      } catch {}

      // If current user is a Student in this classroom, ensure they appear in the roster and server enrollments
      if (currentUser?.role === 'Student' && currentUser?.name) {
        studentsMap[currentUser.name.toLowerCase()] = {
          name: currentUser.name,
          email: currentUser.email || `${currentUser.name.toLowerCase().replace(/\s+/g, '.')}@student.verity.edu`,
          avatar: currentUser.avatar || currentUser.profilePicture || null
        };
        apiFetch(`${import.meta.env.VITE_API_URL}/classrooms/${classroom.id}/enroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: currentUser.name,
            studentEmail: currentUser.email || ''
          })
        }).catch(() => {});
      }

      const sortedStudents = Object.values(studentsMap).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
      );
      setEnrolledStudents(sortedStudents);
      setLoadingStudents(false);
    };

    loadStudents();

    const handleAvatarBroadcast = (data) => {
      if (!data) return;
      setInstructorInfo(prev => {
        if (prev && (
          (data.email && prev.email && data.email.toLowerCase() === prev.email.toLowerCase()) ||
          (data.name && prev.name && data.name.toLowerCase() === prev.name.toLowerCase())
        )) {
          return { ...prev, avatar: data.avatar };
        }
        return prev;
      });

      setEnrolledStudents(prev => prev.map(s => {
        if (
          (data.email && s.email && data.email.toLowerCase() === s.email.toLowerCase()) ||
          (data.name && s.name && data.name.toLowerCase() === s.name.toLowerCase())
        ) {
          return { ...s, avatar: data.avatar };
        }
        return s;
      }));
    };

    if (socket) {
      socket.on('user_avatar_updated', handleAvatarBroadcast);
    }

    return () => {
      if (socket) {
        socket.off('user_avatar_updated', handleAvatarBroadcast);
      }
    };
  }, [classroom?.id, classroom?.section, classroom?.instructor, classroom?.instructorEmail, currentUser, socket, refreshStudentsKey]);

  // To Do items for left column in Stream (unsubmitted classwork)
  const upcomingItems = assignments
    .filter(item => !submittedTasks[item.id])
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.posted || 0) - new Date(a.posted || 0);
    });

  // SVG Illustration for Google Classroom Banner
  const renderBannerIllustration = () => {
    if (bannerTheme.id === 'ocean_academia') {
      return (
        <svg viewBox="0 0 400 240" fill="none" style={{ position: 'absolute', right: 0, top: 0, height: '100%', pointerEvents: 'none' }}>
          <circle cx="280" cy="120" r="140" fill="#0d47a1" opacity="0.4" />
          <path d="M220 180 L280 60 L340 180" stroke="#60a5fa" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="280" cy="60" r="12" fill="#93c5fd" />
          <path d="M235 150 L325 150" stroke="#93c5fd" strokeWidth="4" />
          <rect x="180" y="80" width="80" height="90" rx="8" fill="#1e3a8a" transform="rotate(-15 180 80)" />
          <line x1="190" y1="100" x2="245" y2="90" stroke="#60a5fa" strokeWidth="3" />
          <line x1="195" y1="120" x2="250" y2="110" stroke="#60a5fa" strokeWidth="3" />
        </svg>
      );
    }

    if (bannerTheme.id === 'royal_violet') {
      return (
        <svg viewBox="0 0 400 240" fill="none" style={{ position: 'absolute', right: 0, top: 0, height: '100%', pointerEvents: 'none' }}>
          <circle cx="300" cy="120" r="150" fill="#581c87" opacity="0.4" />
          <path d="M230 160 C210 100, 350 70, 340 170 C330 200, 250 200, 230 160 Z" fill="#9333ea" />
          <circle cx="260" cy="140" r="8" fill="#f43f5e" />
          <circle cx="280" cy="115" r="8" fill="#38bdf8" />
          <circle cx="310" cy="130" r="8" fill="#facc15" />
          <rect x="200" y="50" width="16" height="130" rx="6" fill="#c084fc" transform="rotate(35 200 50)" />
        </svg>
      );
    }

    if (bannerTheme.id === 'warm_amber') {
      return (
        <svg viewBox="0 0 400 240" fill="none" style={{ position: 'absolute', right: 0, top: 0, height: '100%', pointerEvents: 'none' }}>
          <circle cx="300" cy="120" r="140" fill="#9a3412" opacity="0.4" />
          <rect x="220" y="70" width="100" height="120" rx="10" fill="#f97316" transform="rotate(-12 220 70)" />
          <rect x="240" y="90" width="95" height="115" rx="10" fill="#fed7aa" transform="rotate(15 240 90)" />
          <path d="M220 180 Q270 120 330 70" stroke="#ffedd5" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    }

    if (bannerTheme.id === 'midnight_slate') {
      return (
        <svg viewBox="0 0 400 240" fill="none" style={{ position: 'absolute', right: 0, top: 0, height: '100%', pointerEvents: 'none' }}>
          <circle cx="290" cy="120" r="140" fill="#1e293b" opacity="0.6" />
          <rect x="210" y="60" width="150" height="100" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="3" />
          <circle cx="225" cy="74" r="3" fill="#ef4444" />
          <circle cx="235" cy="74" r="3" fill="#eab308" />
          <circle cx="245" cy="74" r="3" fill="#22c55e" />
          <path d="M235 110 L250 125 L235 140" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="260" y1="140" x2="280" y2="140" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    }

    // Default: Emerald Books
    return (
      <svg viewBox="0 0 420 240" fill="none" style={{ position: 'absolute', right: 0, top: 0, height: '100%', pointerEvents: 'none' }}>
        <circle cx="310" cy="120" r="150" fill="#0d5d28" opacity="0.45" />

        <g transform="translate(230, 40) rotate(-28)">
          <rect x="-10" y="-10" width="130" height="150" rx="10" fill="#0f5132" />
          <rect x="0" y="0" width="115" height="135" rx="6" fill="#c6f6d5" />
          <line x1="15" y1="25" x2="100" y2="25" stroke="#9ae6b4" strokeWidth="2.5" />
          <line x1="15" y1="45" x2="100" y2="45" stroke="#9ae6b4" strokeWidth="2.5" />
          <line x1="15" y1="65" x2="100" y2="65" stroke="#9ae6b4" strokeWidth="2.5" />
          <line x1="15" y1="85" x2="100" y2="85" stroke="#9ae6b4" strokeWidth="2.5" />
          <line x1="15" y1="105" x2="100" y2="105" stroke="#9ae6b4" strokeWidth="2.5" />
          <path d="M55 0 L55 90 L62 82 L70 90 L70 0 Z" fill="#fb923c" />
        </g>

        <g transform="translate(270, 75) rotate(14)">
          <rect x="-8" y="-8" width="140" height="145" rx="10" fill="#1e293b" />
          <rect x="0" y="0" width="128" height="132" rx="6" fill="#f8fafc" />
          <line x1="15" y1="25" x2="110" y2="25" stroke="#e2e8f0" strokeWidth="2.5" />
          <line x1="15" y1="45" x2="110" y2="45" stroke="#e2e8f0" strokeWidth="2.5" />
          <line x1="15" y1="65" x2="110" y2="65" stroke="#e2e8f0" strokeWidth="2.5" />
          <line x1="15" y1="85" x2="110" y2="85" stroke="#e2e8f0" strokeWidth="2.5" />
          <line x1="15" y1="105" x2="110" y2="105" stroke="#e2e8f0" strokeWidth="2.5" />

          <path d="M90 0 L90 75 L98 68 L106 75 L106 0 Z" fill="#ef4444" />

          <g transform="translate(-15, 30) rotate(-42)">
            <rect x="0" y="0" width="140" height="24" rx="4" fill="#f43f5e" />
            {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130].map(x => (
              <line key={x} x1={x} y1="0" x2={x} y2={x % 20 === 0 ? "10" : "6"} stroke="white" strokeWidth="1.5" />
            ))}
          </g>
        </g>
      </svg>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: isFadingOut ? 0 : 1 }} 
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{ minHeight: '100vh', backgroundColor: bgColor, fontFamily: '"Inter", "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column', color: textColor }}
    >
      <header 
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px clamp(20px, 3vw, 48px)',
        backgroundColor: bgColor,
        borderBottom: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Smooth gradient transition at the bottom of the header */}
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: 0,
          right: 0,
          height: '30px',
          background: `linear-gradient(to bottom, ${bgColor}, transparent)`,
          pointerEvents: 'none'
        }} />
        <div style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }} onClick={() => handleExit(() => onNavigateView ? onNavigateView('classrooms') : onBack())}>
          <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
          <span style={{ color: textColor, fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
          <span style={{ fontSize: '0.7rem', color: textMuted, marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</span>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '8px',
          opacity: isHeaderHovered ? 1 : 0,
          pointerEvents: isHeaderHovered ? 'auto' : 'none',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          transform: isHeaderHovered ? 'translateY(0)' : 'translateY(-10px)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            left: headerIndicatorStyle.left,
            width: headerIndicatorStyle.width,
            top: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '50px',
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 4px 16px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.35)',
            transition: headerIndicatorStyle.transition || 'none',
            opacity: headerIndicatorStyle.opacity,
            pointerEvents: 'none',
            zIndex: 0,
          }} />

          {[
            { id: 'classrooms', label: 'Home', Icon: Home },
            { id: 'calendar', label: 'Calendar', Icon: Calendar },
            { id: 'archived', label: 'Archived', Icon: Archive },
            { id: 'compiler', label: 'Compiler', Icon: Code2 }
          ].map(item => {
            const active = item.id === 'classrooms';
            return (
              <button
                key={item.id}
                ref={el => headerNavRefs.current[item.id] = el}
                onClick={() => handleExit(() => onNavigateView && onNavigateView(item.id === 'stream' ? 'classrooms' : item.id))}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '50px',
                  background: 'transparent',
                  border: '1px solid transparent',
                  color: active ? '#10b981' : textMuted,
                  fontWeight: active ? '700' : '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <item.Icon size={18} />
                {item.label}
              </button>
            );
          })}

          <button onClick={() => onNavigateView && onNavigateView('settings')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: '50px', backgroundColor: 'transparent', color: textMuted, border: 'none', cursor: 'pointer', marginLeft: '8px' }}>
            <Settings size={20} />
            <span style={{ marginLeft: '8px', fontWeight: '600', fontSize: '0.9rem' }}>Settings</span>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: '16px' }}>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 20px',
            borderRadius: '50px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
            opacity: isHeaderHovered ? 1 : 0,
            pointerEvents: isHeaderHovered ? 'auto' : 'none',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            transform: isHeaderHovered ? 'translateY(0)' : 'translateY(-10px)'
          }}>
            <Plus size={18} /> Add course
          </button>
          <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
        </div>
      </header>

      <main style={{ flex: 1, padding: '24px clamp(20px, 3vw, 48px)', maxWidth: '100%', margin: 0, width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
        
        {/* HERO BANNER */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '280px',
          borderRadius: '24px',
          overflow: 'hidden',
          marginBottom: '32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to right, rgba(15, 23, 42, 1) 0%, rgba(15, 23, 42, 0.85) 30%, rgba(15, 23, 42, 0.3) 60%, transparent 100%), url(${bannerTheme.customImageUrl || bannerTheme.image || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80'}) center/cover no-repeat`,
            zIndex: 0
          }} />
          
          {/* Top row */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', padding: '24px 32px' }}>
            <button onClick={() => onNavigateView ? onNavigateView('classrooms') : onBack()} style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}>
              <ArrowLeft size={18} /> All courses
            </button>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', backdropFilter: 'blur(8px)', cursor: 'pointer' }}>
                <Bell size={18} />
              </div>
              <div style={{ padding: '8px 16px', borderRadius: '50px', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.85rem', fontWeight: '500', backdropFilter: 'blur(8px)' }}>
                Class code <span style={{ fontWeight: 'bold', marginLeft: '6px' }}>{classroom?.code || 'CS101'}</span>
              </div>
            </div>
          </div>

          {/* Middle row */}
          <div style={{ position: 'relative', zIndex: 1, padding: '0 32px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
               <div style={{ backgroundColor: '#dcfce7', color: '#065f46', padding: '4px 12px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 'bold' }}>{classroom?.code || 'CS101'}</div>
               <span style={{ color: 'white', fontSize: '0.9rem' }}>{classroom?.section || 'Section A'}</span>
             </div>
             <h1 style={{ color: 'white', fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>{classroom?.name || 'C# Programming'}</h1>
          </div>

          {/* Bottom row */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '32px', padding: '0 32px', backgroundColor: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', paddingTop: '16px' }}>
            {['Overview', 'Classwork', 'Materials'].map(tab => {
               const isActive = (activeTab === tab.toLowerCase() || (activeTab === 'stream' && tab === 'Overview'));
               return (
               <button key={tab} onClick={() => handleTabChange(tab === 'Overview' ? 'stream' : tab.toLowerCase())} style={{ background: 'none', border: 'none', color: isActive ? 'white' : 'rgba(255,255,255,0.7)', fontSize: '0.95rem', fontWeight: '600', paddingBottom: '16px', borderBottom: isActive ? '3px solid #10b981' : '3px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
                 {tab}
               </button>
               );
            })}
          </div>
        </div>

        {/* MAIN GRID */}
        <AnimatePresence mode="wait" custom={transitionMode === 'classroom' ? 1 : tabDirection}>
          <motion.div
            key={`${classroom?.id || 'cls'}_${activeTab}`}
            custom={transitionMode === 'classroom' ? 1 : tabDirection}
            variants={transitionMode === 'classroom' ? classroomSlideVariants : tabSlideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ width: '100%' }}
          >
        {activeTab === 'stream' && (
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
           {/* LEFT COLUMN */}
           <div style={{ flex: '1 1 65%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
             
             {/* Announcements removed */}

             {/* To Do (Unsubmitted Work) */}
             <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                 <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                   <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>To Do</h2>
                   <span style={{ fontSize: '0.85rem', color: textMuted }}>{upcomingItems.length} item{upcomingItems.length !== 1 && 's'}</span>
                 </div>
                 <button onClick={() => handleTabChange('classwork')} style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   View all <ChevronRight size={16} />
                 </button>
               </div>
               
               <div 
                 className="hide-scroll"
                 style={{ 
                   display: 'flex', 
                   gap: '16px', 
                   overflowX: 'auto', 
                   paddingBottom: '12px',
                   scrollSnapType: 'x mandatory',
                   scrollbarWidth: 'none',
                   msOverflowStyle: 'none'
                 }}>
                 <style dangerouslySetInnerHTML={{__html: `
                   .hide-scroll::-webkit-scrollbar { display: none; }
                 `}} />
                 {upcomingItems.length === 0 ? (
                   <div style={{ padding: '20px', color: textMuted, fontSize: '0.9rem', fontStyle: 'italic', width: '100%' }}>
                     No pending work at this time.
                   </div>
                 ) : (
                   upcomingItems.map(item => (
                     <div key={item.id} onClick={() => { setExpandedId(item.id); handleTabChange('classwork'); }} style={{ 
                       flex: '0 0 calc(33.333% - 11px)', 
                       minWidth: '220px',
                       scrollSnapAlign: 'start',
                       backgroundColor: cardBg, 
                       borderRadius: '16px', 
                       padding: '20px', 
                       border: isDark ? '1px solid #333' : '1px solid #e5e7eb', 
                       cursor: 'pointer', 
                       transition: 'all 0.2s', 
                       ...isDark ? {} : { boxShadow: '0 2px 8px rgba(0,0,0,0.04)' } 
                     }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                         <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                           <ClipboardList size={16} />
                         </div>
                         <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: textMuted }}>
                           {item.dueDate ? formatShortDate(item.dueDate) : 'No due date'}
                         </span>
                       </div>
                       <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#10b981', letterSpacing: '0.05em', marginBottom: '4px' }}>ASSIGNMENT</div>
                       <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                       <div style={{ fontSize: '0.8rem', color: textMuted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                         {item.details ? item.details.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ') : 'No instructions provided.'}
                       </div>
                     </div>
                   ))
                 )}
               </div>
             </div>

             {/* Learning Materials */}
             <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                 <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                   <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Learning materials</h2>
                   <span style={{ fontSize: '0.85rem', color: textMuted }}>Module 4</span>
                 </div>
                 <button style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   Open library <ChevronRight size={16} />
                 </button>
               </div>
               
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                 {/* Mat 1 */}
                 <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px 20px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
                     <FileText size={20} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '2px' }}>Methods quick guide</div>
                     <div style={{ fontSize: '0.75rem', color: textMuted }}>PDF · 6 pages</div>
                   </div>
                   <ChevronRight size={18} color={textMuted} />
                 </div>
                 
                 {/* Mat 2 */}
                 <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px 20px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', flexShrink: 0 }}>
                     <TerminalSquare size={20} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '2px' }}>Practice sandbox</div>
                     <div style={{ fontSize: '0.75rem', color: textMuted }}>Interactive editor</div>
                   </div>
                   <ChevronRight size={18} color={textMuted} />
                 </div>

                 {/* Mat 3 */}
                 <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px 20px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', flexShrink: 0 }}>
                     <PlayCircle size={20} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '2px' }}>Parameter patterns</div>
                     <div style={{ fontSize: '0.75rem', color: textMuted }}>Video · 12 min</div>
                   </div>
                   <ChevronRight size={18} color={textMuted} />
                 </div>
               </div>
             </div>
             
           </div>

           {/* RIGHT COLUMN */}
           <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
             
             {/* Main Right Card */}
             <div style={{ backgroundColor: cardBg, borderRadius: '24px', padding: '24px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '24px' }}>
               
               {/* Teacher Info */}
               <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                 <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#059669', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                   KF
                 </div>
                 <div>
                   <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#10b981', letterSpacing: '0.05em', textTransform: 'uppercase' }}>YOUR TEACHER</div>
                   <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{classroom?.instructor || 'Kim Fabie'}</div>
                   <div style={{ fontSize: '0.75rem', color: textMuted }}>Offline 24 hours ago</div>
                 </div>
               </div>

               {/* Course Materials Notification Card (Replaced Class Discussion) */}
               <div style={{ backgroundColor: isDark ? '#1e293b' : '#0f172a', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                   <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: hasUnseenMaterials ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hasUnseenMaterials ? '#fbbf24' : '#38bdf8', flexShrink: 0 }}>
                     <FileText size={20} />
                   </div>
                   <div style={{ minWidth: 0 }}>
                     <div style={{ fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                       {hasUnseenMaterials ? 'You have unseen materials.' : 'Course materials'}
                     </div>
                     <div style={{ fontSize: '0.75rem', color: hasUnseenMaterials ? '#fcd34d' : 'rgba(255,255,255,0.7)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                       {hasUnseenMaterials 
                         ? `${unseenMaterials.length} new material${unseenMaterials.length > 1 ? 's' : ''} uploaded` 
                         : visibleMaterials.length > 0
                           ? `${visibleMaterials.length} resource${visibleMaterials.length > 1 ? 's' : ''} available`
                           : 'No new materials uploaded'}
                     </div>
                   </div>
                 </div>
                 <button 
                   onClick={handleOpenMaterials}
                   style={{ backgroundColor: hasUnseenMaterials ? '#f59e0b' : 'rgba(255,255,255,0.15)', border: 'none', color: hasUnseenMaterials ? '#0f172a' : 'white', padding: '6px 14px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0, marginLeft: '8px', transition: 'all 0.2s' }}
                 >
                   Open
                 </button>
               </div>
               
             </div>

           </div>
        </div>
        )}
        
        {/* ═══ TAB 2: CLASSWORK ═══ */}

              {activeTab === 'classwork' && (
                <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
                  <div style={styles.headerRow}>
                    <div>
                      <h2 style={{ color: isDark ? '#f5f5f5' : '#1e293b', fontWeight: '700', fontSize: '1.4rem', margin: 0 }}>
                        List of Classworks
                      </h2>
                      <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
                        Access assignments, instructions, and learning activities for this class.
                      </p>
                    </div>
                  </div>

                  {/* List of Classwork */}
                  <div style={styles.list}>
                    {loadingAssignments ? (
                      Array.from({ length: 3 }).map((_, i) => <Skeleton.AssignmentRow key={i} />)
                    ) : visibleClasswork.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: isDark ? '#a3a3a3' : '#94a3b8' }}>
                        <BookOpen size={48} color={isDark ? '#404040' : '#cbd5e1'} style={{ margin: '0 auto 12px auto', display: 'block' }} />
                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: isDark ? '#f5f5f5' : 'inherit' }}>No classwork assigned yet</p>
                        <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: isDark ? '#737373' : 'inherit' }}>Check back later once your instructor assigns new activities.</p>
                      </div>
                    ) : (
                      visibleClasswork.map((item) => {
                        const isOpen = expandedId === item.id;
                        const due = formatShortDate(item.dueDate);
                        const posted = formatShortDate(item.posted || (typeof item.id === 'number' && item.id > 1e12 ? item.id : null));
                        const isSubmitted = submittedTasks[item.id];

                        return (
                          <div key={item.id} style={styles.itemWrapper}>
                            {/* Collapsed Pill */}
                            <div style={styles.itemHeader}>
                              <div
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '14px 20px',
                                  borderRadius: '12px',
                                  backgroundColor: isDark ? (isOpen ? '#242a2b' : '#1e2324') : (isOpen ? '#f1f5f9' : '#f8fafc'),
                                  border: isDark ? (isOpen ? '1px solid #444c4f' : '1px solid #2d3335') : (isOpen ? '1px solid #cbd5e1' : '1px solid #e2e8f0'),
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  transition: 'all 0.2s ease',
                                  position: 'relative',
                                  overflow: 'hidden'
                                }}
                                onClick={() => setExpandedId(prev => (prev === item.id ? null : item.id))}
                                onMouseOver={(e) => {
                                  if (isDark && !isOpen) {
                                    e.currentTarget.style.backgroundColor = '#242a2b';
                                    e.currentTarget.style.borderColor = '#383e40';
                                  }
                                }}
                                onMouseOut={(e) => {
                                  if (isDark && !isOpen) {
                                    e.currentTarget.style.backgroundColor = '#1e2324';
                                    e.currentTarget.style.borderColor = '#2d3335';
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {/* Icon Container */}
                                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#dcfce7', border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginRight: '16px', flexShrink: 0 }}>
                                    <ClipboardList size={18} />
                                  </div>
                                  
                                  <span style={{ color: isDark ? '#f5f5f5' : '#1e293b', fontSize: '1.05rem', fontWeight: '700' }}>{item.title}</span>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                  {isSubmitted ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isDark ? '#a7f3d0' : '#059669', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5', padding: '5px 12px', borderRadius: '8px', fontWeight: '600' }}>
                                      <CheckCircle2 size={12} /> Turned in
                                    </span>
                                  ) : due ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isDark ? '#a7f3d0' : '#059669', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5', padding: '5px 12px', borderRadius: '8px', fontWeight: '600' }}>
                                      <Calendar size={12} /> Due {due}
                                    </span>
                                  ) : null}
                                  
                                  {/* Vertical Divider */}
                                  <div style={{ width: '1px', height: '24px', backgroundColor: isDark ? '#3d4447' : '#e2e8f0' }} />
                                  
                                  {/* Arrow Icon */}
                                  <div style={{ color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease', marginRight: '20px' }}>
                                    <ArrowUpRight size={18} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Expanded Detail View */}
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  key="detail"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.22, ease: 'easeOut' }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  <div style={{ ...styles.detailCard, display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
                                    
                                    {/* Left Main Content */}
                                    <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column' }}>
                                      
                                      {/* Header with Icon and Title */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                                          <ClipboardList size={28} />
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: isDark ? '#f5f5f5' : '#1e293b', lineHeight: 1.2, wordBreak: 'break-word' }}>
                                          {item.title}
                                        </div>
                                      </div>

                                      {/* Metadata Grid (Due Date, Points, Posted) */}
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px', marginBottom: '32px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <Calendar size={14} /> Due Date
                                          </div>
                                          <div style={{ fontSize: '0.95rem', color: isDark ? '#E8EAED' : '#334155', fontWeight: '500' }}>
                                            {due ? `Due ${due}` : 'No Due Date'}
                                          </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <Award size={14} /> Points
                                          </div>
                                          <div style={{ fontSize: '0.95rem', color: isDark ? '#E8EAED' : '#334155', fontWeight: '500' }}>
                                            {item.points || 100} points
                                          </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <Clock size={14} /> Posted
                                          </div>
                                          <div style={{ fontSize: '0.95rem', color: isDark ? '#E8EAED' : '#334155', fontWeight: '500' }}>
                                            {posted ? `Posted ${posted}` : 'Recently'}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Instructions */}
                                      <div style={{ marginBottom: '32px' }}>
                                        {item.details ? (
                                          <div 
                                            style={{ 
                                              ...styles.detailInstruction, 
                                              whiteSpace: 'normal',
                                              display: '-webkit-box',
                                              WebkitLineClamp: 5,
                                              WebkitBoxOrient: 'vertical',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis'
                                            }}
                                          >
                                            {item.details.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ')}
                                          </div>
                                        ) : (
                                          <p style={styles.detailInstruction}>No instructions provided.</p>
                                        )}

                                        {item.attachments?.length > 0 && (
                                          <div style={styles.cardAttachments}>
                                            {item.attachments.map((att, i) => (
                                              <AttachmentCard
                                                key={i}
                                                att={att}
                                                isDark={isDark}
                                                onClick={(clickedAtt) => {
                                                  if (clickedAtt.type === 'image') setPreviewImage(clickedAtt);
                                                  else if (clickedAtt.type === 'video') setPreviewVideo(clickedAtt);
                                                  else if (clickedAtt.type === 'document') setPreviewIframe(clickedAtt);
                                                  else if (clickedAtt.type === 'link' && clickedAtt.url) setPreviewIframe(clickedAtt);
                                                }}
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Spacer to push footer down if needed */}
                                      <div style={{ flexGrow: 1 }} />
                                      
                                      {/* Divider */}
                                      <div style={{ height: '1px', backgroundColor: isDark ? '#3E3E3E' : '#e2e8f0', marginBottom: '20px' }} />

                                      {/* View Activity Link */}
                                      <div>
                                        <span
                                          style={{ ...styles.viewActivityLink, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                          onClick={() => onOpenAssignment(item)}
                                        >
                                          View Activity Details <ArrowUpRight size={16} />
                                        </span>
                                      </div>
                                    </div>

                                    {/* Right Status / Action Content */}
                                    <div style={{ width: isMobile ? '100%' : '280px', flexShrink: 0, borderLeft: isMobile ? 'none' : (isDark ? '1px solid #3E3E3E' : '1px solid #e2e8f0'), borderTop: isMobile ? (isDark ? '1px solid #3E3E3E' : '1px solid #e2e8f0') : 'none', backgroundColor: isDark ? '#222728' : '#f8fafc', padding: '32px', display: 'flex', flexDirection: 'column' }}>
                                      
                                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: isDark ? '#a3a3a3' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                                        Your Work
                                      </div>
                                      
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'auto' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isSubmitted ? '#10b981' : '#10b981' }} />
                                        <span style={{
                                          fontSize: '1.4rem',
                                          fontWeight: '800',
                                          color: isDark ? '#f5f5f5' : '#1e293b'
                                        }}>
                                          {isSubmitted ? 'Turned in' : 'Assigned'}
                                        </span>
                                      </div>
                                      
                                      <div style={{ marginTop: '48px' }}>
                                        {!isSubmitted && (
                                          <button
                                            onClick={() => {
                                              if (onStartAssignment) {
                                                onStartAssignment(item);
                                              } else {
                                                onOpenAssignment(item);
                                              }
                                            }}
                                            style={{
                                              width: '100%',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              padding: '14px 20px',
                                              backgroundColor: '#34d399',
                                              border: 'none',
                                              borderRadius: '12px',
                                              color: '#064e3b',
                                              fontWeight: '700',
                                              fontSize: '1rem',
                                              cursor: 'pointer',
                                              boxShadow: '0 4px 6px rgba(52, 211, 153, 0.2)',
                                              transition: 'background-color 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#34d399'}
                                          >
                                            Start <ArrowRight size={18} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ═══ TAB: MATERIALS ═══ */}
              {activeTab === 'materials' && (
                <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0', paddingBottom: '18px', marginBottom: '24px' }}>
                    <div>
                      <h2 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontWeight: '700', fontSize: '1.4rem' }}>
                        List of Materials
                      </h2>
                      <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
                        Access syllabus, study guides, and resources uploaded by your instructor.
                      </p>
                    </div>
                  </div>
                  <div style={{ ...styles.list, padding: '0 0 40px 0' }}>
                    {loadingAssignments ? (
                      Array.from({ length: 3 }).map((_, i) => <Skeleton.AssignmentRow key={i} />)
                    ) : visibleMaterials.length === 0 ? (
                      <div style={{ padding: '40px 0', textAlign: 'center', color: isDark ? '#a3a3a3' : '#94a3b8' }}>
                        <div style={{ marginBottom: '16px' }}>
                          <FileText size={48} color={isDark ? '#525252' : '#94a3b8'} style={{ margin: '0 auto' }} />
                        </div>
                        <p style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '600', color: isDark ? '#e5e5e5' : '#334155' }}>No materials available</p>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>Check back later once your instructor uploads course resources.</p>
                      </div>
                    ) : (
                      visibleMaterials.map((item) => {
                        const isOpen = expandedId === item.id;
                        const posted = formatShortDate(item.posted || (typeof item.id === 'number' && item.id > 1e12 ? item.id : null));
                        return (
                          <div key={item.id} style={styles.itemWrapper}>
                            <div style={styles.itemHeader}>
                              <div
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '14px 20px',
                                  borderRadius: '12px',
                                  backgroundColor: isDark ? (isOpen ? '#242a2b' : '#1e2324') : (isOpen ? '#f1f5f9' : '#f8fafc'),
                                  border: isDark ? (isOpen ? '1px solid #444c4f' : '1px solid #2d3335') : (isOpen ? '1px solid #cbd5e1' : '1px solid #e2e8f0'),
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  transition: 'all 0.2s ease',
                                  position: 'relative',
                                  overflow: 'hidden'
                                }}
                                onClick={() => setExpandedId(prev => (prev === item.id ? null : item.id))}
                                onMouseOver={(e) => {
                                  if (isDark && !isOpen) {
                                    e.currentTarget.style.backgroundColor = '#242a2b';
                                    e.currentTarget.style.borderColor = '#383e40';
                                  }
                                }}
                                onMouseOut={(e) => {
                                  if (isDark && !isOpen) {
                                    e.currentTarget.style.backgroundColor = '#1e2324';
                                    e.currentTarget.style.borderColor = '#2d3335';
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {/* Icon Container */}
                                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#dcfce7', border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginRight: '16px', flexShrink: 0 }}>
                                    <FileText size={18} />
                                  </div>
                                  
                                  <span style={{ color: isDark ? '#f5f5f5' : '#1e293b', fontSize: '1.05rem', fontWeight: '700' }}>{item.title}</span>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                  {posted ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isDark ? '#a7f3d0' : '#059669', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5', padding: '5px 12px', borderRadius: '8px', fontWeight: '600' }}>
                                      Posted {posted}
                                    </span>
                                  ) : null}
                                  
                                  {/* Vertical Divider */}
                                  <div style={{ width: '1px', height: '24px', backgroundColor: isDark ? '#3d4447' : '#e2e8f0' }} />
                                  
                                  {/* Arrow Icon */}
                                  <div style={{ color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease', marginRight: '20px' }}>
                                    <ArrowUpRight size={18} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  key="detail"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.22, ease: 'easeOut' }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  <div style={styles.detailCard}>
                                    <div style={styles.detailHeaderBar}>
                                      <FileText size={30} color={isDark ? '#10b981' : '#4b5563'} />
                                      <div>
                                        <div style={styles.detailTitle}>{item.title}</div>
                                      </div>
                                    </div>

                                    <div style={styles.detailBody}>
                                      <div style={{ ...styles.detailLeft, flex: '1 1 100%' }}>
                                        {posted && <div style={styles.postedText}>Posted {posted}</div>}
                                      {item.details ? (
                                        <>
                                          <div 
                                            style={{ 
                                              ...styles.detailInstruction, 
                                              whiteSpace: 'normal',
                                              ...(expandedInstructionId === item.id ? {} : {
                                                display: '-webkit-box',
                                                WebkitLineClamp: 3,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                              })
                                            }}
                                          >
                                            {expandedInstructionId === item.id 
                                              ? <div dangerouslySetInnerHTML={{ __html: item.details }} />
                                              : item.details.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ')
                                            }
                                          </div>
                                          {expandedInstructionId !== item.id && item.details.replace(/<[^>]*>?/gm, '').length > 100 && (
                                            <div 
                                              style={{ color: '#10b981', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '6px' }}
                                              onClick={(e) => { e.stopPropagation(); setExpandedInstructionId(item.id); }}
                                            >
                                              View details...
                                            </div>
                                          )}
                                          {expandedInstructionId === item.id && (
                                            <div 
                                              style={{ color: '#10b981', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '6px' }}
                                              onClick={(e) => { e.stopPropagation(); setExpandedInstructionId(null); }}
                                            >
                                              Show less
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <p style={styles.detailInstruction}>No instructions provided.</p>
                                      )}

                                        {item.attachments?.length > 0 && (
                                          <div style={styles.cardAttachments}>
                                            {item.attachments.map((att, i) => (
                                              <AttachmentCard
                                                key={i}
                                                att={att}
                                                isDark={isDark}
                                                onClick={(clickedAtt) => {
                                                  if (clickedAtt.type === 'image') setPreviewImage(clickedAtt);
                                                  else if (clickedAtt.type === 'video') setPreviewVideo(clickedAtt);
                                                  else if (clickedAtt.type === 'document') setPreviewIframe(clickedAtt);
                                                  else if (clickedAtt.type === 'link' && clickedAtt.url) setPreviewIframe(clickedAtt);
                                                }}
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
          </motion.div>
        </AnimatePresence>


      </main>

      {/* ═══ MODAL: CLASS INFO MODAL ═══ */}
      {isClassInfoModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsClassInfoModalOpen(false)}>
          <div style={styles.infoModalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: isDark ? '#f5f5f5' : '#1e293b' }}>
                Class Details
              </h3>
              <button
                onClick={() => setIsClassInfoModalOpen(false)}
                style={styles.closeBtn}
              >
                <X size={20} color={isDark ? '#a3a3a3' : '#64748b'} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div>
                <label style={styles.infoFieldLabel}>Subject / Course</label>
                <div style={styles.infoFieldValue}>{classroom?.subject || classroom?.name || 'General Studies'}</div>
              </div>
              <div>
                <label style={styles.infoFieldLabel}>Section</label>
                <div style={styles.infoFieldValue}>{classroom?.section || 'Section 1'}</div>
              </div>
              <div>
                <label style={styles.infoFieldLabel}>Instructor</label>
                <div style={styles.infoFieldValue}>{classroom?.instructor || 'Instructor'}</div>
              </div>
              <div>
                <label style={styles.infoFieldLabel}>Room / Campus</label>
                <div style={styles.infoFieldValue}>{classroom?.room || 'Online Virtual Lab'}</div>
              </div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsClassInfoModalOpen(false)}
                style={styles.infoCloseActionBtn}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <ImagePreviewModal
          src={previewImage.url}
          alt={previewImage.name}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {previewVideo && (
        <VideoPreviewModal
          src={previewVideo.url}
          name={previewVideo.name}
          onClose={() => setPreviewVideo(null)}
        />
      )}

      {previewIframe && (
        <IframePreviewModal
          url={previewIframe.url}
          title={previewIframe.name}
          type={previewIframe.type}
          onClose={() => setPreviewIframe(null)}
        />
      )}

      <AddStudentModal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        classroomId={classroom?.id}
        classCode={classroom?.code}
        onSuccess={() => setRefreshStudentsKey(k => k + 1)}
        isDark={isDark}
      />

      {/* MOBILE BOTTOM NAVIGATION */}
      {isMobile && (
        <nav style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          backgroundColor: isDark ? '#262626' : '#ffffff',
          borderTop: isDark ? '1px solid #3f3f46' : '1px solid #e5e7eb',
          height: '65px',
          flexShrink: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 60
        }}>
          {[
            { id: 'classrooms', Icon: Home, label: 'Home', action: () => handleExit(() => { if (onNavigateView) onNavigateView('classrooms'); else onBack(); }) },
            { id: 'calendar', Icon: Calendar, label: 'Calendar', action: () => handleExit(() => { if (onNavigateView) onNavigateView('calendar'); else onBack(); }) },
            { id: 'compiler', Icon: Code2, label: 'Compiler', action: () => handleExit(() => { if (onNavigateView) onNavigateView('compiler'); else onBack(); }) },
            { id: 'archived', Icon: Archive, label: 'Archived', action: () => handleExit(() => { if (onNavigateView) onNavigateView('archived'); else onBack(); }) }
          ].map(({ id, Icon, label, action }) => {
            return (
              <button
                key={id}
                onClick={action}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#a3a3a3' : '#64748b',
                  cursor: 'pointer',
                  padding: '8px',
                  minWidth: '64px'
                }}
              >
                <Icon size={22} style={{ marginBottom: '4px' }} />
                <span style={{ fontSize: '0.65rem', fontWeight: '500' }}>{label}</span>
              </button>
            );
          })}
        </nav>
      )}

    </motion.div>
  );
}

// STYLES matching TeacherClasswork design system
const getStyles = (isDark, isMobile = false) => ({
  container: { 
    height: '100vh', 
    minHeight: '100vh', 
    width: '100%', 
    display: 'flex', 
    flexDirection: 'column', 
    backgroundColor: isDark ? '#3C3C3C' : '#EEF0F3', 
    fontFamily: 'Arial, Helvetica, sans-serif', 
    position: 'relative', 
    overflow: 'hidden',
    transition: 'background-color 0.25s ease'
  },
  header: {
    height: isMobile ? '60px' : '72px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isMobile ? '0 16px' : '0 24px',
    backgroundColor: isDark ? '#3C3C3C' : '#EEF0F3',
    borderBottom: 'none',
    zIndex: 50,
    transition: 'background-color 0.25s ease'
  },
  badge: { 
    fontSize: '0.7rem', 
    backgroundColor: isDark ? '#4A4A4A' : '#EEF0F3', 
    color: isDark ? '#E8EAED' : '#475569', 
    padding: '3px 8px', 
    borderRadius: '10px', 
    marginLeft: '6px', 
    fontStyle: 'normal', 
    transform: 'translateY(-5px)', 
    border: isDark ? '1px solid #5A5A5A' : '1px solid #cbd5e1' 
  },
  sidebar: (collapsed) => ({
    width: collapsed ? '84px' : '240px',
    minWidth: collapsed ? '84px' : '240px',
    padding: '20px 14px 20px',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
    background: 'transparent',
    overflowY: 'auto',
    overflowX: 'hidden'
  }),
  sidebarBtn: (collapsed) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '16px',
    padding: '10px 18px',
    width: '100%',
    height: '42px',
    borderRadius: '14px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    position: 'relative',
    zIndex: 1
  }),
  sidebarBtnText: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: isDark ? '#E8EAED' : '#334155',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  mainContent: {
    flex: 1,
    padding: isMobile ? '10px 16px 16px' : '20px 24px 24px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden'
  },
  bigBoxContainer: {
    backgroundColor: isDark ? '#323232' : '#ffffff',
    flex: 1,
    borderRadius: '24px',
    boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.25)' : '0 10px 25px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
    border: isDark ? '1px solid #4A4A4A' : 'none',
    transition: 'background-color 0.25s ease, border-color 0.25s ease'
  },
  classroomNavHeader: {
    height: '56px',
    padding: '0 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#323232' : '#ffffff',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    flexShrink: 0,
    zIndex: 10
  },
  classroomTabsGroup: {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    gap: '8px'
  },
  classroomTabBtn: {
    background: 'none',
    border: 'none',
    height: '100%',
    padding: '0 18px',
    fontSize: '0.94rem',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s ease, border-bottom 0.2s ease'
  },
  bigBoxInnerScroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '24px 28px 32px 28px'
  },
  streamContainer: {
    maxWidth: '960px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  bannerCard: {
    height: '240px',
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '24px 28px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
  },
  bannerInfo: {
    position: 'relative',
    zIndex: 5
  },
  bannerTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: '2.4rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)'
  },
  bannerSubtitle: {
    margin: '4px 0 0 0',
    color: 'rgba(255,255,255,0.92)',
    fontSize: '1.25rem',
    fontWeight: '600',
    textShadow: '0 1px 3px rgba(0,0,0,0.2)'
  },
  infoBtn: {
    position: 'absolute',
    bottom: '18px',
    right: '20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    zIndex: 10,
    opacity: 0.85,
    transition: 'opacity 0.2s'
  },
  streamBodyGrid: {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: '24px',
    alignItems: 'flex-start'
  },
  streamLeftCol: {
    width: isMobile ? '100%' : '210px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  streamRightCol: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  streamSideCard: {
    backgroundColor: isDark ? '#383838' : '#ffffff',
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    padding: '16px',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.02)'
  },
  sideCardLabel: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: isDark ? '#E8EAED' : '#1e293b'
  },
  noWorkText: {
    fontSize: '0.82rem',
    color: isDark ? '#a3a3a3' : '#64748b'
  },
  upcomingItemRow: {
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer'
  },
  upcomingItemDate: {
    fontSize: '0.72rem',
    color: '#10b981',
    fontWeight: '700'
  },
  upcomingItemTitle: {
    fontSize: '0.82rem',
    color: isDark ? '#E8EAED' : '#1e293b',
    fontWeight: '600',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  viewAllLink: {
    fontSize: '0.82rem',
    fontWeight: '700',
    color: '#10b981',
    cursor: 'pointer'
  },
  streamFeedCard: {
    backgroundColor: isDark ? '#383838' : '#ffffff',
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    padding: '18px 20px',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.02)'
  },
  teacherAvatarSmall: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    fontWeight: '800',
    flexShrink: 0
  },
  
  assignmentStreamCard: {
    backgroundColor: isDark ? '#383838' : '#ffffff',
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.02)'
  },
  assignmentIconBadge: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: isDark ? '#1c2d24' : '#e6f4ea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  assignmentStreamTitle: {
    fontSize: '0.92rem',
    fontWeight: '700',
    color: isDark ? '#E8EAED' : '#1f2937'
  },
  assignmentStreamDate: {
    fontSize: '0.78rem',
    color: isDark ? '#a3a3a3' : '#64748b',
    marginTop: '3px'
  },
  turnedInBadge: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: isDark ? '#1c2d24' : '#ecfdf5',
    color: '#10b981',
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '4px 10px',
    borderRadius: '20px'
  },
  emptyFeedBox: {
    padding: '32px 20px',
    borderRadius: '12px',
    border: isDark ? '1px dashed #404040' : '1px dashed #cbd5e1',
    textAlign: 'center'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 0 20px 0',
    borderBottom: isDark ? '1px solid #2e2e2e' : '1px solid #e2e8f0',
    marginBottom: '24px'
  },
  list: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '16px' 
  },
  itemWrapper: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '8px' 
  },
  itemHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  titlePill: { 
    width: '100%',
    display: 'flex', 
    alignItems: 'center', 
    padding: '12px 20px', 
    borderRadius: '12px', 
    color: isDark ? '#E8EAED' : '#1e293b', 
    fontWeight: '700', 
    cursor: 'pointer', 
    userSelect: 'none', 
    transition: 'all 0.15s' 
  },
  turnedInPill: {
    backgroundColor: isDark ? '#1c2d24' : '#ecfdf5',
    color: '#10b981',
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '6px'
  },
  itemDuePill: { 
    fontSize: '0.75rem', 
    color: isDark ? '#a3a3a3' : '#64748b', 
    fontWeight: '600' 
  },
  detailCard: { 
    backgroundColor: isDark ? '#2E2E2E' : 'white', 
    borderRadius: '16px', 
    padding: '0', 
    border: isDark ? '1px solid #484848' : '1px solid #e2e8f0', 
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.04)', 
    overflow: 'hidden' 
  },
  detailHeaderBar: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '18px', 
    backgroundColor: isDark ? '#262626' : '#f8fafc', 
    padding: '18px 24px', 
    borderRadius: '12px', 
    margin: '12px', 
    border: isDark ? '1px solid #444444' : '1px solid #e2e8f0' 
  },
  detailTitle: { 
    fontSize: '1.25rem', 
    fontWeight: 'bold', 
    color: isDark ? '#E8EAED' : '#1e293b' 
  },
  detailDue: { 
    fontSize: '0.85rem', 
    color: isDark ? '#a3a3a3' : '#64748b', 
    marginTop: '2px' 
  },
  detailBody: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    gap: '20px', 
    padding: '5px 28px 20px 28px' 
  },
  detailLeft: { 
    flex: 1 
  },
  postedText: { 
    fontSize: '0.8rem', 
    color: isDark ? '#737373' : '#94a3b8', 
    marginBottom: '8px' 
  },
  detailInstruction: { 
    margin: 0, 
    color: isDark ? '#E8EAED' : '#334155', 
    fontSize: '0.98rem', 
    lineHeight: 1.5 
  },
  cardAttachments: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', 
    gap: '12px', 
    marginTop: '15px', 
    width: '100%'
  },
  attachThumb: { 
    maxWidth: '240px', 
    maxHeight: '160px', 
    borderRadius: '8px', 
    objectFit: 'cover', 
    display: 'block',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0'
  },
  attachVideo: { 
    maxWidth: '380px', 
    maxHeight: '220px', 
    width: '100%',
    borderRadius: '8px', 
    backgroundColor: '#000' 
  },
  attachLink: { 
    display: 'inline-flex', 
    alignItems: 'center', 
    gap: '8px',
    color: isDark ? '#34d399' : '#059669', 
    backgroundColor: isDark ? '#3A3A3A' : '#f8fafc',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '8px 14px',
    textDecoration: 'none', 
    fontSize: '0.88rem', 
    fontWeight: '500',
    maxWidth: '100%',
    wordBreak: 'break-all',
    boxSizing: 'border-box'
  },
  detailStudentStatusBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    backgroundColor: isDark ? '#262626' : '#f8fafc',
    border: isDark ? '1px solid #444444' : '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px 18px',
    minWidth: '100px'
  },
  detailDivider: { 
    height: '1px', 
    backgroundColor: isDark ? '#444444' : '#e2e8f0', 
    margin: '0 28px' 
  },
  detailFooter: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '16px 28px' 
  },
  viewActivityLink: { 
    color: '#10b981', 
    fontSize: '0.92rem', 
    cursor: 'pointer', 
    fontWeight: '700' 
  },
  startBtn: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '6px', 
    padding: '9px 28px', 
    backgroundColor: '#10b981', 
    border: 'none', 
    borderRadius: '50px', 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: '0.9rem', 
    cursor: 'pointer', 
    boxShadow: '0 4px 6px rgba(16,185,129,0.2)' 
  },
  peopleSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: '2px solid #10b981',
    marginBottom: '16px'
  },
  peopleSectionTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: '800',
    color: isDark ? '#E8EAED' : '#1e293b'
  },
  peopleList: {
    display: 'flex',
    flexDirection: 'column'
  },
  peopleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 14px',
    borderBottom: isDark ? '1px solid #282828' : '1px solid #f1f5f9'
  },
  peopleAvatarGreen: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95rem',
    fontWeight: '800'
  },
  peopleAvatarBlue: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95rem',
    fontWeight: '800'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(3px)'
  },
  infoModalContent: {
    backgroundColor: isDark ? '#222222' : '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    width: '90%',
    maxWidth: '440px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4)',
    border: isDark ? '1px solid #383838' : 'none',
    color: isDark ? '#E8EAED' : 'inherit'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    color: isDark ? '#a3a3a3' : '#64748b'
  },
  infoFieldLabel: {
    fontSize: '0.78rem',
    fontWeight: '700',
    color: isDark ? '#a3a3a3' : '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  infoFieldValue: {
    fontSize: '1rem',
    fontWeight: '600',
    color: isDark ? '#E8EAED' : '#1e293b',
    marginTop: '3px'
  },
  infoCloseActionBtn: {
    padding: '8px 22px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer'
  }
});