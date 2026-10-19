import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import JoditEditor from 'jodit-react';
import ProfileMenu from './ProfileMenu';
import { 
  Calendar, ClipboardList, Settings, User, MoreVertical, ArrowLeft, X, Link2, 
  Image, Video, Monitor, Menu, Home, Archive, Edit3, Maximize2, Copy, Check, 
  Info, Users, BookOpen, Sparkles, Plus, Send, ChevronRight, ChevronDown, CheckCircle2, 
  MessageSquare, PlayCircle, Eye, RefreshCw, Palette, ExternalLink, FileText,
  Paperclip, MoreHorizontal, Code2, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import Skeleton from '../components/Skeleton';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { isPhantomClassroom, mergeClassroomsPreservingOrder, THEME_PRESETS, getClassroomTheme, saveClassroomTheme, getClassroomStorageKey, getCachedClassrooms, saveCachedClassrooms, sortClassroomsAlphabetically } from '../utils/classroomUtils';
import ImagePreviewModal from '../components/ImagePreviewModal';
import AddLinkModal from '../components/AddLinkModal';
import VideoPreviewModal from '../components/VideoPreviewModal';
import IframePreviewModal from '../components/IframePreviewModal';
import AddStudentModal from '../components/AddStudentModal';
import VideoAttachment from '../components/VideoAttachment';
import AttachmentCard from '../components/AttachmentCard';
import { getStudentGrade, isStudentGraded, formatGradeScore } from '../utils/gradeUtils';

const EMPTY_FORM = { title: '', activityType: 'Activity', noDueDate: true, dueDate: '', instruction: '', points: '100', grading: 'On', attachments: [], duration: 60, autoSaveInterval: '30s', treatWarningsAsErrors: false, testCases: [] };

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
        const teacherClasses = serverList.filter(c => {
          const emailStr = (c.instructor_email || c.instructorEmail || '').toLowerCase();
          const matchesEmail = Boolean(currentUser?.email && emailStr && emailStr === currentUser.email.toLowerCase());
          const nameStr = (c.instructor || '').trim().toLowerCase();
          const curName = (currentUser?.name || '').trim().toLowerCase();
          const matchesName = Boolean(curName && nameStr && nameStr === curName);
          return matchesEmail || matchesName || (!emailStr && !nameStr);
        });
        const sortedTeacherClasses = sortClassroomsAlphabetically(teacherClasses);
        if (sortedTeacherClasses.length > 0 || classrooms.length === 0) {
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
    setTimeout(() => action(), 250);
  };
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, left: 0, width: 0, opacity: 0, transition: 'none' });
  const navRefs = useRef({});

  // Active classroom tab
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return sessionStorage.getItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`) || 'stream';
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
    }
  }, [classroom?.id]);

  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    const currentIdx = TAB_ORDER[activeTab] ?? 0;
    const newIdx = TAB_ORDER[newTab] ?? 0;
    setTabDirection(newIdx >= currentIdx ? 1 : -1);
    setTransitionMode('tab');
    setActiveTab(newTab);
    try {
      sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, newTab);
    } catch {}
  };

  const handleSelectClassroom = (cls, idx) => {
    if (cls.id === classroom?.id) return;
    const currentIdx = activeClassrooms.findIndex(c => c.id === classroom?.id);
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
    let cancelled = false;
    apiFetch(`${import.meta.env.VITE_API_URL}/classwork/${classroomId}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data.classwork)) {
          setClasswork(data.classwork.filter(item => !isLegacyHardcoded(item)));
        }
      })
      .catch(() => { /* offline — fall back to localStorage copy */ })
      .finally(() => { if (!cancelled) setLoadingClasswork(false); hydrated.current = true; });
    return () => { cancelled = true; };
  }, [classroomId]);

  useEffect(() => {
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

  // GRADES TAB STATE (Scoped to this classroom only)
  const visibleClasswork = classwork.filter(item => !item.archived && item.activityType !== 'Material');
  const visibleMaterials = classwork.filter(item => !item.archived && item.activityType === 'Material');

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
    const appendHtml = `<br/><a href="${linkAttachment.url}" target="_blank" rel="noopener noreferrer">${linkAttachment.name || linkAttachment.url}</a><br/>`;
    
    if (!insertAtMarker(appendHtml)) {
      setForm(prev => ({
        ...prev,
        instruction: (prev.instruction || "") + appendHtml
      }));
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

  const toggleMenu = (e, id) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === id ? null : id);
  };

  const handleDeleteClasswork = (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this classwork?")) {
      setClasswork(classwork.filter(c => c.id !== id));
    }
    setActiveMenu(null);
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
      testCases: Array.isArray(item.testCases) ? item.testCases : []
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
      testCases: Array.isArray(form.testCases) ? form.testCases : []
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

    // Default: Emerald Books (Matching user screenshot!)
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
    if (item.activityType === 'Material') {
      const att = item.attachments?.[0];
      if (att) {
        if (att.type === 'video') return Video;
        if (att.type === 'image') return Image;
        if (att.type === 'document') return FileText;
        if (att.type === 'link') return Link2;
      }
      return BookOpen;
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
        <div style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }} onClick={() => handleExit(() => onNavigateView ? onNavigateView('classrooms') : onBack())}>
          <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
          <span style={{ color: isDark ? '#f5f5f5' : '#111827', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
          <span style={{ fontSize: '0.7rem', color: isDark ? '#a3a3a3' : '#6b7280', marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructor</span>
        </div>

        {/* Center: Navigation */}
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
                handleExit(() => {
                  if (onNavigateView) onNavigateView(id); 
                  else onBack(); 
                });
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: '16px' }}>
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
                          style={{ position: 'absolute', inset: 0, borderRadius: '8px', background: ui.accentSoft }}
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
                      minHeight: isMobile ? '170px' : '230px',
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
                        <div style={{ position: 'relative', width: '150px', height: '90px', marginLeft: '-62px', marginTop: '2px', pointerEvents: 'none', zIndex: 1 }}>
                          {renderBannerIllustration()}
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
                          const active = classroom?.id === cls.id;
                          const badgeColor = BADGE_COLORS[idx % BADGE_COLORS.length];
                          const clsName = cls.name || 'Untitled';
                          return (
                            <button
                              key={cls.id}
                              className={active ? undefined : 'vt-class-row'}
                              onClick={() => { if (!active) handleSelectClassroom(cls, idx); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px',
                                width: isMobile ? 'auto' : '100%',
                                minWidth: isMobile ? '160px' : 'auto',
                                flexShrink: 0,
                                textAlign: 'left', cursor: active ? 'default' : 'pointer', fontFamily: 'inherit',
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
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 500, letterSpacing: '-0.01em', margin: '0 0 6px', color: ui.text }}>Classroom stream</h2>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: ui.muted }}>Assignments, learning materials, and activities in one place.</p>
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
                        const isMaterial = item.activityType === 'Material';
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

                        const badgeText = isMaterial ? 'Material' : (item.activityType || 'Classwork');
                        const badgeColor = isMaterial ? (isDark ? '#38bdf8' : '#0284c7') : ui.accentText;
                        const iconBg = isMaterial
                          ? (isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe')
                          : (isDark ? 'rgba(52, 211, 153, 0.12)' : '#ecfdf5');
                        const iconColor = isMaterial
                          ? (isDark ? '#38bdf8' : '#0284c7')
                          : ui.accentText;

                        return (
                          <motion.div 
                            key={item.id} 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="vt-card" style={{ background: ui.surface, border: `1px solid ${ui.border}`, borderRadius: '14px', overflow: 'hidden' }}>
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
                                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                  {/* Icon Container */}
                                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#dcfce7', border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginRight: '16px', flexShrink: 0 }}>
                                    {(() => {
                                      const IconComp = getMaterialIcon(item);
                                      return <IconComp size={18} />;
                                    })()}
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <span style={{ color: '#10b981', fontWeight: '700', fontSize: '0.82rem', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5', padding: '3px 8px', borderRadius: '6px', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5', flexShrink: 0 }}>
                                      {item.activityType || 'Assignment'}
                                    </span>
                                    <span style={{ color: isDark ? '#f5f5f5' : '#1e293b', fontSize: '1.05rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {item.title}
                                    </span>
                                  </div>
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
                                  <button
                                    style={{
                                      ...styles.viewGradingBtn,
                                      width: isMobile ? '100%' : 'auto',
                                      justifyContent: 'center'
                                    }}
                                    className="btn-anim"
                                    onClick={() => {
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
                                  <button
                                    style={{
                                      ...styles.liveMonitorBtn,
                                      width: isMobile ? '100%' : 'auto',
                                      justifyContent: 'center'
                                    }}
                                    className="btn-anim"
                                    onClick={(e) => { e.stopPropagation(); onStartMonitoring && onStartMonitoring(item); }}
                                    title="Open live proctoring & monitoring"
                                  >
                                    <Monitor size={16} /> Live Monitoring
                                  </button>
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
                        Upload and manage resources, syllabus, and study guides for {classroom?.name || 'this class'}.
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
                      <div style={{ padding: '40px 0', textAlign: 'center', color: isDark ? '#a3a3a3' : '#94a3b8' }}>
                        <div style={{ marginBottom: '16px' }}>
                          <FileText size={48} color={isDark ? '#525252' : '#94a3b8'} style={{ margin: '0 auto' }} />
                        </div>
                        <p style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '600', color: isDark ? '#e5e5e5' : '#334155' }}>No materials uploaded yet</p>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>Use the Create button to upload syllabus, readings, and reference documents.</p>
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
                                  {/* Icon Container */}
                                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#dcfce7', border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginRight: '16px', flexShrink: 0 }}>
                                    {(() => {
                                      let type = 'file';
                                      if (item.attachments && item.attachments.length > 0) type = item.attachments[0].type;
                                      if (type === 'video') return <Video size={18} />;
                                      if (type === 'image') return <Image size={18} />;
                                      if (type === 'link') return <Link2 size={18} />;
                                      return <FileText size={18} />;
                                    })()}
                                  </div>

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
                                    let type = 'file';
                                    if (item.attachments && item.attachments.length > 0) type = item.attachments[0].type;
                                    const props = { size: 30, color: isDark ? '#10b981' : '#4b5563' };
                                    if (type === 'video') return <Video {...props} />;
                                    if (type === 'image') return <Image {...props} />;
                                    if (type === 'link') return <Link2 {...props} />;
                                    return <FileText {...props} />;
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
                                              else if (clickedAtt.type === 'document') window.open(clickedAtt.url, '_blank', 'noopener,noreferrer');
                                              else if (clickedAtt.type === 'link' && clickedAtt.url) {
                                                const targetUrl = clickedAtt.url.startsWith('http://') || clickedAtt.url.startsWith('https://')
                                                  ? clickedAtt.url
                                                  : `https://${clickedAtt.url}`;
                                                window.open(targetUrl, '_blank', 'noopener,noreferrer');
                                              }
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
                                        onClick={() => onOpenPlayback && onOpenPlayback(activeGradingActivity, curStudent)}
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
        <div style={styles.modalOverlay} onClick={() => setIsSettingsModalOpen(false)}>
          <div style={{ ...styles.modalCard, maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={22} color="#10b981" />
                <h3 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.2rem' }}>Classroom Settings</h3>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} style={styles.closeModalBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
              <div>
                <label style={styles.fieldLabel}>Class details</label>
                <div style={{ padding: '12px', backgroundColor: isDark ? '#383838' : '#f8fafc', borderRadius: '10px', border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0', marginTop: '6px' }}>
                  <div style={{ fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b' }}>{classroom?.name || 'Classroom'}</div>
                  <div style={{ fontSize: '0.85rem', color: isDark ? '#a3a3a3' : '#64748b' }}>Section: {classroom?.section || 'None'} • Subject: {classroom?.subject || 'General'}</div>
                </div>
              </div>

              <div>
                <label style={styles.fieldLabel}>Invite code</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: isDark ? '#383838' : '#f8fafc', borderRadius: '10px', border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0', marginTop: '6px' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: isDark ? '#a3a3a3' : '#64748b', display: 'block' }}>Class code</span>
                    <strong style={{ fontSize: '1.1rem', color: '#10b981', letterSpacing: '0.05em' }}>{classCode}</strong>
                  </div>
                  <button
                    onClick={() => copyToClipboard(classCode)}
                    style={{ padding: '6px 12px', backgroundColor: isDark ? '#323232' : 'white', border: isDark ? '1px solid #4A4A4A' : '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#E8EAED' : '#1e293b' }}
                  >
                    {codeCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    {codeCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setIsSettingsModalOpen(false)} style={styles.saveGradeBtn}>
                Done
              </button>
            </div>
          </div>
        </div>
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
                  <div style={{ ...styles.labelRow, marginTop: '5px', marginBottom: '10px' }}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={form.treatWarningsAsErrors}
                        onChange={(e) => setForm({ ...form, treatWarningsAsErrors: e.target.checked })}
                      />
                      Treat compiler warnings as errors
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

      <AddStudentModal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        classroomId={classroom?.id}
        classCode={classCode}
        onSuccess={() => setRefreshStudentsKey(k => k + 1)}
        isDark={isDark}
      />
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
