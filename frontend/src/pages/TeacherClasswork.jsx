import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import JoditEditor from 'jodit-react';
import ProfileMenu from './ProfileMenu';
import ClassroomSettings from './ClassroomSettings';
import { 
  Calendar, ClipboardList, Settings, User, MoreVertical, ArrowLeft, X, Link2, 
  Image, Video, Monitor, Menu, Home, Archive, Edit3, Maximize2, Copy, Check, 
  Info, Users, BookOpen, Sparkles, Plus, Send, ChevronRight, ChevronDown, CheckCircle2, 
  MessageSquare, PlayCircle, Eye, RefreshCw, Palette, ExternalLink, FileText,
  Paperclip, MoreHorizontal, Code2, Trash2, AlertTriangle, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import Skeleton from '../components/Skeleton';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { isPhantomClassroom, mergeClassroomsPreservingOrder, THEME_PRESETS, getClassroomTheme, saveClassroomTheme, getClassroomStorageKey, getCachedClassrooms, saveCachedClassrooms, sortClassroomsAlphabetically, getLessonType } from '../utils/classroomUtils';
import ImagePreviewModal from '../components/ImagePreviewModal';
import AddLinkModal from '../components/AddLinkModal';
import VideoPreviewModal from '../components/VideoPreviewModal';
import IframePreviewModal from '../components/IframePreviewModal';
import AddStudentModal from '../components/AddStudentModal';
import VideoAttachment from '../components/VideoAttachment';
import AttachmentCard from '../components/AttachmentCard';
import { getStudentGrade, isStudentGraded, formatGradeScore } from '../utils/gradeUtils';
import { formatShortDate } from '../utils/dateUtils';
import ClassroomBannerIllustration from '../components/ClassroomBannerIllustration';

const EMPTY_FORM = { title: '', activityType: 'Activity', noDueDate: true, dueDate: '', instruction: '', points: '100', grading: 'On', attachments: [], duration: 60, autoSaveInterval: '30s', treatWarningsAsErrors: false, disableBack: false, testCases: [] };

const isLegacyHardcoded = (item) => (item?.id === 1 || item?.id === 2) && (item?.title?.startsWith('Activity 1:') || item?.title?.startsWith('Activity 2:'));

const TAB_ORDER = { stream: 0, classwork: 1, materials: 2, people: 3, grades: 4 };

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



export default function TeacherClasswork({ 
  classroom, 
  onBack, 
  onLogout, 
  onStartMonitoring, 
  onOpenGrading, 
  onOpenPlayback,
  socket, 
  onEnterClassroom, 
  onNavigateView,
  currentUser 
}) {
  const { isDark } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const styles = getStyles(isDark);
  const isPhantom = isPhantomClassroom;

  const [classrooms, setClassrooms] = useState(() => {
    return sortClassroomsAlphabetically(getCachedClassrooms(currentUser, 'teacher').filter(c => !isPhantomClassroom(c)));
  });

  useEffect(() => {
    apiFetch(`${import.meta.env.VITE_API_URL}/classrooms`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        const serverList = (Array.isArray(data) ? data : (data.classrooms || [])).filter(c => !isPhantomClassroom(c));
        if (serverList.length === 0) {
          const cached = getCachedClassrooms(currentUser, 'teacher').filter(c => !isPhantomClassroom(c));
          if (cached.length > 0) return;
        }
        const teacherClasses = serverList.filter(c => {
          const emailStr = (c.instructor_email || c.instructorEmail || '').toLowerCase();
          const matchesEmail = Boolean(currentUser?.email && emailStr && emailStr === currentUser.email.toLowerCase());
          const nameStr = (c.instructor || '').trim().toLowerCase();
          const curName = (currentUser?.name || '').trim().toLowerCase();
          const matchesName = Boolean(curName && nameStr && nameStr === curName);
          return matchesEmail || matchesName || (!emailStr && !nameStr);
        });
        const sortedTeacherClasses = sortClassroomsAlphabetically(teacherClasses);
        if (sortedTeacherClasses.length > 0) {
          setClassrooms(sortedTeacherClasses);
          saveCachedClassrooms(sortedTeacherClasses, currentUser, 'teacher');
        }
      })
      .catch(() => {});
  }, [currentUser]);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const handleExit = (action) => {
    setIsFadingOut(true);
    setTimeout(() => action(), 100);
  };
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, left: 0, width: 0, opacity: 0, transition: 'none' });
  const navRefs = useRef({});

  // Active classroom tab
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const perClassTab = sessionStorage.getItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`);
      if (perClassTab && TAB_ORDER[perClassTab] !== undefined) return perClassTab;
      const activeTabGlobal = sessionStorage.getItem('verity_teacher_classwork_tab_active');
      if (activeTabGlobal && TAB_ORDER[activeTabGlobal] !== undefined) return activeTabGlobal;
      return 'stream';
    } catch {
      return 'stream';
    }
  });
  const [tabDirection, setTabDirection] = useState(1);
  const [transitionMode, setTransitionMode] = useState('tab'); // 'classroom' | 'tab'
  const [classroomDirection, setClassroomDirection] = useState(1);
  const prevClassroomIdRef = useRef(classroom?.id);

  useEffect(() => {
    if (classroom?.id && prevClassroomIdRef.current !== classroom?.id) {
      prevClassroomIdRef.current = classroom?.id;
      setTransitionMode('classroom');
      try {
        const savedTab = sessionStorage.getItem(`verity_teacher_classwork_tab_${classroom.id}`) ||
                         sessionStorage.getItem('verity_teacher_classwork_tab_active');
        if (savedTab && TAB_ORDER[savedTab] !== undefined) {
          setActiveTab(savedTab);
        }
      } catch {}
    }
  }, [classroom?.id]);

  useEffect(() => {
    try {
      if (activeTab) {
        sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, activeTab);
        sessionStorage.setItem('verity_teacher_classwork_tab_active', activeTab);
      }
    } catch {}
  }, [activeTab, classroom?.id]);

  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    const currentIdx = TAB_ORDER[activeTab] ?? 0;
    const newIdx = TAB_ORDER[newTab] ?? 0;
    setTabDirection(newIdx >= currentIdx ? 1 : -1);
    setTransitionMode('tab');
    setActiveTab(newTab);
    try {
      sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, newTab);
      sessionStorage.setItem('verity_teacher_classwork_tab_active', newTab);
    } catch {}
  };

  const handleSelectClassroom = (cls, idx) => {
    if (String(cls.id) === String(classroom?.id)) {
      if (activeTab !== 'stream') {
        handleTabChange('stream');
      }
      return;
    }
    const currentIdx = activeClassrooms.findIndex(c => String(c.id) === String(classroom?.id));
    const targetIdx = idx;
    const dir = (currentIdx === -1 || targetIdx >= currentIdx) ? 1 : -1;
    setClassroomDirection(dir);
    setTransitionMode('classroom');
    if (onEnterClassroom) onEnterClassroom(cls);
  };

  // Persist classwork per classroom
  const storageKey = `verity_classwork_${classroom?.id ?? 'default'}`;
  const classroomId = classroom?.id ?? 'default';

  const [classwork, setClasswork] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(item => !isLegacyHardcoded(item)) : [];
    } catch {
      return [];
    }
  });

  const hydrated = useRef(false);

  useEffect(() => {
    hydrated.current = false;
    let cancelled = false;

    const applyClassworkList = (list) => {
      if (!Array.isArray(list) || list.length === 0) return;
      const valid = list.filter(item => item && !isLegacyHardcoded(item));
      if (valid.length > 0) {
        setClasswork(prev => {
          if (!prev || prev.length === 0) return valid;
          const incomingIds = new Set(valid.map(x => String(x.id)));
          const offlineOnly = prev.filter(x => x && x.id && !incomingIds.has(String(x.id)) && !isLegacyHardcoded(x));
          return [...valid, ...offlineOnly];
        });
      }
    };

    // 1. Check local storage key for this classroom
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        applyClassworkList(parsed);
      }
    } catch {}

    // 2. Check desktop SQLite localDB cache
    if (window.electronAPI?.localDB?.getCachedClasswork) {
      window.electronAPI.localDB.getCachedClasswork(classroomId)
        .then(cached => {
          if (!cancelled) applyClassworkList(cached);
        })
        .catch(() => {});
    }

    // 3. Fallback: Check general cached classwork
    try {
      const general = localStorage.getItem('verity_cached_classwork');
      if (general) {
        const parsedGen = JSON.parse(general);
        if (Array.isArray(parsedGen)) {
          const matching = parsedGen.filter(item => String(item.classroom_id || item.classroomId) === String(classroomId));
          if (matching.length > 0) applyClassworkList(matching);
        }
      }
    } catch {}

    // 4. Fetch authoritative classwork from server
    apiFetch(`${import.meta.env.VITE_API_URL}/classwork/${classroomId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data.classwork) && data.classwork.length > 0) {
          const filtered = data.classwork.filter(item => !isLegacyHardcoded(item));
          const serverCwIds = new Set(filtered.map(item => String(item.id)));
          setClasswork(prev => {
            const offlineItems = (prev || []).filter(item => item && item.id && !serverCwIds.has(String(item.id)) && !isLegacyHardcoded(item));
            const merged = [...filtered, ...offlineItems];
            if (offlineItems.length > 0) {
              // Auto-upload offline-created items to server immediately
              apiFetch(`${import.meta.env.VITE_API_URL}/classwork/${classroomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classwork: merged })
              }).catch(() => {});
            }
            try {
              localStorage.setItem(storageKey, JSON.stringify(merged));
            } catch {}
            if (window.electronAPI?.localDB?.cacheClasswork) {
              window.electronAPI.localDB.cacheClasswork(classroomId, merged).catch(() => {});
            }
            return merged;
          });
        }
      })
      .catch(() => { /* offline or access denied — preserve existing local cache */ })
      .finally(() => { if (!cancelled) setLoadingClasswork(false); hydrated.current = true; });
    return () => { cancelled = true; };
  }, [classroomId, storageKey]);

  useEffect(() => {
    // If classwork is empty, NEVER overwrite cache with [] or sync [] to server/socket!
    if (!Array.isArray(classwork) || classwork.length === 0) {
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(classwork));
    if (hydrated.current) {
      if (socket) {
        socket.emit('classwork_updated', { classroomId, classwork });
      }
      apiFetch(`${import.meta.env.VITE_API_URL}/classwork/${classroomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classwork })
      }).catch(err => console.warn('Classwork REST sync warning:', err));
    }
  }, [classwork, storageKey, classroomId, socket]);

  useEffect(() => {
    if (!socket) return;
    const onClassworkChanged = (payload) => {
      if (String(payload?.classroomId) === String(classroomId) && Array.isArray(payload?.classwork)) {
        if (payload.classwork.length > 0) {
          const filtered = payload.classwork.filter(item => !isLegacyHardcoded(item));
          if (filtered.length > 0) {
            setClasswork(prev => {
              const serverIds = new Set(filtered.map(item => String(item.id)));
              const unuploadedLocal = (prev || []).filter(item => item && item.id && !serverIds.has(String(item.id)) && !isLegacyHardcoded(item));
              const merged = [...filtered, ...unuploadedLocal];
              try { localStorage.setItem(storageKey, JSON.stringify(merged)); } catch (_) {}
              return merged;
            });
          }
        }
      }
    };
    socket.on('classwork_changed', onClassworkChanged);
    return () => {
      socket.off('classwork_changed', onClassworkChanged);
    };
  }, [socket, classroomId, storageKey]);

  const [activeMenu, setActiveMenu] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedInstructionId, setExpandedInstructionId] = useState(null);
  const [submissionData, setSubmissionData] = useState({ counts: {}, studentCount: 0 });
  const [loadingClasswork, setLoadingClasswork] = useState(true);

  const toggleExpand = (id) => setExpandedId(prev => (prev === id ? null : id));

  useEffect(() => {
    const load = () => {
      const url = (classroomId && classroomId !== 'default')
        ? `${import.meta.env.VITE_API_URL}/submission-counts?classroomId=${classroomId}`
        : `${import.meta.env.VITE_API_URL}/submission-counts`;
      apiFetch(url)
        .then(res => res.json())
        .then(data => setSubmissionData({ counts: data.counts || {}, studentCount: data.studentCount || 0 }))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [classroomId]);

  // Real-time active students tracking per activity
  const [activeActivityCounts, setActiveActivityCounts] = useState({});

  useEffect(() => {
    const handleActiveUpdate = (data) => {
      if (data && data.counts) {
        setActiveActivityCounts(data.counts);
      }
    };

    if (socket) {
      socket.on('active_activities_update', handleActiveUpdate);
      socket.emit('get_active_activities', { classroomId: classroom?.id });
    }

    const fetchActive = () => {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/active-activities${classroom?.id ? `?classroomId=${classroom.id}` : ''}`;
      apiFetch(url)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.counts) {
            setActiveActivityCounts(data.counts);
          }
        })
        .catch(() => {});
    };

    fetchActive();
    const activeInterval = setInterval(fetchActive, 5000);

    return () => {
      if (socket) {
        socket.off('active_activities_update', handleActiveUpdate);
      }
      clearInterval(activeInterval);
    };
  }, [classroom?.id, socket]);

  // Class code & theme
  const classCode = classroom?.code || classroom?.section || (classroom?.id ? `vji${classroom.id}ku4` : 'vji3bku4');
  const [bannerTheme, setBannerTheme] = useState(() => getClassroomTheme(classroom));

  // Reset banner theme when classroom changes
  useEffect(() => {
    setBannerTheme(getClassroomTheme(classroom));
  }, [classroom?.id, classroom?.code, classroom?.section, classroom?.name, classroom?.theme]);

  // Real-time socket & window theme updates listener
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
      }
    };

    window.addEventListener('verity:banner-updated', handleUpdate);
    if (socket) {
      socket.on('classroom_theme_changed', (data) => handleUpdate({ detail: data }));
    }
    return () => {
      window.removeEventListener('verity:banner-updated', handleUpdate);
      if (socket) {
        socket.off('classroom_theme_changed');
      }
    };
  }, [classroom?.id, classroom?.code, classroom?.section, classroom?.name, classroom?.theme, socket]);

  // Modal dialog states
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isClassCodeModalOpen, setIsClassCodeModalOpen] = useState(false);
  const [isClassInfoModalOpen, setIsClassInfoModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [currentClassroom, setCurrentClassroom] = useState(classroom);
  useEffect(() => {
    if (classroom) setCurrentClassroom(classroom);
  }, [classroom]);

  const handleUpdateClassroom = async (updated) => {
    const merged = { ...(currentClassroom || classroom), ...updated };
    setCurrentClassroom(merged);
    try {
      await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/classrooms`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classrooms: [merged] })
      });
      if (socket) {
        socket.emit('classrooms_updated');
      }
    } catch (err) {
      console.error('Failed to update classroom settings:', err);
    }
  };
  const [codeCopied, setCodeCopied] = useState(false);
  
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
  const [originalBannerTheme, setOriginalBannerTheme] = useState(null);



  // Enrolled students and Instructor Info for People tab
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const sortedEnrolledStudents = useMemo(() => {
    return [...enrolledStudents].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }, [enrolledStudents]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [refreshStudentsKey, setRefreshStudentsKey] = useState(0);
  const [instructorInfo, setInstructorInfo] = useState({
    name: classroom?.instructor || (currentUser?.role === 'Teacher' ? currentUser.name : ''),
    email: classroom?.instructorEmail || classroom?.instructor_email || (currentUser?.role === 'Teacher' ? currentUser.email : ''),
    avatar: (currentUser?.role === 'Teacher' && currentUser?.avatar) ? currentUser.avatar : null
  });

  useEffect(() => {
    if (!classroom?.id) return;
    setLoadingStudents(true);

    const loadStudents = async () => {
      const studentsMap = {};

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('verity_student_classrooms_')) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const match = list.some(c => 
                  c.id === classroom.id || 
                  (c.code && c.code.toLowerCase() === classCode.toLowerCase()) ||
                  (c.section && c.section.toLowerCase() === (classroom.section || '').toLowerCase())
                );
                if (match) {
                  const studentName = k.replace('verity_student_classrooms_', '');
                  studentsMap[studentName.toLowerCase()] = { 
                    name: studentName, 
                    email: `${studentName.toLowerCase().replace(/\s+/g, '.')}@student.verity.edu`,
                    avatar: null
                  };
                }
              }
            }
          }
        }
      } catch {}

      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL}/classroom-students/${classroom.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.instructor && data.instructor.name) {
            setInstructorInfo({
              name: data.instructor.name,
              email: data.instructor.email || '',
              avatar: data.instructor.avatar || (currentUser?.role === 'Teacher' && currentUser?.avatar ? currentUser.avatar : null)
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

      // Check explicit local enrollments
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
          (data.email && s.email && data.email.toLowerCase() === data.email.toLowerCase()) ||
          (data.name && s.name && data.name.toLowerCase() === data.name.toLowerCase())
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
  }, [classroom?.id, classCode, classroom?.section, socket, currentUser, refreshStudentsKey]);

  const isMaterialItem = (item) => Boolean(item && (item.activityType === 'Material' || String(item.activityType || '').toLowerCase() === 'material' || String(item.type || '').toLowerCase() === 'material'));

  // GRADES TAB STATE (Scoped to this classroom only)
  const visibleClasswork = classwork.filter(item => !item.archived && !isMaterialItem(item));
  const visibleMaterials = classwork.filter(item => !item.archived && isMaterialItem(item));

  // STREAM FEED STATE: includes all active classwork and learning materials sorted newest first
  const visibleStreamItems = useMemo(() => {
    return classwork
      .filter(item => !item.archived)
      .sort((a, b) => {
        const timeA = new Date(a.posted || a.createdAt || (typeof a.id === 'number' && a.id > 1e12 ? a.id : 0)).getTime() || 0;
        const timeB = new Date(b.posted || b.createdAt || (typeof b.id === 'number' && b.id > 1e12 ? b.id : 0)).getTime() || 0;
        return timeB - timeA;
      });
  }, [classwork]);

  const filteredStreamItems = visibleStreamItems;
  const [selectedGradingActivityId, setSelectedGradingActivityId] = useState(() => {
    try {
      return sessionStorage.getItem(`verity_grading_activity_${classroom?.id || 'default'}`) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (selectedGradingActivityId) {
      try {
        sessionStorage.setItem(`verity_grading_activity_${classroom?.id || 'default'}`, selectedGradingActivityId);
      } catch {}
    }
  }, [selectedGradingActivityId, classroom?.id]);

  useEffect(() => {
    if (visibleClasswork.length > 0) {
      if (!selectedGradingActivityId || !visibleClasswork.some(a => a.id === selectedGradingActivityId)) {
        setSelectedGradingActivityId(visibleClasswork[0].id);
      }
    }
  }, [visibleClasswork, selectedGradingActivityId]);

  const activeGradingActivity = visibleClasswork.find(a => a.id === selectedGradingActivityId) || visibleClasswork[0];
  const gradesKey = `verity_grades_${activeGradingActivity?.id ?? 'default'}`;
  const maxPoints = parseInt(activeGradingActivity?.points, 10) || 100;

  const [gradingStudents, setGradingStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(() => {
    try {
      return sessionStorage.getItem(`verity_grading_student_${classroom?.id || 'default'}`) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (selectedStudentId) {
      try {
        sessionStorage.setItem(`verity_grading_student_${classroom?.id || 'default'}`, selectedStudentId);
      } catch {}
    }
  }, [selectedStudentId, classroom?.id]);
  const [gradingGrades, setGradingGrades] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(gradesKey)) || {};
    } catch { return {}; }
  });
  const [studentGradeInput, setStudentGradeInput] = useState(String(maxPoints));
  const [studentFeedbackInput, setStudentFeedbackInput] = useState('');
  const [indivSaveStatus, setIndivSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [indivSaveError, setIndivSaveError] = useState('');
  const [showBulkGradeModal, setShowBulkGradeModal] = useState(false);
  const [bulkGradeVal, setBulkGradeVal] = useState(String(maxPoints));
  const [bulkFeedbackVal, setBulkFeedbackVal] = useState('Great work!');
  const [bulkToastMsg, setBulkToastMsg] = useState('');

  // Load ONLY students who have submitted this activity for this classroom
  useEffect(() => {
    if (!activeGradingActivity?.id) {
      setGradingStudents([]);
      return;
    }

    const loadActivitySubs = () => {
      const aId = activeGradingActivity.id;
      apiFetch(`${import.meta.env.VITE_API_URL}/submissions/${aId}`)
        .then(res => res.json())
        .then(data => {
          const subs = Array.isArray(data?.submissions) ? data.submissions : [];
          const localSubs = [];
          const cId = classroom?.id ?? 'default';

          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && (k.startsWith(`verity_sub_${cId}_${aId}_`) || k.startsWith(`verity_sub_default_${aId}_`))) {
                const val = JSON.parse(localStorage.getItem(k));
                if (val && (val.studentName || val.studentId)) localSubs.push(val);
              }
            }
          } catch {}

          const map = {};
          subs.forEach(s => {
            const sName = s.student_name || s.studentName || 'Unknown';
            const sId = s.student_id || s.studentId || sName;
            map[sName] = {
              id: sId,
              name: sName,
              submittedAt: s.submittedAt,
              finalCode: s.finalCode,
              code: s.finalCode,
              status: 'Submitted',
              history: Array.isArray(s.history) ? s.history : Array.isArray(s.codeHistory) ? s.codeHistory : []
            };
          });
          localSubs.forEach(s => {
            const sName = s.studentName || s.studentId || 'Unknown';
            const sId = s.studentId || s.student_id || sName;
            if (!map[sName]) {
              map[sName] = {
                id: sId,
                name: sName,
                submittedAt: s.submittedAt,
                finalCode: s.finalCode,
                code: s.finalCode,
                status: 'Submitted',
                history: Array.isArray(s.codeHistory) ? s.codeHistory : Array.isArray(s.history) ? s.history : []
              };
            }
          });

          // Check persistent playback history
          Object.keys(map).forEach(key => {
            const s = map[key];
            const hKeys = [
              `verity_history_${cId}_${aId}_${s.id}`,
              `verity_history_${aId}_${s.id}`,
              `verity_history_${cId}_${aId}_${s.name}`,
              `verity_history_${aId}_${s.name}`
            ];
            for (const hk of hKeys) {
              try {
                const raw = localStorage.getItem(hk);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (Array.isArray(parsed) && parsed.length > (s.history?.length || 0)) {
                    s.history = parsed;
                  }
                }
              } catch {}
            }
          });

          const list = Object.values(map).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
          );
          setGradingStudents(list);
          setSelectedStudentId(prev => (prev && map[prev] ? prev : (list.find(s => s.id === selectedStudentId)?.id || list[0]?.id || null)));
        })
        .catch(() => {});
    };

    loadActivitySubs();

    apiFetch(`${import.meta.env.VITE_API_URL}/grades/${activeGradingActivity.id}`)
      .then(res => res.json())
      .then(data => {
        if (data?.grades) setGradingGrades(prev => ({ ...prev, ...data.grades }));
      })
      .catch(() => {});

    const onGradeUpdated = (data) => {
      if (!data || String(data.assignmentId) !== String(activeGradingActivity?.id) || !data.studentId) return;
      setGradingGrades(prev => ({
        ...prev,
        [data.studentId]: { grade: data.grade, feedback: data.feedback, gradedAt: data.gradedAt || new Date().toISOString() }
      }));
    };

    const onBulkGradesUpdated = (data) => {
      if (!data || String(data.assignmentId) !== String(activeGradingActivity?.id) || !Array.isArray(data.grades)) return;
      setGradingGrades(prev => {
        const next = { ...prev };
        data.grades.forEach(g => {
          if (g.studentId) {
            next[g.studentId] = { grade: g.grade, feedback: g.feedback, gradedAt: g.gradedAt || new Date().toISOString() };
          }
        });
        return next;
      });
    };

    const onGradeDeleted = (data) => {
      if (!data || String(data.assignmentId) !== String(activeGradingActivity?.id) || !data.studentId) return;
      const target = String(data.studentId).toLowerCase();
      setGradingGrades(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          if (k.toLowerCase() === target) delete next[k];
        });
        return next;
      });
    };

    if (socket) {
      socket.on('grade_updated', onGradeUpdated);
      socket.on('bulk_grades_updated', onBulkGradesUpdated);
      socket.on('grade_deleted', onGradeDeleted);
    }

    return () => {
      if (socket) {
        socket.off('grade_updated', onGradeUpdated);
        socket.off('bulk_grades_updated', onBulkGradesUpdated);
        socket.off('grade_deleted', onGradeDeleted);
      }
    };
  }, [activeGradingActivity?.id, classroom?.id, socket]);

  useEffect(() => {
    try {
      localStorage.setItem(gradesKey, JSON.stringify(gradingGrades));
    } catch {}
  }, [gradingGrades, gradesKey]);

  useEffect(() => {
    if (selectedStudentId) {
      const curStudent = gradingStudents.find(s => s.id === selectedStudentId);
      const saved = getStudentGrade(gradingGrades, curStudent || selectedStudentId);
      setStudentGradeInput(saved?.grade != null ? String(saved.grade) : String(maxPoints));
      setStudentFeedbackInput(saved?.feedback || '');
      setIndivSaveStatus('idle');
      setIndivSaveError('');
    }
  }, [selectedStudentId, gradingGrades, maxPoints, gradingStudents]);

  const handleSaveIndividualGrade = async () => {
    if (!selectedStudentId || !activeGradingActivity) return;
    setIndivSaveStatus('saving');
    setIndivSaveError('');
    const now = new Date().toISOString();
    const updated = {
      ...gradingGrades,
      [selectedStudentId]: { grade: studentGradeInput, feedback: studentFeedbackInput, gradedAt: now }
    };
    setGradingGrades(updated);
    try {
      localStorage.setItem(gradesKey, JSON.stringify(updated));
    } catch {}

    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL}/grades/${activeGradingActivity.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudentId, grade: studentGradeInput, feedback: studentFeedbackInput })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save grade');
      }
      setIndivSaveStatus('saved');
      setTimeout(() => setIndivSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Error saving grade:', err);
      setIndivSaveStatus('error');
      setIndivSaveError(err.message || 'Failed to save');
      setTimeout(() => setIndivSaveStatus('idle'), 3500);
    }
  };

  // BULK GRADING: Grades ONLY the students who have submitted!
  const handleApplyBulkGrade = async () => {
    if (!activeGradingActivity || gradingStudents.length === 0) return;

    const now = new Date().toISOString();
    const updated = { ...gradingGrades };
    const payload = [];

    gradingStudents.forEach(s => {
      updated[s.id] = { grade: bulkGradeVal, feedback: bulkFeedbackVal, gradedAt: now };
      payload.push({ studentId: s.id, grade: bulkGradeVal, feedback: bulkFeedbackVal });
    });

    setGradingGrades(updated);
    try {
      localStorage.setItem(gradesKey, JSON.stringify(updated));
    } catch {}

    try {
      await apiFetch(`${import.meta.env.VITE_API_URL}/grades/${activeGradingActivity.id}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades: payload })
      });
    } catch {
      payload.forEach(p => {
        apiFetch(`${import.meta.env.VITE_API_URL}/grades/${activeGradingActivity.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p)
        }).catch(() => {});
      });
    }

    setBulkToastMsg(`Successfully graded all ${gradingStudents.length} submitted student(s)!`);
    setTimeout(() => setBulkToastMsg(''), 3500);
    setShowBulkGradeModal(false);
  };

  // Classwork modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingMaterialModal, setViewingMaterialModal] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [previewIframe, setPreviewIframe] = useState(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const joditRef = useRef(null);
  const activeMarkerRef = useRef(null);

  const handleAttachmentClick = (e, callback) => {
    e.preventDefault(); // prevent focus loss
    const editorObj = joditRef.current;
    if (editorObj) {
      const s = editorObj.selection || editorObj.s || editorObj.editor?.selection || editorObj.component?.selection;
      if (s && typeof s.insertHTML === 'function') {
        const id = `verity-marker-${Date.now()}`;
        activeMarkerRef.current = id;
        try {
          // Focus the editor first, just in case
          if (editorObj.editor?.focus) editorObj.editor.focus();
          else if (editorObj.focus) editorObj.focus();
          // Use a zero-width space so Jodit doesn't strip the empty span!
          s.insertHTML(`<span id="${id}">&#8203;</span>`);
        } catch(err) {}
      }
    }
    callback();
  };

  const uploadFile = async (file, type) => {
    const filename = file.name;
    const cleanFilename = encodeURIComponent(filename);

    // 1. Direct binary streaming upload (fast, supports 100MB+ MP4/WebM/MOV)
    try {
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      const headers = { 'X-Filename': filename };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/upload-raw?filename=${cleanFilename}`, {
        method: 'POST',
        headers,
        body: file
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          return { type, name: filename, url: data.url };
        }
      }
    } catch (rawErr) {
      console.warn('Direct stream upload failed, trying base64...', rawErr);
    }

    // 2. Base64 fallback to /upload (for smaller images/clips)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, dataUrl })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          return { type, name: filename, url: data.url };
        }
      }
    } catch (b64Err) {
      console.warn('Base64 fallback failed:', b64Err);
    }

    // 3. Object URL fallback so the video is immediately playable in current session
    return { type, name: filename, url: URL.createObjectURL(file) };
  };

  const insertAtMarker = (appendHtml) => {
    const markerId = activeMarkerRef.current;
    if (!markerId) return false;
    
    let handled = false;
    try {
      const editorObj = joditRef.current;
      if (editorObj) {
         if (editorObj.editor?.focus) editorObj.editor.focus();
         else if (editorObj.focus) editorObj.focus();
         
         const doc = editorObj.editorDocument || editorObj.editor?.editorDocument || editorObj.editor?.ownerDocument || document;
         const markerNode = doc.getElementById(markerId);
         
         if (markerNode) {
            const s = editorObj.selection || editorObj.s || editorObj.editor?.selection || editorObj.component?.selection;
            if (s && typeof s.select === 'function' && typeof s.insertHTML === 'function') {
               s.select(markerNode);
               s.insertHTML(appendHtml);
               handled = true;
            }
         }
      }
    } catch(err) {
      console.warn("Failed direct DOM insertion:", err);
    }
    
    if (!handled) {
      const markerRegex = new RegExp(`<span[^>]*id="${markerId}"[^>]*>.*?</span>`, 'gi');
      let currentHtml = joditRef.current?.value || form.instruction || "";
      if (markerRegex.test(currentHtml)) {
         currentHtml = currentHtml.replace(markerRegex, appendHtml);
         setForm(prev => ({ ...prev, instruction: currentHtml }));
         handled = true;
      }
    }
    
    activeMarkerRef.current = null;
    return handled;
  };

  const handleFilePicked = async (e, type) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    const attachment = await uploadFile(file, type);
    
    let appendHtml = "";
    if (type === 'image') {
      appendHtml = `<br/><img src="${attachment.url}" alt="${attachment.name}" style="max-width: 100%; height: auto; border-radius: 8px;" /><br/>`;
    } else if (type === 'video') {
      appendHtml = `<br/><video src="${attachment.url}" controls style="max-width: 100%; height: auto; border-radius: 8px;"></video><br/>`;
    }

    if (type === 'document') {
      setForm(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), attachment]
      }));
    } else {
      if (!insertAtMarker(appendHtml)) {
        setForm(prev => ({ 
          ...prev, 
          instruction: (prev.instruction || "") + appendHtml 
        }));
      }
    }
    setUploading(false);
  };

  const handleDropCapture = async (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      let hasImageOrVideo = false;
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/') || files[i].type.startsWith('video/')) {
          hasImageOrVideo = true;
          break;
        }
      }
      if (!hasImageOrVideo) return;
      
      // Capture the drop location!
      let dropRange = null;
      if (document.caretRangeFromPoint) {
        dropRange = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if (e.rangeParent) {
        dropRange = document.createRange();
        dropRange.setStart(e.rangeParent, e.rangeOffset);
        dropRange.collapse(true);
      }

      e.preventDefault();
      e.stopPropagation();
      setUploading(true);

      // Force focus and selection immediately so async await doesn't lose it
      const editorObj = joditRef.current;
      if (editorObj) {
        if (editorObj.editor?.focus) editorObj.editor.focus();
        else if (editorObj.focus) editorObj.focus();
        
        if (dropRange) {
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(dropRange);
          }
        }
      }
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
          const type = file.type.startsWith('image/') ? 'image' : 'video';
          const attachment = await uploadFile(file, type);
          const appendHtml = type === 'image' 
            ? `<br/><img src="${attachment.url}" alt="${attachment.name}" style="max-width: 100%; height: auto; border-radius: 8px;" /><br/>`
            : `<br/><video src="${attachment.url}" controls style="max-width: 100%; height: auto; border-radius: 8px;"></video><br/>`;
          
          if (editorObj?.s) {
            editorObj.s.insertHTML(appendHtml);
          }
        }
      }
      setUploading(false);
    }
  };

  const handlePasteCapture = async (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      let hasImageOrVideo = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/') || items[i].type.startsWith('video/')) {
          hasImageOrVideo = true;
          break;
        }
      }
      if (!hasImageOrVideo) return;
      
      e.preventDefault();
      e.stopPropagation();
      setUploading(true);
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
          const file = item.getAsFile();
          if (!file) continue;
          const type = item.type.startsWith('image/') ? 'image' : 'video';
          const attachment = await uploadFile(file, type);
          const appendHtml = type === 'image' 
            ? `<br/><img src="${attachment.url}" alt="${attachment.name}" style="max-width: 100%; height: auto; border-radius: 8px;" /><br/>`
            : `<br/><video src="${attachment.url}" controls style="max-width: 100%; height: auto; border-radius: 8px;"></video><br/>`;
          
          const editorObj = joditRef.current;
          if (editorObj?.s) {
            if (editorObj.editor?.focus) editorObj.editor.focus();
            else if (editorObj.focus) editorObj.focus();
            editorObj.s.insertHTML(appendHtml);
          }
        }
      }
      setUploading(false);
    }
  };

  const handleAddLink = () => {
    setIsLinkModalOpen(true);
  };

  const handleSaveLink = (linkAttachment) => {
    setForm(prev => ({
      ...prev,
      attachments: [...(prev.attachments || []), linkAttachment]
    }));
  };

  const handleInstructionClick = (e) => {
    const anchor = e.target.closest('a');
    if (anchor && anchor.href) {
      e.preventDefault();
      e.stopPropagation();
      const targetUrl = anchor.href;
      setPreviewIframe({
        url: targetUrl,
        name: anchor.innerText?.trim() || targetUrl,
        type: 'link'
      });
    }
  };

  // Keyboard shortcut (Ctrl+K / Cmd+K) to open Link modal when assignment modal is open
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsLinkModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const removeAttachment = (index) => {
    setForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));
  };

  const [deleteClassworkConfirm, setDeleteClassworkConfirm] = useState(null);

  const toggleMenu = (e, id) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === id ? null : id);
  };

  const handleDeleteClasswork = (e, id) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const item = classwork.find(c => c.id === id);
    setDeleteClassworkConfirm({
      id,
      title: item?.title || 'this item'
    });
    setActiveMenu(null);
  };

  const handleExecuteDeleteClasswork = () => {
    if (!deleteClassworkConfirm) return;
    const toDeleteId = deleteClassworkConfirm.id;
    setClasswork(prev => {
      const next = prev.filter(c => c.id !== toDeleteId);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
    apiFetch(`${import.meta.env.VITE_API_URL}/classwork/${classroomId}/${toDeleteId}`, {
      method: 'DELETE'
    }).catch(() => {});
    setDeleteClassworkConfirm(null);
  };

  const openCreate = async (type = 'Activity') => {

    setEditingId(null);
    let defaults = { ...EMPTY_FORM, activityType: type };
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`);
      if (res.ok) {
        const data = await res.json();
        if (data?.settings?.examDefaults) {
          defaults.duration = data.settings.examDefaults.defaultExamTimer || 60;
          defaults.autoSaveInterval = data.settings.examDefaults.autoSaveInterval || '30s';
          defaults.treatWarningsAsErrors = !!data.settings.examDefaults.treatWarningsAsErrors;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch exam defaults', e);
    }
    setForm(defaults);
    setIsModalOpen(true);
  };

  const openModify = (e, item) => {
    e.stopPropagation();
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      activityType: item.activityType || 'Assignment',
      noDueDate: item.dueDate ? false : true,
      dueDate: item.dueDate || '',
      instruction: item.details || '',
      points: item.points || '100',
      grading: item.grading || 'On',
      attachments: item.attachments || [],
      duration: item.duration || 60,
      autoSaveInterval: item.autoSaveInterval || '30s',
      treatWarningsAsErrors: !!item.treatWarningsAsErrors,
      disableBack: !!item.disableBack,
      testCases: Array.isArray(item.testCases) ? item.testCases : [],
      starterCode: item.starterCode || ''
    });
    setActiveMenu(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    let currentInstruction = form.instruction;
    try {
      if (joditRef.current) {
        currentInstruction = joditRef.current.value ?? joditRef.current.editor?.value ?? form.instruction;
      }
    } catch (err) {}

    const data = {
      classroom_id: classroomId,
      classId: classroomId,
      title: form.title,
      activityType: form.activityType || 'Assignment',
      details: currentInstruction,
      dueDate: form.noDueDate ? '' : form.dueDate,
      points: form.points,
      grading: form.grading,
      attachments: form.attachments || [],
      duration: form.duration,
      autoSaveInterval: form.autoSaveInterval,
      treatWarningsAsErrors: form.treatWarningsAsErrors,
      disableBack: !!form.disableBack,
      testCases: Array.isArray(form.testCases) ? form.testCases : [],
      starterCode: form.starterCode || (editingId ? (classwork.find(i => i.id === editingId)?.starterCode || '') : '')
    };

    if (editingId) {
      setClasswork(classwork.map(item => item.id === editingId ? { ...item, ...data } : item));
    } else {
      setClasswork([{ id: Date.now(), archived: false, posted: new Date().toISOString(), classroom_id: classroomId, classId: classroomId, ...data }, ...classwork]);
    }
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleArchive = (e, id) => {
    e.stopPropagation();
    setClasswork(classwork.map(item => item.id === id ? { ...item, archived: true } : item));
    setActiveMenu(null);
  };

  const handleCopy = (e, item) => {
    e.stopPropagation();
    const copy = { ...item, id: Date.now(), title: `${item.title} (Copy)`, classroom_id: classroomId, classId: classroomId };
    setClasswork([copy, ...classwork]);
    setActiveMenu(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // SVG Illustration for Google Classroom Banner
  const renderBannerIllustration = () => (
    <ClassroomBannerIllustration
      themeId={bannerTheme.id}
      style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '100%', pointerEvents: 'none' }}
    />
  );
  const joditConfig = useMemo(() => ({
    readonly: false,
    theme: isDark ? 'dark' : 'default',
    buttons: [
      'bold', 'italic', 'underline', 'strikethrough', 'inlineCode', '|',
      'eraser', 'font', 'fontsize', 'brush', 'paragraph', '|',
      'ul', 'ol', '|',
      'table', '|',
      'undo', 'redo'
    ],
    controls: {
      inlineCode: {
        iconURL: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294l4-13zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z"/></svg>`,
        tooltip: 'Highlight (Code)',
        exec: (editor) => {
          editor.s.commitStyle({
            element: 'code',
            attributes: {
              class: 'inline-code-highlight'
            }
          });
        }
      }
    },
    placeholder: 'Enter assignment instruction...',
    height: 300,
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    hidePoweredByJodit: true,
    disablePlugins: 'image-properties,image-processor,video-properties',
    popup: { img: [], image: [], video: [], a: [] },
    style: {
      background: isDark ? '#242424' : '#f9fafb',
      color: isDark ? '#E8EAED' : '#111827'
    }
  }), [isDark]);

  // ═══ Design tokens for the instructor classroom shell ═══
  const ui = {
    bg: isDark ? '#141615' : '#f4f5f7',
    surface: isDark ? '#1b1e1c' : '#ffffff',
    surfaceAlt: isDark ? '#222523' : '#f3f4f6',
    inset: isDark ? '#171a18' : '#f9fafb',
    border: isDark ? '#2a2e2b' : '#e5e7eb',
    text: isDark ? '#e9ecea' : '#111827',
    muted: isDark ? '#8a918c' : '#6b7280',
    faint: isDark ? '#5d645f' : '#9ca3af',
    accent: '#34d399',
    accentSoft: isDark ? 'rgba(52,211,153,0.12)' : 'rgba(16,185,129,0.12)',
    accentText: isDark ? '#6ee7b7' : '#059669',
    violet: '#8b5cf6'
  };
  const BADGE_COLORS = ['#a78bfa', '#60a5fa', '#fb7185', '#38bdf8', '#fbbf24', '#34d399'];
  const activeClassrooms = sortClassroomsAlphabetically((classrooms || []).filter(c => !c.archived));
  const teacherName = currentUser?.name || classroom?.instructor || 'Instructor';
  const teacherInitial = teacherName.charAt(0).toUpperCase();
  const CLASSROOM_TABS = [
    { id: 'stream', label: 'Stream' },
    { id: 'classwork', label: 'Classwork' },
    { id: 'materials', label: 'Materials' },
    { id: 'people', label: 'People' },
    { id: 'grades', label: 'Grades' }
  ];
  const HEADER_NAV = [
    { id: 'classrooms', label: 'Home', Icon: Home },
    { id: 'calendar', label: 'Calendar', Icon: Calendar },
    { id: 'archived', label: 'Archived', Icon: Archive }
  ];
  const sectionLabelStyle = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: ui.muted };
  const smallIconBtnStyle = { width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: ui.muted, transition: 'background 0.2s ease', flexShrink: 0 };
  const renderTeacherAvatar = () => (
    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isDark ? '#1d3a2d' : '#d1fae5', color: ui.accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
      {teacherInitial}
    </div>
  );

  const getMaterialIcon = (item) => {
    if (isMaterialItem(item)) {
      const lessonType = getLessonType(item);
      if (lessonType === 'video') return Video;
      if (lessonType === 'link') return Link2;
      return FileText;
    }
    return ClipboardList;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={styles.container}
    >
      <style>{`
        .vt-nav-btn:hover { color: ${ui.text} !important; background: ${ui.surfaceAlt} !important; }
        .vt-class-row:hover { background: ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'} !important; color: ${ui.text} !important; }
        .vt-tab:hover { color: ${ui.text} !important; }
        .vt-card { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .vt-card:hover { border-color: ${isDark ? '#383d39' : '#d1d5db'} !important; }
        .vt-ghost-btn:hover { background: ${ui.surfaceAlt} !important; color: ${ui.text} !important; }
        .vt-post-btn:not(:disabled):hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 6px 18px -6px rgba(52,211,153,0.6); }
        .vt-outline-btn:hover { border-color: ${ui.accent} !important; color: ${ui.accentText} !important; }
        .vt-icon-btn:hover { background: ${ui.surfaceAlt} !important; color: ${ui.text} !important; }
        .vt-link:hover { gap: 10px !important; }
        .vt-composer:focus { border-color: ${ui.accent} !important; }
        .vt-customize:hover { opacity: 1 !important; }
      `}</style>

      {/* ═══ GLOBAL TOP HEADER ═══ */}
      <header 
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px clamp(20px, 3vw, 48px)',
        backgroundColor: ui.bg,
        borderBottom: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Shadow for header */}
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: 0,
          right: 0,
          height: '30px',
          background: `linear-gradient(to bottom, ${ui.bg}, transparent)`,
          pointerEvents: 'none'
        }} />

        {/* Left: Logo + role pill */}
        <div style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }} onClick={() => { if (onNavigateView) onNavigateView('classrooms'); else onBack(); }}>
          <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
          <span style={{ color: isDark ? '#f5f5f5' : '#111827', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
          <span style={{ fontSize: '0.7rem', color: isDark ? '#a3a3a3' : '#6b7280', marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructor</span>
        </div>

        {/* Center: Navigation */}
        <div 
          className="header-center-nav"
          style={{ 
            display: isMobile ? 'none' : 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '8px',
            opacity: 1,
            pointerEvents: 'auto',
            position: 'relative'
          }}
        >
          <div style={{
            position: 'absolute',
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            top: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '50px',
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 4px 16px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.35)',
            transition: indicatorStyle.transition || 'none',
            opacity: indicatorStyle.opacity,
            pointerEvents: 'none',
            zIndex: 0,
          }} />

          {HEADER_NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              ref={el => navRefs.current[id] = el}
              onMouseEnter={(e) => {
                setIndicatorStyle({
                  left: e.currentTarget.offsetLeft,
                  width: e.currentTarget.offsetWidth,
                  opacity: 1,
                  transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                });
              }}
              onMouseLeave={() => {
                setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
              }}
              onClick={() => { 
                if (onNavigateView) onNavigateView(id); 
                else onBack(); 
              }}
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
                color: isDark ? '#a3a3a3' : '#6b7280',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Icon size={18} /> {label}
            </button>
          ))}

          <button
            ref={el => navRefs.current['settings'] = el}
            onMouseEnter={(e) => {
              setIndicatorStyle({
                left: e.currentTarget.offsetLeft,
                width: e.currentTarget.offsetWidth,
                opacity: 1,
                transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
              });
            }}
            onMouseLeave={() => {
              setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
            }}
            onClick={() => setIsSettingsModalOpen(true)}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              borderRadius: '50px',
              backgroundColor: 'transparent',
              color: isDark ? '#a3a3a3' : '#6b7280',
              border: 'none',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            <Settings size={20} />
            <span style={{ marginLeft: '8px', fontWeight: '600', fontSize: '0.9rem' }}>Settings</span>
          </button>
        </div>

        {/* Right: Profile */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: '16px', marginRight: '24px' }}>
          <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
        </div>
      </header>

      {/* ═══ PAGE (scrolls under the header) ═══ */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ maxWidth: '100%', margin: 0, padding: isMobile ? '16px 16px 48px' : '20px clamp(20px, 3vw, 48px) 56px', width: '100%', boxSizing: 'border-box' }}>

          {/* CLASS CODE PILL */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px 6px 14px', borderRadius: '10px',
              border: `1px solid ${isDark ? 'rgba(52,211,153,0.28)' : 'rgba(16,185,129,0.35)'}`,
              background: isDark ? 'rgba(52,211,153,0.06)' : 'rgba(16,185,129,0.06)'
            }}>
              <span style={{ fontSize: '0.72rem', color: ui.muted }}>Class code</span>
              <span onClick={() => setIsClassCodeModalOpen(true)} title="Click to enlarge" style={{ fontSize: '1rem', fontWeight: 800, color: ui.accentText, letterSpacing: '0.04em', cursor: 'pointer' }}>
                {classCode}
              </span>
              <span style={{ width: '1px', height: '18px', background: ui.border }} />
              <button className="vt-icon-btn" onClick={() => copyToClipboard(classCode)} title="Copy class code" style={{ ...smallIconBtnStyle, width: '26px', height: '26px', color: ui.text }}>
                {codeCopied ? <Check size={14} color={ui.accent} /> : <Copy size={14} />}
              </button>
              <button className="vt-icon-btn" onClick={() => setIsClassCodeModalOpen(true)} title="Display large class code" style={{ ...smallIconBtnStyle, width: '26px', height: '26px', color: ui.text }}>
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          {/* CLASSROOM TAB BAR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px', borderRadius: '12px', background: ui.surface, border: `1px solid ${ui.border}`, marginBottom: '24px' }}>
            <div style={{ display: 'flex', flex: 1 }}>
              {CLASSROOM_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className="vt-tab"
                    onClick={() => handleTabChange(tab.id)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: isActive ? 700 : 500, color: isActive ? ui.accentText : ui.muted, transition: 'color 0.2s ease' }}
                  >
                    <span style={{ position: 'relative', padding: '8px 16px', borderRadius: '8px' }}>
                      {isActive && (
                        <motion.span
                          layoutId="teacherClassroomTabPill"
                          style={{ position: 'absolute', inset: 0, borderRadius: '8px', background: ui.accentSoft, pointerEvents: 'none' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                        />
                      )}
                      <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB CONTENT */}
          <div style={{ minWidth: 0 }}>
            <AnimatePresence mode="wait" custom={tabDirection}>
              <motion.div
                key={activeTab}
                custom={tabDirection}
                variants={tabSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}
              >

              {/* ═══ TAB 1: STREAM ═══ */}
              {activeTab === 'stream' && (
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? '24px' : '32px',
                  alignItems: 'flex-start',
                  width: '100%'
                }}>

                  {/* LEFT COLUMN: Classroom card + Teaching list */}
                  <aside style={{
                    width: isMobile ? '100%' : '280px',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    position: isMobile ? 'static' : 'sticky',
                    top: '20px'
                  }}>
                    <div style={{
                      position: 'relative', overflow: 'hidden', borderRadius: '16px',
                      padding: isMobile ? '20px' : '24px 20px',
                      minHeight: isMobile ? '200px' : '260px',
                      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
                      background: bannerTheme.customImageUrl
                        ? `url(${bannerTheme.customImageUrl}) center/cover no-repeat`
                        : `linear-gradient(150deg, ${bannerTheme.primary}, ${bannerTheme.secondary})`,
                      boxShadow: isDark ? '0 18px 40px -18px rgba(0,0,0,0.7)' : '0 14px 30px -16px rgba(15,23,42,0.35)'
                    }}>
                      {/* Decorative rings */}
                      <div style={{ position: 'absolute', top: '-70px', right: '-70px', width: '210px', height: '210px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.14)', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', top: '-24px', right: '-24px', width: '120px', height: '120px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', pointerEvents: 'none' }} />

                      <div style={{ position: 'relative', zIndex: 2, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.88)' }}>
                        Your classroom
                      </div>

                      {!bannerTheme.customImageUrl && (
                        <div style={{
                          position: 'absolute',
                          right: '-10px',
                          top: '10px',
                          width: '210px',
                          height: '165px',
                          pointerEvents: 'none',
                          zIndex: 1,
                          overflow: 'hidden'
                        }}>
                          <ClassroomBannerIllustration
                            themeId={bannerTheme.id}
                            style={{ width: '100%', height: '100%' }}
                          />
                        </div>
                      )}

                      <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
                        <h1 style={{ fontSize: isMobile ? '1.8rem' : '2rem', fontWeight: 500, color: bannerTheme.textColor || 'white', margin: '0 0 6px', wordBreak: 'break-word', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                          {classroom?.name || 'Verity'}
                        </h1>
                        <div style={{ fontSize: '0.78rem', color: bannerTheme.textColor || 'white', opacity: 0.85 }}>
                          {classroom?.section || classroom?.subject || classroom?.name || ''}
                        </div>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.22)', margin: '14px 0 12px' }} />
                        <button
                          className="vt-customize"
                          onClick={() => { setOriginalBannerTheme(bannerTheme); setIsCustomizeOpen(true); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: bannerTheme.textColor || 'white', cursor: 'pointer', padding: 0, fontSize: '0.78rem', fontWeight: 600, opacity: 0.92, fontFamily: 'inherit' }}
                        >
                          <Edit3 size={13} /> Customize
                        </button>
                      </div>
                    </div>

                    {/* TEACHING LIST */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', marginBottom: '10px' }}>
                        <span style={sectionLabelStyle}>Teaching</span>
                        <span style={{ ...sectionLabelStyle, color: ui.faint }}>{String(activeClassrooms.length).padStart(2, '0')}</span>
                      </div>
                      <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'row' : 'column',
                        gap: isMobile ? '8px' : '4px',
                        overflowX: isMobile ? 'auto' : 'visible',
                        paddingBottom: isMobile ? '6px' : '0'
                      }}>
                        {activeClassrooms.map((cls, idx) => {
                          const active = String(classroom?.id) === String(cls.id);
                          const badgeColor = BADGE_COLORS[idx % BADGE_COLORS.length];
                          const clsName = cls.name || 'Untitled';
                          return (
                            <button
                              key={cls.id}
                              className="vt-class-row"
                              onClick={() => handleSelectClassroom(cls, idx)}
                              title={active ? `${clsName} (Current classroom)` : `Switch to ${clsName}`}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px',
                                width: isMobile ? 'auto' : '100%',
                                minWidth: isMobile ? '160px' : 'auto',
                                flexShrink: 0,
                                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                                background: active
                                  ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.75)')
                                  : 'transparent',
                                backdropFilter: active ? 'blur(12px)' : 'none',
                                WebkitBackdropFilter: active ? 'blur(12px)' : 'none',
                                border: active
                                  ? (isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.08)')
                                  : '1px solid transparent',
                                boxShadow: active
                                  ? (isDark ? '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12)' : '0 4px 12px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)')
                                  : 'none',
                                color: active ? ui.text : (isDark ? '#c4c9c5' : '#374151'),
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <span style={{
                                width: '26px', height: '26px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.74rem', fontWeight: 800, flexShrink: 0,
                                background: active
                                  ? (isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.06)')
                                  : (isDark ? '#232725' : '#f1f5f9'),
                                border: active
                                  ? (isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.08)')
                                  : 'none',
                                color: active ? ui.text : badgeColor
                              }}>
                                {clsName.charAt(0).toUpperCase()}
                              </span>
                              <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: active ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {clsName}
                              </span>
                              {active && (
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: ui.accent,
                                  boxShadow: `0 0 8px ${ui.accent}`,
                                  flexShrink: 0
                                }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ height: '1px', background: ui.border, marginTop: '16px' }} />
                    </div>
                  </aside>

                  {/* CENTER COLUMN: Stream feed */}
                  <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <AnimatePresence mode="wait" custom={classroomDirection}>
                      <motion.div
                        key={classroom?.id || 'stream_feed'}
                        custom={classroomDirection}
                        variants={classroomSlideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
                      >
                  <div style={{ marginBottom: '18px' }}>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 500, letterSpacing: '-0.01em', margin: 0, color: ui.text }}>Classroom stream</h2>
                  </div>

                  {/* Latest activity header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={sectionLabelStyle}>Latest activity</span>
                      <span style={{ fontSize: '0.7rem', color: ui.faint }}>
                        {formatShortDate(visibleStreamItems[0]?.posted || visibleStreamItems[0]?.createdAt || Date.now())}
                      </span>
                    </div>
                  </div>

                  {/* Feed */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {loadingClasswork ? (
                      <>
                        <Skeleton.StreamCard />
                        <Skeleton.StreamCard />
                        <Skeleton.StreamCard />
                      </>
                    ) : filteredStreamItems.length === 0 ? (
                      <div style={{ padding: '36px 20px', borderRadius: '14px', border: `1px dashed ${ui.border}`, textAlign: 'center', color: ui.muted, fontSize: '0.84rem' }}>
                        This is where you'll see classwork, learning materials, and activities posted for your students.
                      </div>
                    ) : (
                      filteredStreamItems.map((item, index) => {
                        const isMaterial = isMaterialItem(item);
                        const plain = (item.details || '').replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
                        const postedLabel = formatShortDate(item.posted || item.createdAt || (typeof item.id === 'number' && item.id > 1e12 ? item.id : null));
                        const openItem = () => {
                          if (isMaterial) {
                            handleTabChange('materials');
                          } else {
                            handleTabChange('classwork');
                          }
                          setExpandedId(item.id);
                        };

                        const lessonType = isMaterial ? getLessonType(item) : null;
                        const badgeText = isMaterial
                          ? (lessonType === 'video' ? 'Video Lesson' : lessonType === 'link' ? 'Link Resource' : 'Material')
                          : (item.activityType || 'Classwork');
                        const badgeColor = isMaterial
                          ? (lessonType === 'video' ? (isDark ? '#fbbf24' : '#d97706') : lessonType === 'link' ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#34d399' : '#059669'))
                          : ui.accentText;
                        const iconBg = isMaterial
                          ? (lessonType === 'video' ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7') : lessonType === 'link' ? (isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe') : (isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7'))
                          : (isDark ? 'rgba(52, 211, 153, 0.12)' : '#ecfdf5');
                        const iconColor = isMaterial
                          ? (lessonType === 'video' ? (isDark ? '#fbbf24' : '#d97706') : lessonType === 'link' ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#34d399' : '#059669'))
                          : ui.accentText;

                        return (
                          <motion.div 
                            key={item.id} 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="vt-card" style={{ background: ui.surface, border: `1px solid ${ui.border}`, borderRadius: '14px', overflow: 'visible', position: 'relative' }}>
                            {Number(activeActivityCounts[String(item.id)]) > 0 && !isMaterial && (
                              <span
                                title={`${activeActivityCounts[String(item.id)]} student${Number(activeActivityCounts[String(item.id)]) > 1 ? 's' : ''} currently working on this activity`}
                                style={{
                                  position: 'absolute',
                                  top: '-3px',
                                  left: '-3px',
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '50%',
                                  backgroundColor: '#10b981',
                                  boxShadow: isDark
                                    ? `0 0 0 2.5px ${ui.surface || '#1b1e1c'}, 0 0 12px #10b981`
                                    : '0 0 0 2.5px #ffffff, 0 0 12px #10b981',
                                  animation: 'live-pulse 1.8s infinite',
                                  zIndex: 40,
                                  pointerEvents: 'auto'
                                }}
                              />
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 0' }}>
                              {renderTeacherAvatar()}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 500, color: ui.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {postedLabel || 'Recently'}
                                </div>
                              </div>
                              <button className="vt-icon-btn" onClick={openItem} title={isMaterial ? "Open in Materials" : "Open in Classwork"} style={smallIconBtnStyle}>
                                <MoreHorizontal size={18} />
                              </button>
                            </div>

                            <div style={{
                              display: 'flex',
                              alignItems: isMobile ? 'flex-start' : 'center',
                              flexDirection: isMobile ? 'column' : 'row',
                              gap: '16px',
                              padding: '16px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: isMobile ? '100%' : 'auto', flex: isMobile ? 'none' : 1, minWidth: 0 }}>
                                <div style={{ width: '72px', height: '72px', borderRadius: '10px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {(() => {
                                    const IconComp = getMaterialIcon(item);
                                    return <IconComp size={28} color={iconColor} strokeWidth={1.6} />;
                                  })()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: badgeColor }}>
                                      {badgeText}
                                    </div>
                                    {item.dueDate && !isMaterial && (
                                      <span style={{ fontSize: '0.68rem', color: isDark ? '#fbbf24' : '#d97706', fontWeight: 600 }}>
                                        • Due {formatShortDate(item.dueDate)}
                                      </span>
                                    )}
                                    {item.attachments && item.attachments.length > 0 && (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: ui.faint }}>
                                        • <Paperclip size={10} /> {item.attachments.length} {item.attachments.length === 1 ? 'file' : 'files'}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '1.25rem', fontWeight: 500, color: ui.text, margin: '4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.title}
                                  </div>
                                  <div style={{ fontSize: '0.76rem', color: ui.muted, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {plain || (isMaterial ? "View learning materials, syllabus, and study references." : "View assignment instructions and manage your students' work.")}
                                  </div>
                                </div>
                              </div>
                              <button
                                className="vt-outline-btn"
                                onClick={openItem}
                                style={{
                                  flexShrink: 0,
                                  background: ui.surfaceAlt,
                                  border: `1px solid ${ui.border}`,
                                  color: ui.text,
                                  padding: '9px 16px',
                                  borderRadius: '9px',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                  transition: 'all 0.2s ease',
                                  width: isMobile ? '100%' : 'auto',
                                  textAlign: 'center'
                                }}
                              >
                                {isMaterial ? 'View material' : 'View assignment'}
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* ═══ TAB 2: CLASSWORK ═══ */}
              {activeTab === 'classwork' && (
                <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
                  <div style={styles.headerRow}>
                    <div>
                      <h2 style={{ color: isDark ? '#E8EAED' : '#1e293b', fontWeight: '700', fontSize: '1.4rem', margin: 0 }}>
                        List of Classworks
                      </h2>
                      <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
                        Create and organize assignments, questions, and learning activities for this class.
                      </p>
                    </div>
                    <div>
                      <button onClick={() => openCreate()} style={styles.addButton} className="btn-anim">
                        <Plus size={18} style={{ marginRight: '6px' }} /> Create
                      </button>
                    </div>
                  </div>

                  {/* List of Classwork */}
                  <div style={styles.list}>
                    {loadingClasswork ? (
                      Array.from({ length: 3 }).map((_, i) => <Skeleton.AssignmentRow key={i} />)
                    ) : visibleClasswork.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: isDark ? '#a3a3a3' : '#94a3b8' }}>
                        <BookOpen size={48} color={isDark ? '#4A4A4A' : '#cbd5e1'} style={{ margin: '0 auto 12px auto', display: 'block' }} />
                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>No classwork yet</p>
                        <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>Click "Create" to assign new work to your students.</p>
                      </div>
                    ) : (
                      visibleClasswork.map((item, index) => {
                        const isOpen = expandedId === item.id;
                        const due = formatShortDate(item.dueDate);
                        const posted = formatShortDate(item.posted || (typeof item.id === 'number' && item.id > 1e12 ? item.id : null));
                        return (
                          <motion.div 
                            key={item.id} 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            style={styles.itemWrapper}>
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
                                  position: 'relative'
                                }}
                                onClick={() => toggleExpand(item.id)}
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
                                {Number(activeActivityCounts[String(item.id)]) > 0 && (
                                  <span
                                    title={`${activeActivityCounts[String(item.id)]} student${Number(activeActivityCounts[String(item.id)]) > 1 ? 's' : ''} currently working on this activity`}
                                    style={{
                                      position: 'absolute',
                                      top: '-3px',
                                      left: '-3px',
                                      width: '14px',
                                      height: '14px',
                                      borderRadius: '50%',
                                      backgroundColor: '#10b981',
                                      boxShadow: isDark
                                        ? `0 0 0 2.5px ${isOpen ? '#242a2b' : '#1e2324'}, 0 0 12px #10b981`
                                        : `0 0 0 2.5px ${isOpen ? '#f1f5f9' : '#f8fafc'}, 0 0 12px #10b981`,
                                      animation: 'live-pulse 1.8s infinite',
                                      zIndex: 40,
                                      pointerEvents: 'auto'
                                    }}
                                  />
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                  {/* Icon Container */}
                                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#dcfce7', border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginRight: '16px', flexShrink: 0 }}>
                                    {(() => {
                                      const IconComp = getMaterialIcon(item);
                                      return <IconComp size={18} />;
                                    })()}
                                  </div>

                                  <span style={{ color: isDark ? '#f5f5f5' : '#1e293b', fontSize: '1.05rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.title}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                                  {due ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isDark ? '#a7f3d0' : '#059669', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5', padding: '5px 12px', borderRadius: '8px', fontWeight: '600' }}>
                                      <Calendar size={12} /> Due {due}
                                    </span>
                                  ) : null}

                                  {/* Vertical Divider */}
                                  <div style={{ width: '1px', height: '24px', backgroundColor: isDark ? '#3d4447' : '#e2e8f0' }} />

                                  {/* 3-dots Menu Button */}
                                  <div
                                    style={{
                                      ...styles.threeDots,
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'background 0.15s ease'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleMenu(e, item.id);
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <MoreVertical size={18} color={isDark ? '#a3a3a3' : '#64748b'} />
                                    {activeMenu === item.id && (
                                      <div style={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                                        <div style={styles.dropdownItem} onClick={(e) => openModify(e, item)}>Modify</div>
                                        <div style={styles.dropdownItem} onClick={(e) => handleArchive(e, item.id)}>Archive</div>
                                        <div style={styles.dropdownItem} onClick={(e) => handleCopy(e, item)}>Copy</div>
                                        <div style={{ ...styles.dropdownItem, color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); handleDeleteClasswork(e, item.id); }}>Delete</div>
                                      </div>
                                    )}
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
                                  <ClipboardList size={30} color={isDark ? '#10b981' : '#4b5563'} />
                                  <div>
                                    <div style={styles.detailTitle}>{item.title}</div>
                                    <div style={styles.detailDue}>{due ? `Due ${due}` : 'No Due Date'} • {item.points || 100} points</div>
                                  </div>
                                </div>

                                <div style={styles.detailBody}>
                                  <div style={styles.detailLeft}>
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
                                        onClick={handleInstructionClick}
                                      >
                                        <div dangerouslySetInnerHTML={{ __html: item.details }} />
                                      </div>
                                      {expandedInstructionId !== item.id && item.details.replace(/<[^>]*>?/gm, '').length > 100 && (
                                        <div 
                                          style={{ color: '#10b981', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '6px' }}
                                          onClick={(e) => { e.stopPropagation(); setExpandedInstructionId(item.id); }}
                                        >
                                          View activity details...
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

                                  <div style={styles.detailStats}>
                                    <div style={styles.statCol}>
                                      <span style={styles.statNum}>{submissionData.counts[item.id] || 0}</span>
                                      <span style={styles.statLabel}>Turned in</span>
                                    </div>
                                    <div style={styles.statColDivider} />
                                    <div style={styles.statCol}>
                                      <span style={styles.statNum}>{enrolledStudents.length || submissionData.studentCount || 0}</span>
                                      <span style={styles.statLabel}>Assigned</span>
                                    </div>
                                  </div>
                                </div>

                                <div style={styles.detailDivider} />

                                <div style={{
                                  ...styles.detailFooter,
                                  flexDirection: isMobile ? 'column' : 'row',
                                  alignItems: isMobile ? 'stretch' : 'center',
                                  padding: isMobile ? '14px 20px' : '16px 28px'
                                }}>
                                  {/* Button para sa activity details at grading */}
                                  <button
                                    style={{
                                      ...styles.viewGradingBtn,
                                      width: isMobile ? '100%' : 'auto',
                                      justifyContent: 'center'
                                    }}
                                    className="btn-anim"
                                    onClick={() => {
                                      try {
                                        sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, activeTab);
                                        sessionStorage.setItem('verity_teacher_classwork_tab_active', activeTab);
                                      } catch {}
                                      if (onOpenGrading) onOpenGrading(item);
                                      else {
                                        setSelectedGradingActivityId(item.id);
                                        handleTabChange('grades');
                                      }
                                    }}
                                    title="Open activity details and grade student submissions"
                                  >
                                    <ClipboardList size={16} /> View Activity & Grading
                                  </button>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                                    {/* Button para sa VCR Replay playback */}
                                    <button
                                      style={{
                                        ...styles.viewGradingBtn,
                                        backgroundColor: isDark ? 'rgba(168, 85, 247, 0.12)' : '#f5f3ff',
                                        borderColor: isDark ? 'rgba(168, 85, 247, 0.35)' : '#ddd6fe',
                                        color: isDark ? '#c084fc' : '#7c3aed',
                                        boxShadow: isDark
                                          ? '0 0 12px rgba(168, 85, 247, 0.12)'
                                          : '0 1px 3px rgba(168, 85, 247, 0.10)',
                                        width: isMobile ? '100%' : 'auto',
                                        justifyContent: 'center'
                                      }}
                                      className="btn-anim"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        try {
                                          sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, activeTab);
                                          sessionStorage.setItem('verity_teacher_classwork_tab_active', activeTab);
                                        } catch {}
                                        onOpenPlayback && onOpenPlayback(item, null);
                                      }}
                                      title="Open VCR replay & student recordings"
                                    >
                                      <PlayCircle size={16} /> Replay Playback
                                    </button>
                                    {/* Button para sa Live Monitoring */}
                                    <button
                                      style={{
                                        ...styles.liveMonitorBtn,
                                        width: isMobile ? '100%' : 'auto',
                                        justifyContent: 'center'
                                      }}
                                      className="btn-anim"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        try {
                                          sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, activeTab);
                                          sessionStorage.setItem('verity_teacher_classwork_tab_active', activeTab);
                                        } catch {}
                                        onStartMonitoring && onStartMonitoring(item);
                                      }}
                                      title="Open live proctoring & monitoring"
                                    >
                                      <Monitor size={16} /> Live Monitoring
                                    </button>
                                  </div>
                                </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ═══ TAB: MATERIALS ═══ */}
              {activeTab === 'materials' && (
                <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0', paddingBottom: '18px', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontWeight: '700', fontSize: '1.4rem' }}>
                        List of Materials
                      </h2>
                      <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
                        Upload and manage resources, syllabus, and study guides for this classroom.
                      </p>
                    </div>
                    <div>
                      <button onClick={() => openCreate('Material')} style={styles.addButton} className="btn-anim">
                        <Plus size={18} style={{ marginRight: '6px' }} /> Create
                      </button>
                    </div>
                  </div>
                  <div style={{ ...styles.list, padding: '0 0 40px 0' }}>
                    {visibleMaterials.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: isDark ? '#a3a3a3' : '#94a3b8' }}>
                        <FileText size={48} color={isDark ? '#4A4A4A' : '#cbd5e1'} style={{ margin: '0 auto 12px auto', display: 'block' }} />
                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>No materials uploaded yet</p>
                        <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>Use the Create button to upload syllabus, readings, and reference documents.</p>
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
                                  position: 'relative'
                                }}
                                onClick={() => toggleExpand(item.id)}
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
                                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                  {/* Icon Container: Video, Document, or Link */}
                                  {(() => {
                                    const lessonType = getLessonType(item);
                                    let bg = isDark ? 'rgba(16, 185, 129, 0.12)' : '#dcfce7';
                                    let color = '#10b981';
                                    if (lessonType === 'video') {
                                      bg = isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7';
                                      color = isDark ? '#fbbf24' : '#d97706';
                                    } else if (lessonType === 'link') {
                                      bg = isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe';
                                      color = isDark ? '#38bdf8' : '#0284c7';
                                    }
                                    return (
                                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: bg, border: isDark ? `1px solid ${color}40` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, marginRight: '16px', flexShrink: 0 }}>
                                        {lessonType === 'video' ? <Video size={18} /> : lessonType === 'link' ? <Link2 size={18} /> : <FileText size={18} />}
                                      </div>
                                    );
                                  })()}

                                  <span style={{ color: isDark ? '#f5f5f5' : '#1e293b', fontSize: '1.05rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.title}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                                  {posted ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isDark ? '#a7f3d0' : '#059669', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5', padding: '5px 12px', borderRadius: '8px', fontWeight: '600' }}>
                                      Posted {posted}
                                    </span>
                                  ) : null}

                                  {/* Vertical Divider */}
                                  <div style={{ width: '1px', height: '24px', backgroundColor: isDark ? '#3d4447' : '#e2e8f0' }} />

                                  {/* 3-dots Menu Button */}
                                  <div
                                    style={{
                                      ...styles.threeDots,
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'background 0.15s ease'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleMenu(e, item.id);
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <MoreVertical size={18} color={isDark ? '#a3a3a3' : '#64748b'} />
                                    {activeMenu === item.id && (
                                      <div style={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                                        <div style={styles.dropdownItem} onClick={(e) => openModify(e, item)}>Modify</div>
                                        <div style={styles.dropdownItem} onClick={(e) => handleArchive(e, item.id)}>Archive</div>
                                        <div style={{ ...styles.dropdownItem, color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); handleDeleteClasswork(e, item.id); }}>Delete</div>
                                      </div>
                                    )}
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
                                      {(() => {
                                        const lessonType = getLessonType(item);
                                        if (lessonType === 'video') return <Video size={30} color={isDark ? '#fbbf24' : '#d97706'} />;
                                        if (lessonType === 'link') return <Link2 size={30} color={isDark ? '#38bdf8' : '#0284c7'} />;
                                        return <FileText size={30} color={isDark ? '#10b981' : '#059669'} />;
                                      })()}
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
                                        onClick={handleInstructionClick}
                                      >
                                        <div dangerouslySetInnerHTML={{ __html: item.details }} />
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
                                              else if (clickedAtt.type === 'document' || clickedAtt.type === 'link') {
                                                setPreviewIframe(clickedAtt);
                                              }
                                            }}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div style={styles.detailDivider} />

                                <div style={{
                                  ...styles.detailFooter,
                                  flexDirection: isMobile ? 'column' : 'row',
                                  alignItems: isMobile ? 'stretch' : 'center',
                                  padding: isMobile ? '14px 20px' : '16px 28px'
                                }}>
                                  <button
                                    style={{
                                      ...styles.viewGradingBtn,
                                      width: isMobile ? '100%' : 'auto',
                                      justifyContent: 'center'
                                    }}
                                    className="btn-anim"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingMaterialModal(item);
                                    }}
                                    title="View full material details"
                                  >
                                    <FileText size={16} /> View Material Details
                                  </button>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                                    <button
                                      style={{
                                        ...styles.viewGradingBtn,
                                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                                        borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0',
                                        color: isDark ? '#34d399' : '#059669',
                                        boxShadow: isDark
                                          ? '0 0 12px rgba(16, 185, 129, 0.12)'
                                          : '0 1px 3px rgba(16, 185, 129, 0.10)',
                                        width: isMobile ? '100%' : 'auto',
                                        justifyContent: 'center'
                                      }}
                                      className="btn-anim"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openModify(e, item);
                                      }}
                                      title="Edit this material"
                                    >
                                      <Edit3 size={15} /> Edit Material
                                    </button>
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

              {/* ═══ TAB 3: PEOPLE ═══ */}
              {activeTab === 'people' && (
                <div style={{ maxWidth: '850px', margin: '0 auto', width: '100%' }}>
                  <div style={{ marginBottom: '40px' }}>
                    <div style={styles.peopleSectionHeader}>
                      <h2 style={styles.peopleSectionTitle}>Teachers</h2>
                      <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '700' }}>1 instructor</span>
                    </div>
                    <div style={styles.peopleList}>
                      <div style={styles.peopleRow}>
                        {instructorInfo?.avatar ? (
                          <img
                            src={instructorInfo.avatar}
                            alt={instructorInfo?.name || 'Instructor'}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              flexShrink: 0,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                            }}
                          />
                        ) : (
                          <div style={styles.peopleAvatarGreen}>
                            {(instructorInfo?.name || classroom?.instructor || currentUser?.name || 'I').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.95rem' }}>
                            {instructorInfo?.name || classroom?.instructor || currentUser?.name || 'Instructor'}
                          </div>
                          {(instructorInfo?.email || classroom?.instructorEmail || (currentUser?.role === 'Teacher' ? currentUser?.email : '')) && (
                            <div style={{ fontSize: '0.8rem', color: isDark ? '#a3a3a3' : '#64748b' }}>
                              {instructorInfo?.email || classroom?.instructorEmail || (currentUser?.role === 'Teacher' ? currentUser?.email : '')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={styles.peopleSectionHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 style={styles.peopleSectionTitle}>Students</h2>
                        {(currentUser?.role === 'Admin' || (currentUser?.role === 'Teacher' && allowManageStudents)) && (
                          <motion.button 
                            whileHover={{ scale: 1.05 }} 
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsAddStudentOpen(true)}
                            style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                          >
                            + Add Student
                          </motion.button>
                        )}
                      </div>
                      <span style={{ fontSize: '0.85rem', color: isDark ? '#a3a3a3' : '#64748b', fontWeight: '600' }}>
                        {enrolledStudents.length} student{enrolledStudents.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div style={styles.peopleList}>
                      {loadingStudents ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <Skeleton.Row />
                          <Skeleton.Row />
                          <Skeleton.Row />
                          <Skeleton.Row />
                        </div>
                      ) : enrolledStudents.length === 0 ? (
                        <div style={{ padding: '30px 10px', textAlign: 'center', color: isDark ? '#a3a3a3' : '#64748b' }}>
                          <Users size={40} color={isDark ? '#4A4A4A' : '#cbd5e1'} style={{ margin: '0 auto 10px auto', display: 'block' }} />
                          <p style={{ fontWeight: '600', margin: 0, color: isDark ? '#E8EAED' : '#1e293b' }}>No students enrolled yet</p>
                          <p style={{ fontSize: '0.85rem', color: isDark ? '#a3a3a3' : '#94a3b8', margin: '4px 0 0 0' }}>
                            Give students the class code <strong style={{ color: '#10b981' }}>{classCode}</strong> to join.
                          </p>
                        </div>
                      ) : (
                        sortedEnrolledStudents.map((student, idx) => (
                          <div key={idx} style={styles.peopleRow}>
                            {student.avatar ? (
                              <img
                                src={student.avatar}
                                alt={student.name}
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  flexShrink: 0,
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                                }}
                              />
                            ) : (
                              <div style={styles.peopleAvatarBlue}>
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: '600', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.95rem' }}>
                                {student.name}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: isDark ? '#a3a3a3' : '#64748b' }}>
                                {student.email}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ TAB 4: GRADES ═══ */}
              {activeTab === 'grades' && (
                <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0', paddingBottom: '18px', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontWeight: '700', fontSize: '1.4rem' }}>
                        Classroom Grades
                      </h2>
                      <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
                        Review and evaluate submissions for {classroom?.name || 'this class'}.
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {bulkToastMsg && (
                        <span style={{ padding: '6px 12px', backgroundColor: isDark ? '#133527' : '#ecfdf5', color: isDark ? '#34d399' : '#059669', fontSize: '0.8rem', borderRadius: '8px', fontWeight: '700' }}>
                          {bulkToastMsg}
                        </span>
                      )}
                      {gradingStudents.length > 0 && (
                        <button
                          onClick={() => setShowBulkGradeModal(true)}
                          style={styles.bulkGradeActionBtn}
                          title="Grade all students who submitted this activity at once"
                        >
                          <CheckCircle2 size={16} />
                          Grade All Submitted ({gradingStudents.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {visibleClasswork.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: isDark ? '#a3a3a3' : '#94a3b8' }}>
                      No assignments created yet in this classroom.
                    </div>
                  ) : (
                    <>
                      <div style={styles.activitySelectionRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: '700', color: isDark ? '#E8EAED' : '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={16} color="#10b981" />
                            Activity:
                          </span>
                        </div>
                        <div style={{ position: 'relative', minWidth: '260px', maxWidth: '420px', flex: '1 1 auto' }}>
                          <select
                            id="grades-activity-dropdown"
                            aria-label="Select activity"
                            value={String(selectedGradingActivityId ?? '')}
                            onChange={(e) => {
                              const rawVal = e.target.value;
                              const matched = visibleClasswork.find(a => String(a.id) === String(rawVal));
                              setSelectedGradingActivityId(matched ? matched.id : rawVal);
                            }}
                            style={{
                              width: '100%',
                              padding: '9px 36px 9px 14px',
                              borderRadius: '10px',
                              border: isDark ? '1px solid #44474a' : '1px solid #cbd5e1',
                              backgroundColor: isDark ? '#2e3032' : '#ffffff',
                              color: isDark ? '#E8EAED' : '#1e293b',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              MozAppearance: 'none',
                              cursor: 'pointer',
                              outline: 'none',
                              boxSizing: 'border-box',
                              boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
                              transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                            }}
                          >
                            {visibleClasswork.map(act => (
                              <option
                                key={act.id}
                                value={String(act.id)}
                                style={{
                                  backgroundColor: isDark ? '#242a2b' : '#ffffff',
                                  color: isDark ? '#E8EAED' : '#1e293b'
                                }}
                              >
                                {act.title}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={16}
                            style={{
                              position: 'absolute',
                              right: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              pointerEvents: 'none',
                              color: isDark ? '#a3a3a3' : '#64748b'
                            }}
                          />
                        </div>
                      </div>

                      <div style={styles.gradingColumnsLayout}>
                        <div style={styles.gradingRosterCol}>
                          <div style={styles.rosterHeaderBox}>
                            <h4 style={{ margin: 0, fontSize: '0.92rem', color: isDark ? '#E8EAED' : '#1e293b', fontWeight: '700' }}>
                              Turned In ({gradingStudents.length})
                            </h4>
                          </div>

                          <div style={styles.gradingStudentList}>
                            {gradingStudents.length === 0 ? (
                              <div style={{ padding: '30px 12px', textAlign: 'center', color: isDark ? '#a3a3a3' : '#94a3b8', fontStyle: 'italic', fontSize: '0.88rem' }}>
                                No students have submitted this activity yet.
                              </div>
                            ) : (
                              gradingStudents.map(s => {
                                const curGrade = getStudentGrade(gradingGrades, s);
                                const isEvaluated = isStudentGraded(gradingGrades, s);
                                const isSelected = selectedStudentId === s.id;
                                return (
                                  <div
                                    key={s.id}
                                    onClick={() => setSelectedStudentId(s.id)}
                                    style={{
                                      ...styles.gradingStudentRow,
                                      backgroundColor: isSelected ? (isDark ? '#193326' : '#ecfdf5') : (isDark ? '#383838' : '#ffffff'),
                                      borderColor: isSelected ? '#10b981' : (isDark ? '#4A4A4A' : '#e2e8f0'),
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                      <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        backgroundColor: isEvaluated ? '#10b981' : '#3b82f6',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        flexShrink: 0
                                      }}>
                                        {s.name.charAt(0).toUpperCase()}
                                      </div>
                                      <span style={{ fontWeight: '600', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {s.name}
                                      </span>
                                    </div>

                                    <div style={{ flexShrink: 0 }}>
                                      {isEvaluated ? (
                                        <span style={styles.gradeBadgeGraded}>
                                          {curGrade?.grade ?? maxPoints}/{maxPoints}
                                        </span>
                                      ) : (
                                        <span style={styles.gradeBadgeTurnedIn}>
                                          Turned In
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div style={styles.gradingEvalCol}>
                          {selectedStudentId && gradingStudents.some(s => s.id === selectedStudentId) ? (
                            (() => {
                              const curStudent = gradingStudents.find(s => s.id === selectedStudentId);
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #f1f5f9', paddingBottom: '14px' }}>
                                    <div>
                                      <h3 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.2rem', fontWeight: '700' }}>
                                        {curStudent.name}
                                      </h3>
                                      <div style={{ fontSize: '0.8rem', color: isDark ? '#a3a3a3' : '#64748b', marginTop: '4px' }}>
                                        Submitted {formatShortDate(curStudent.submittedAt) || 'recently'}
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <button
                                        onClick={() => {
                                          try {
                                            sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, activeTab);
                                            sessionStorage.setItem('verity_teacher_classwork_tab_active', activeTab);
                                          } catch {}
                                          onOpenPlayback && onOpenPlayback(activeGradingActivity, curStudent);
                                        }}
                                        style={styles.playbackActionBtn}
                                        title="Open recording playback"
                                      >
                                        <PlayCircle size={15} /> Playback
                                      </button>
                                    </div>
                                  </div>

                                  <div>
                                    <label style={styles.fieldLabel}>Submitted Code:</label>
                                    <pre style={styles.codePreviewPre}>
                                      {curStudent.finalCode || '// No code submitted or recorded.'}
                                    </pre>
                                  </div>

                                  <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                                    <div style={{ width: '130px' }}>
                                      <label style={styles.fieldLabel}>Grade ({maxPoints} max):</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max={maxPoints}
                                        value={studentGradeInput}
                                        onChange={(e) => setStudentGradeInput(e.target.value)}
                                        style={styles.input}
                                      />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={styles.fieldLabel}>Private Feedback:</label>
                                      <textarea
                                        rows={2}
                                        value={studentFeedbackInput}
                                        onChange={(e) => setStudentFeedbackInput(e.target.value)}
                                        placeholder="Add feedback for this student…"
                                        style={{ ...styles.input, resize: 'vertical' }}
                                      />
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                                    <button
                                      onClick={handleSaveIndividualGrade}
                                      disabled={indivSaveStatus === 'saving'}
                                      style={{
                                        ...styles.saveGradeBtn,
                                        backgroundColor: indivSaveStatus === 'saved' ? '#10b981' : (indivSaveStatus === 'error' ? '#ef4444' : styles.saveGradeBtn.backgroundColor),
                                        cursor: indivSaveStatus === 'saving' ? 'wait' : 'pointer',
                                        opacity: indivSaveStatus === 'saving' ? 0.75 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}
                                    >
                                      {indivSaveStatus === 'saving' && 'Saving...'}
                                      {indivSaveStatus === 'saved' && (
                                        <>
                                          <Check size={15} /> Saved
                                        </>
                                      )}
                                      {indivSaveStatus === 'error' && (indivSaveError || 'Error')}
                                      {indivSaveStatus === 'idle' && 'Save Grade'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
                              Select a student from the left roster to evaluate their submission.
                            </div>
                          )}
                        </div>

                      </div>
                    </>
                  )}
                </div>
              )}
              </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

      {/* ═══ MODAL: BANNER CUSTOMIZATION ═══ */}
      {isCustomizeOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsCustomizeOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.3rem' }}>Customize Appearance</h2>
                <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
                  Choose a theme color, background graphic, or image for this class banner.
                </p>
              </div>
              <button onClick={() => setIsCustomizeOpen(false)} style={styles.closeModalBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <label style={styles.fieldLabel}>Select Theme Preset:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '12px' }}>
                {THEME_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => setBannerTheme(preset)}
                    style={{
                      borderRadius: '12px',
                      padding: '10px',
                      border: bannerTheme.id === preset.id ? '2px solid #10b981' : (isDark ? '2px solid #4A4A4A' : '2px solid #e2e8f0'),
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      backgroundColor: bannerTheme.id === preset.id ? (isDark ? '#193326' : '#f0fdf4') : (isDark ? '#383838' : 'white'),
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{
                      height: '42px',
                      borderRadius: '8px',
                      background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      {bannerTheme.id === preset.id && <Check size={18} />}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b' }}>
                      {preset.name}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={styles.fieldLabel}>Or use Custom Header Image (URL):</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={bannerTheme.customImageUrl || ''}
                    onChange={(e) => setBannerTheme({ ...bannerTheme, customImageUrl: e.target.value })}
                    style={styles.input}
                  />
                  {bannerTheme.customImageUrl && (
                    <button
                      onClick={() => setBannerTheme({ ...bannerTheme, customImageUrl: '' })}
                      style={{ padding: '0 12px', border: isDark ? '1px solid #4A4A4A' : '1px solid #cbd5e1', borderRadius: '8px', background: isDark ? '#3A3A3A' : 'white', color: isDark ? '#a3a3a3' : '#64748b', cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '10px' }}>
                <button
                  onClick={() => {
                    setBannerTheme(originalBannerTheme || bannerTheme);
                    setIsCustomizeOpen(false);
                  }}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    saveClassroomTheme(classroom, bannerTheme, socket);
                    setIsCustomizeOpen(false);
                  }}
                  style={styles.saveGradeBtn}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: DISPLAY LARGE CLASS CODE ═══ */}
      {isClassCodeModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsClassCodeModalOpen(false)}>
          <div style={{ ...styles.modalCard, maxWidth: '440px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b' }}>Class code</span>
              <button onClick={() => setIsClassCodeModalOpen(false)} style={styles.closeModalBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{
              fontSize: '3.5rem',
              fontWeight: '900',
              letterSpacing: '0.08em',
              color: '#10b981',
              padding: '24px 0',
              fontFamily: 'monospace',
              userSelect: 'all'
            }}>
              {classCode}
            </div>

            <p style={{ color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.9rem', margin: '0 0 24px 0' }}>
              Share this code with your students so they can join this class from their student dashboard.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => copyToClipboard(classCode)}
                style={{
                  ...styles.addButton,
                  backgroundColor: codeCopied ? '#059669' : '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {codeCopied ? <Check size={18} /> : <Copy size={18} />}
                {codeCopied ? 'Copied Code!' : 'Copy Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: CLASS INFO (i) ═══ */}
      {isClassInfoModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsClassInfoModalOpen(false)}>
          <div style={{ ...styles.modalCard, maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.2rem' }}>About Class</h3>
              <button onClick={() => setIsClassInfoModalOpen(false)} style={styles.closeModalBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              <div style={styles.infoFieldRow}>
                <span style={styles.infoFieldLabel}>Class Name</span>
                <span style={styles.infoFieldValue}>{classroom?.name || 'Verity'}</span>
              </div>
              <div style={styles.infoFieldRow}>
                <span style={styles.infoFieldLabel}>Section</span>
                <span style={styles.infoFieldValue}>{classroom?.section || '2'}</span>
              </div>
              <div style={styles.infoFieldRow}>
                <span style={styles.infoFieldLabel}>Subject</span>
                <span style={styles.infoFieldValue}>{classroom?.subject || 'Computer Science'}</span>
              </div>
              <div style={styles.infoFieldRow}>
                <span style={styles.infoFieldLabel}>Class Code</span>
                <span style={{ ...styles.infoFieldValue, color: '#10b981', fontWeight: '700' }}>{classCode}</span>
              </div>
              <div style={styles.infoFieldRow}>
                <span style={styles.infoFieldLabel}>Instructor</span>
                <span style={styles.infoFieldValue}>{classroom?.instructor || currentUser?.name || 'Instructor'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setIsClassInfoModalOpen(false)} style={styles.saveGradeBtn}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: CLASSROOM SETTINGS (Gear Icon) ═══ */}
      {isSettingsModalOpen && (
        <ClassroomSettings
          classroom={currentClassroom || classroom}
          onClose={() => setIsSettingsModalOpen(false)}
          onUpdate={handleUpdateClassroom}
          role="teacher"
        />
      )}

      {/* ═══ MODAL: BULK GRADING FOR SUBMITTED STUDENTS ═══ */}
      {showBulkGradeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowBulkGradeModal(false)}>
          <div style={{ ...styles.modalCard, maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.2rem' }}>Bulk Grade All Submitted</h3>
                <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
                  Assign grades to all {gradingStudents.length} student(s) who turned in this activity.
                </p>
              </div>
              <button onClick={() => setShowBulkGradeModal(false)} style={styles.closeModalBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
              <div>
                <label style={styles.fieldLabel}>Grade (out of {maxPoints}):</label>
                <input
                  type="number"
                  min="0"
                  max={maxPoints}
                  value={bulkGradeVal}
                  onChange={(e) => setBulkGradeVal(e.target.value)}
                  style={{ ...styles.input, marginTop: '6px' }}
                />
              </div>

              <div>
                <label style={styles.fieldLabel}>Feedback for all submitted:</label>
                <textarea
                  value={bulkFeedbackVal}
                  onChange={(e) => setBulkFeedbackVal(e.target.value)}
                  style={{ ...styles.input, height: '80px', marginTop: '6px', resize: 'vertical' }}
                  placeholder="e.g. Great job on this activity!"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowBulkGradeModal(false)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkGrade}
                  style={styles.saveGradeBtn}
                >
                  Apply to All ({gradingStudents.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: CREATE / MODIFY ASSIGNMENT ═══ */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1f2937' }}>{editingId ? `Modify ${form.activityType}` : `Create ${form.activityType}`}</h2>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeModalBtn}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.fieldLabel}>Title</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={styles.input}
              />

              {form.activityType !== 'Material' && (
                <>
                  <div style={styles.labelRow}>
                    <label style={styles.fieldLabel}>Due Date</label>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={form.noDueDate}
                        onChange={(e) => setForm({ ...form, noDueDate: e.target.checked })}
                      />
                      No Due Date
                    </label>
                  </div>
                  <input
                    type="date"
                    disabled={form.noDueDate}
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    style={{ ...styles.input, opacity: form.noDueDate ? 0.5 : 1 }}
                  />
                </>
              )}

              <div style={styles.labelRow}>
                <label style={styles.fieldLabel}>Instruction</label>
                <div style={styles.attachIcons}>
                  <Link2 size={18} style={styles.attachIcon} title="Add link (Ctrl+K)" onMouseDown={(e) => handleAttachmentClick(e, handleAddLink)} />
                  <Image size={18} style={styles.attachIcon} title="Upload image" onMouseDown={(e) => handleAttachmentClick(e, () => imageInputRef.current?.click())} />
                  <Video size={18} style={styles.attachIcon} title="Upload video" onMouseDown={(e) => handleAttachmentClick(e, () => videoInputRef.current?.click())} />
                  <FileText size={18} style={styles.attachIcon} title="Upload document (PDF, DOC)" onMouseDown={(e) => handleAttachmentClick(e, () => docInputRef.current?.click())} />
                </div>
              </div>
              <div onDragOverCapture={(e) => e.preventDefault()} onDropCapture={handleDropCapture} onPasteCapture={handlePasteCapture}>
                <JoditEditor
                  ref={joditRef}
                  value={form.instruction}
                  config={joditConfig}
                  onBlur={newContent => setForm(prev => ({ ...prev, instruction: newContent }))}
                />
              </div>

              <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFilePicked(e, 'image')} />
              <input ref={videoInputRef} type="file" accept="video/*,.mp4,.webm,.mov,.m4v,.mkv" style={{ display: 'none' }} onChange={(e) => handleFilePicked(e, 'video')} />
              <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={(e) => handleFilePicked(e, 'document')} />

              {uploading && <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Uploading…</span>}

              {form.attachments?.length > 0 && (
                <div style={styles.attachmentList}>
                  {form.attachments.map((att, i) => (
                    <AttachmentCard
                      key={i}
                      att={att}
                      isDark={isDark}
                      onRemove={() => removeAttachment(i)}
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

              {form.activityType !== 'Material' && (
                <>
                  <label style={styles.fieldLabel}>Points</label>
                  <select
                    value={form.points}
                    onChange={(e) => setForm({ ...form, points: e.target.value })}
                    style={{ ...styles.input, width: '120px' }}
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                    <div>
                      <label style={styles.fieldLabel}>Time Limit (Minutes)</label>
                      <input
                        type="number"
                        min="5" max="300"
                        value={form.duration}
                        onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 60 })}
                        style={styles.input}
                      />
                    </div>
                    <div>
                      <label style={styles.fieldLabel}>Auto-Save Interval</label>
                      <select
                        value={form.autoSaveInterval}
                        onChange={(e) => setForm({ ...form, autoSaveInterval: e.target.value })}
                        style={styles.input}
                      >
                        <option value="10s">10 Seconds</option>
                        <option value="30s">30 Seconds</option>
                        <option value="1m">1 Minute</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ ...styles.labelRow, marginTop: '5px', marginBottom: '6px' }}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={form.treatWarningsAsErrors}
                        onChange={(e) => setForm({ ...form, treatWarningsAsErrors: e.target.checked })}
                      />
                      Treat compiler warnings as errors
                    </label>
                  </div>
                  <div style={{ ...styles.labelRow, marginTop: '2px', marginBottom: '12px' }}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={!!form.disableBack}
                        onChange={(e) => setForm({ ...form, disableBack: e.target.checked })}
                      />
                      <Lock size={14} style={{ marginRight: '5px', color: form.disableBack ? '#10b981' : (isDark ? '#a3a3a3' : '#6b7280'), verticalAlign: '-2px' }} />
                      Disable back button in student workspace
                    </label>
                  </div>
                {/* Automated Test Cases */}
                  <div style={{ marginTop: '12px', marginBottom: '14px', padding: '12px', backgroundColor: isDark ? '#262626' : '#f8fafc', borderRadius: '8px', border: isDark ? '1px solid #3c3c3c' : '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b' }}>Automated Test Cases (Optional)</span>
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#64748b' }}>Pre-configured test cases for students to validate their code against.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const list = Array.isArray(form.testCases) ? [...form.testCases] : [];
                        list.push({ id: `tc-${Date.now()}`, name: `Case ${list.length + 1}`, input: '', expectedOutput: '' });
                        setForm({ ...form, testCases: list });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
                        border: '1px solid #10b981',
                        borderRadius: '5px',
                        color: isDark ? '#6ee7b7' : '#059669',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      + Add Test Case
                    </button>
                  </div>

                  {Array.isArray(form.testCases) && form.testCases.map((tc, idx) => (
                    <div key={tc.id || idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>

                      <input
                        type="text"
                        placeholder="Expected Output (stdout)"
                        value={tc.expectedOutput || ''}
                        onChange={(e) => {
                          const list = [...form.testCases];
                          list[idx] = { ...list[idx], expectedOutput: e.target.value };
                          setForm({ ...form, testCases: list });
                        }}
                        style={{ ...styles.input, flex: 1, margin: 0, fontSize: '0.82rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const list = form.testCases.filter((_, i) => i !== idx);
                          setForm({ ...form, testCases: list });
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontSize: '0.9rem',
                          fontWeight: 'bold'
                        }}
                        title="Remove test case"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                </>
              )}

              <div style={styles.bottomRow}>
                {form.activityType !== 'Material' ? (
                  <div style={styles.gradingGroup}>
                    <span style={styles.fieldLabel}>Grading:</span>
                    <label style={styles.radioLabel}>
                      <input
                        type="radio"
                        name="grading"
                        checked={form.grading === 'On'}
                        onChange={() => setForm({ ...form, grading: 'On' })}
                      />
                      On
                    </label>
                    <label style={styles.radioLabel}>
                      <input
                        type="radio"
                        name="grading"
                        checked={form.grading === 'Off'}
                        onChange={() => setForm({ ...form, grading: 'Off' })}
                      />
                      Off
                    </label>
                  </div>
                ) : <div />}
                <button type="submit" style={styles.assignBtn}>{editingId ? 'Save' : 'Assign'}</button>
              </div>
            </form>
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

      <AddLinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onAdd={handleSaveLink}
        isDark={isDark}
      />

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
        classCode={classCode}
        onSuccess={() => setRefreshStudentsKey(k => k + 1)}
        isDark={isDark}
      />

      {/* In-System Delete Classwork Confirmation Modal */}
      <AnimatePresence>
        {deleteClassworkConfirm && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              backdropFilter: 'blur(5px)',
              padding: '20px'
            }}
            onClick={() => setDeleteClassworkConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{
                backgroundColor: isDark ? '#1e1e24' : '#ffffff',
                border: isDark ? '1px solid #333' : '1px solid #e5e7eb',
                borderRadius: '24px',
                padding: '28px',
                maxWidth: '420px',
                width: '100%',
                boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 20px 50px rgba(0,0,0,0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0
                }}>
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                    Delete Classwork
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                    Permanent removal confirmation
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '22px', color: isDark ? '#cbd5e1' : '#334155', fontSize: '0.9rem', lineHeight: '1.5' }}>
                <p style={{ margin: '0 0 10px 0' }}>
                  Are you sure you want to permanently delete this classwork item? This action cannot be undone.
                </p>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: isDark ? '#26262b' : '#f8fafc',
                  border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0',
                  fontWeight: '700',
                  color: isDark ? '#f87171' : '#dc2626'
                }}>
                  {deleteClassworkConfirm.title}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setDeleteClassworkConfirm(null)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: isDark ? '#2d2d38' : '#e2e8f0',
                    color: isDark ? '#cbd5e1' : '#475569',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  className="btn-anim"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDeleteClasswork}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
                    transition: 'all 0.2s ease'
                  }}
                  className="btn-anim"
                >
                  Delete Classwork
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ MODAL: VIEW MATERIAL DETAILS ═══ */}
      <AnimatePresence>
        {viewingMaterialModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              backdropFilter: 'blur(5px)',
              padding: '20px'
            }}
            onClick={() => setViewingMaterialModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                ...styles.modalCard,
                maxWidth: '750px',
                padding: '32px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Type Icon, Title, and Close Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                    flexShrink: 0
                  }}>
                    {(() => {
                      const lType = getLessonType(viewingMaterialModal);
                      if (lType === 'video') return <Video size={24} color={isDark ? '#fbbf24' : '#d97706'} />;
                      if (lType === 'link') return <Link2 size={24} color={isDark ? '#38bdf8' : '#0284c7'} />;
                      return <FileText size={24} color="#10b981" />;
                    })()}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      MATERIAL DETAILS
                    </span>
                    <h2 style={{ margin: '2px 0 0 0', fontSize: '1.4rem', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a', wordBreak: 'break-word' }}>
                      {viewingMaterialModal.title}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setViewingMaterialModal(null)}
                  style={{
                    ...styles.closeModalBtn,
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Meta information strip */}
              <div style={{
                backgroundColor: isDark ? '#262626' : '#f8fafc',
                border: isDark ? '1px solid #444' : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                flexWrap: 'wrap',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={16} color={isDark ? '#94a3b8' : '#64748b'} />
                  <span style={{ fontSize: '0.85rem', color: isDark ? '#cbd5e1' : '#334155', fontWeight: '600' }}>
                    Topic: <strong>{viewingMaterialModal.topic || 'General Material'}</strong>
                  </span>
                </div>
                <div style={{ width: '1px', height: '18px', backgroundColor: isDark ? '#404040' : '#e2e8f0' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} color="#10b981" />
                  <span style={{ fontSize: '0.85rem', color: isDark ? '#cbd5e1' : '#334155', fontWeight: '600' }}>
                    Posted: <strong>{formatShortDate(viewingMaterialModal.posted || viewingMaterialModal.id)}</strong>
                  </span>
                </div>
                {viewingMaterialModal.attachments?.length > 0 && (
                  <>
                    <div style={{ width: '1px', height: '18px', backgroundColor: isDark ? '#404040' : '#e2e8f0' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} color={isDark ? '#94a3b8' : '#64748b'} />
                      <span style={{ fontSize: '0.85rem', color: isDark ? '#cbd5e1' : '#334155', fontWeight: '600' }}>
                        {viewingMaterialModal.attachments.length} attachment{viewingMaterialModal.attachments.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Material Overview / Content */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                  Material Content & Description
                </h4>
                <div style={{
                  backgroundColor: isDark ? '#262626' : '#ffffff',
                  border: isDark ? '1px solid #3e3e3e' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px',
                  maxHeight: '320px',
                  overflowY: 'auto'
                }}>
                  {viewingMaterialModal.details ? (
                    <div
                      style={{ color: isDark ? '#d1d5db' : '#334155', fontSize: '0.95rem', lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: viewingMaterialModal.details }}
                      onClick={handleInstructionClick}
                    />
                  ) : (
                    <p style={{ margin: 0, color: isDark ? '#9ca3af' : '#64748b', fontSize: '0.9rem', fontStyle: 'italic' }}>
                      No description or written notes provided for this material.
                    </p>
                  )}
                </div>
              </div>

              {/* Attachments Section */}
              {viewingMaterialModal.attachments?.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                    Attached Resources ({viewingMaterialModal.attachments.length})
                  </h4>
                  <div style={styles.cardAttachments}>
                    {viewingMaterialModal.attachments.map((att, i) => (
                      <AttachmentCard
                        key={i}
                        att={att}
                        isDark={isDark}
                        onClick={(clickedAtt) => {
                          if (clickedAtt.type === 'image') setPreviewImage(clickedAtt);
                          else if (clickedAtt.type === 'video') setPreviewVideo(clickedAtt);
                          else if (clickedAtt.type === 'document' || clickedAtt.type === 'link') {
                            setPreviewIframe(clickedAtt);
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: isDark ? '1px solid #3e3e3e' : '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setViewingMaterialModal(null)}
                  style={styles.cancelBtn}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    const toEdit = viewingMaterialModal;
                    setViewingMaterialModal(null);
                    openModify(e, toEdit);
                  }}
                  style={{
                    ...styles.saveGradeBtn,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Edit3 size={15} /> Edit Material
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
          position: 'sticky',
          bottom: 0,
          zIndex: 60
        }}>
          {[
            { id: 'classrooms', Icon: Home, label: 'Home' },
            { id: 'calendar', Icon: Calendar, label: 'Calendar' },
            { id: 'archived', Icon: Archive, label: 'Archived' },
            { id: 'settings', Icon: Settings, label: 'Settings' }
          ].map(({ id, Icon, label }) => {
            return (
              <button
                key={id}
                onClick={() => {
                  if (id === 'settings') {
                    setIsSettingsModalOpen(true);
                  } else if (onNavigateView) {
                    onNavigateView(id);
                  } else {
                    onBack();
                  }
                }}
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
                <Icon size={20} style={{ marginBottom: '4px' }} />
                <span style={{ fontSize: '0.65rem', fontWeight: '600' }}>{label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </motion.div>
  );
}

// STYLES
const getStyles = (isDark) => ({
  container: {
    height: '100vh',
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isDark ? '#141615' : '#f4f5f7',
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    position: 'relative',
    overflow: 'hidden',
    transition: 'background-color 0.25s ease'
  },
  header: {
    height: '72px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    backgroundColor: isDark ? '#3C3C3C' : '#EEF0F3',
    zIndex: 50,
    transition: 'background-color 0.25s ease'
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
  
  // MAIN CONTENT & BIG BOX CONTAINER
  mainContent: {
    flex: 1,
    padding: '20px 24px 24px',
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
    border: isDark ? '1px solid #4A4A4A' : 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
    transition: 'background-color 0.25s ease'
  },

  // TOP NAVIGATION BAR INSIDE THE BIG BOX
  classroomNavHeader: {
    height: '56px',
    padding: '0 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#323232' : '#ffffff',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    flexShrink: 0,
    zIndex: 10,
    transition: 'background-color 0.25s ease'
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
  iconActionBtn: {
    background: 'none',
    border: 'none',
    padding: '8px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s ease'
  },

  // INNER SCROLL AREA INSIDE THE BIG BOX
  bigBoxInnerScroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '24px 28px 32px 28px'
  },

  // STREAM LAYOUT
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
  customizeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    backgroundColor: isDark ? '#3A3A3A' : '#ffffff',
    border: isDark ? '1px solid #4A4A4A' : 'none',
    borderRadius: '50px',
    padding: '8px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: isDark ? '#E8EAED' : '#1e293b',
    cursor: 'pointer',
    boxShadow: isDark 
      ? '0 0 14px rgba(255, 255, 255, 0.08), 0 2px 8px rgba(0,0,0,0.45)' 
      : '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    zIndex: 10,
    transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1), filter 0.18s ease'
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
    gap: '24px',
    alignItems: 'flex-start'
  },
  streamLeftCol: {
    width: '210px',
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
  sideCardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sideCardLabel: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: isDark ? '#E8EAED' : '#1e293b'
  },
  cardTinyActionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '3px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  classCodeDisplay: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#10b981',
    marginTop: '10px',
    letterSpacing: '0.04em',
    cursor: 'pointer'
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

  announceCard: {
    backgroundColor: isDark ? '#383838' : '#ffffff',
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    padding: '16px',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.02)'
  },
  announceCollapsed: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    cursor: 'pointer'
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
  announcePlaceholder: {
    fontSize: '0.9rem',
    color: isDark ? '#a3a3a3' : '#64748b',
    fontWeight: '500'
  },
  announceTextarea: {
    width: '100%',
    borderRadius: '8px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#323232' : '#ffffff',
    color: isDark ? '#E8EAED' : '#1e293b',
    padding: '10px',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box'
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    background: isDark ? '#464646' : '#f1f5f9',
    color: isDark ? '#E8EAED' : '#475569',
    fontWeight: '700',
    cursor: 'pointer'
  },
  postBtn: {
    padding: '8px 22px',
    borderRadius: '8px',
    border: 'none',
    background: '#10b981',
    color: 'white',
    fontWeight: '700',
    cursor: 'pointer'
  },

  streamFeedCard: {
    backgroundColor: isDark ? '#383838' : '#ffffff',
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    padding: '18px 20px',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.02)'
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
  streamCardDots: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px'
  },
  emptyFeedBox: {
    padding: '32px 20px',
    borderRadius: '12px',
    border: isDark ? '1px dashed #4A4A4A' : '1px dashed #cbd5e1',
    textAlign: 'center'
  },

  // Classwork Layout
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 0 20px 0',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    marginBottom: '24px'
  },
  addButton: { 
    display: 'flex', 
    alignItems: 'center', 
    padding: '10px 24px', 
    backgroundColor: '#10b981', 
    border: 'none', 
    borderRadius: '50px', 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: '0.95rem', 
    cursor: 'pointer', 
    boxShadow: isDark 
      ? '0 0 16px rgba(16, 185, 129, 0.35), 0 2px 6px rgba(0, 0, 0, 0.35)' 
      : '0 2px 6px rgba(16, 185, 129, 0.24), 0 1px 2px rgba(0, 0, 0, 0.05)',
    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease'
  },
  list: { display: 'flex', flexDirection: 'column', gap: '20px' },
  itemWrapper: { display: 'flex', flexDirection: 'column', gap: '10px' },
  itemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  titlePill: { display: 'flex', alignItems: 'center', backgroundColor: isDark ? '#383838' : '#f1f5f9', padding: '10px 20px', borderRadius: '50px', color: isDark ? '#E8EAED' : '#1e293b', fontWeight: '700', cursor: 'pointer', userSelect: 'none', transition: 'background 0.15s', border: isDark ? '1px solid #4A4A4A' : 'none' },
  itemDuePill: { marginLeft: '12px', fontSize: '0.75rem', color: isDark ? '#a3a3a3' : '#64748b', fontWeight: '600' },
  threeDots: { color: isDark ? '#a3a3a3' : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative' },
  dropdownMenu: { position: 'absolute', top: '28px', right: '0', backgroundColor: isDark ? '#323232' : '#ffffff', border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0', borderRadius: '12px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)', zIndex: 30, minWidth: '130px' },
  dropdownItem: { padding: '8px 14px', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' },

  detailCard: { backgroundColor: isDark ? '#323232' : 'white', borderRadius: '16px', padding: '0', border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0', boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.04)', overflow: 'hidden' },
  detailHeaderBar: { display: 'flex', alignItems: 'center', gap: '18px', backgroundColor: isDark ? '#383838' : '#f8fafc', padding: '18px 24px', borderRadius: '12px', margin: '12px', border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0' },
  detailTitle: { fontSize: '1.25rem', fontWeight: 'bold', color: isDark ? '#E8EAED' : '#1e293b' },
  detailDue: { fontSize: '0.85rem', color: isDark ? '#a3a3a3' : '#64748b', marginTop: '2px' },
  detailBody: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', padding: '5px 28px 20px 28px' },
  detailLeft: { flex: 1 },
  postedText: { fontSize: '0.8rem', color: isDark ? '#a3a3a3' : '#94a3b8', marginBottom: '8px' },
  detailInstruction: { margin: 0, color: isDark ? '#E8EAED' : '#334155', fontSize: '0.98rem', lineHeight: 1.5 },
  detailStats: { display: 'flex', alignItems: 'stretch', gap: '0', paddingLeft: '20px' },
  statCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 20px', minWidth: '70px' },
  statColDivider: { width: '1px', backgroundColor: isDark ? '#4A4A4A' : '#e2e8f0', alignSelf: 'stretch' },
  statNum: { fontSize: '1.4rem', fontWeight: 'bold', color: isDark ? '#E8EAED' : '#1e293b' },
  statLabel: { fontSize: '0.85rem', color: isDark ? '#a3a3a3' : '#64748b', marginTop: '4px' },
  detailDivider: { height: '1px', backgroundColor: isDark ? '#4A4A4A' : '#e2e8f0', margin: '0 28px' },
  detailFooter: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '16px 28px',
    gap: '12px',
    flexWrap: 'wrap'
  },
  viewActivityLink: { color: '#10b981', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '700' },
  viewGradingBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 20px',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
    border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0'}`,
    borderRadius: '50px',
    color: isDark ? '#34d399' : '#059669',
    fontWeight: '700',
    fontSize: '0.88rem',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    boxShadow: isDark
      ? '0 0 12px rgba(16, 185, 129, 0.12)'
      : '0 1px 3px rgba(16, 185, 129, 0.10)'
  },
  liveMonitorBtn: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '7px', 
    padding: '9px 22px', 
    backgroundColor: '#10b981', 
    border: 'none', 
    borderRadius: '50px', 
    color: '#ffffff', 
    fontWeight: '700', 
    fontSize: '0.88rem', 
    cursor: 'pointer', 
    boxShadow: isDark 
      ? '0 0 16px rgba(16, 185, 129, 0.35), 0 2px 6px rgba(0, 0, 0, 0.3)' 
      : '0 2px 8px rgba(16, 185, 129, 0.25), 0 1px 2px rgba(0, 0, 0, 0.05)',
    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease'
  },

  // People Tab
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
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #f1f5f9'
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

  // Grades Tab
  activitySelectionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
    width: '100%'
  },
  activityChipBtn: {
    padding: '7px 16px',
    borderRadius: '50px',
    border: 'none',
    fontSize: '0.84rem',
    cursor: 'pointer',
    maxWidth: '100%',
    lineHeight: 1.35,
    whiteSpace: 'normal',
    textAlign: 'left',
    transition: 'all 0.15s ease'
  },
  bulkGradeActionBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#10b981',
    color: 'white',
    fontWeight: '700',
    fontSize: '0.82rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
  },
  gradingColumnsLayout: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start'
  },
  gradingRosterCol: {
    width: '280px',
    flexShrink: 0,
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    overflow: 'hidden',
    backgroundColor: isDark ? '#383838' : '#f8fafc'
  },
  rosterHeaderBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#323232' : '#ffffff'
  },
  gradingStudentList: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '480px',
    overflowY: 'auto'
  },
  gradingStudentRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #f1f5f9',
    cursor: 'pointer',
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
    transition: 'all 0.15s'
  },
  gradeBadgeGraded: {
    fontSize: '0.75rem',
    color: isDark ? '#34d399' : '#059669',
    fontWeight: '700',
    backgroundColor: isDark ? '#133527' : '#ecfdf5',
    padding: '3px 8px',
    borderRadius: '6px'
  },
  gradeBadgeTurnedIn: {
    fontSize: '0.72rem',
    color: isDark ? '#60a5fa' : '#2563eb',
    fontWeight: '700',
    backgroundColor: isDark ? '#1e2d42' : '#eff6ff',
    padding: '3px 8px',
    borderRadius: '6px'
  },
  gradingEvalCol: {
    flex: 1,
    minWidth: 0,
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    padding: '24px',
    backgroundColor: isDark ? '#323232' : '#ffffff'
  },
  codePreviewPre: {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    padding: '16px',
    borderRadius: '10px',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '0.85rem',
    maxHeight: '220px',
    overflow: 'auto',
    margin: '6px 0 0 0'
  },
  playbackActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '6px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #cbd5e1',
    background: isDark ? '#3A3A3A' : 'white',
    color: isDark ? '#E8EAED' : '#334155',
    fontWeight: '700',
    fontSize: '0.8rem',
    cursor: 'pointer'
  },
  saveGradeBtn: {
    padding: '9px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
  },

  // Modal Common Styles
  modalOverlay: { 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.55)', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 100, 
    backdropFilter: 'blur(4px)',
    padding: '24px 16px',
    boxSizing: 'border-box'
  },
  modalCard: { 
    backgroundColor: isDark ? '#323232' : 'white', 
    padding: '28px 32px', 
    borderRadius: '20px', 
    width: '90%', 
    maxWidth: '800px', 
    maxHeight: '88vh',
    overflowY: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.5)' : '0 20px 40px rgba(0,0,0,0.2)', 
    border: isDark ? '1px solid #4A4A4A' : 'none' 
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  closeModalBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#a3a3a3' : '#9ca3af', padding: '4px' },
  form: { display: 'flex', flexDirection: 'column', gap: '8px' },
  input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: isDark ? '1px solid #4A4A4A' : '1px solid #d1d5db', backgroundColor: isDark ? '#3A3A3A' : 'white', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.95rem', boxSizing: 'border-box' },
  fieldLabel: { fontSize: '0.85rem', fontWeight: 'bold', color: isDark ? '#E8EAED' : '#475569', marginTop: '6px' },
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: isDark ? '#E8EAED' : '#4b5563', cursor: 'pointer' },
  attachIcons: { display: 'flex', gap: '12px', color: isDark ? '#a3a3a3' : '#6b7280' },
  attachIcon: { cursor: 'pointer' },
  attachmentList: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', 
    gap: '10px', 
    marginTop: '6px',
    width: '100%'
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
  bottomRow: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: '20px',
    paddingBottom: '4px'
  },
  gradingGroup: { display: 'flex', alignItems: 'center', gap: '15px' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', color: isDark ? '#E8EAED' : '#4b5563', cursor: 'pointer' },
  assignBtn: { padding: '10px 32px', backgroundColor: '#10b981', border: 'none', borderRadius: '50px', color: 'white', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(16,185,129,0.2)' },
  infoFieldRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #f1f5f9' },
  infoFieldLabel: { fontSize: '0.85rem', color: isDark ? '#a3a3a3' : '#64748b' },
  infoFieldValue: { fontSize: '0.92rem', color: isDark ? '#E8EAED' : '#1e293b', fontWeight: '600' }
});
