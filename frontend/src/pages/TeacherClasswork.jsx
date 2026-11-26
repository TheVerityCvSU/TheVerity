import { useState, useEffect, useRef, useMemo } from 'react';
import ProfileMenu from './ProfileMenu';
import {
  Calendar, ClipboardList, Settings, Link2,
  Video, Home, Archive, Maximize2, Copy, Check,
  Lock, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { apiFetch, getLocalApiUrl, getCloudUrl, getConnectionStatus } from '../data/api';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { isPhantomClassroom, sortClassroomsAlphabetically, isClassroomArchived, normalizeClassroomSettings } from '../utils/classroomList';
import { getClassroomTheme } from '../data/classroomTheme';
import { getCachedClassrooms, saveCachedClassrooms } from '../data/classroomCache';
import { getLessonType } from '../utils/lessonType';
import { resolveMediaUrl, getActiveUploadBaseUrl, extractUploadPath } from '../utils/mediaUrl';
import { getStudentGrade } from '../utils/gradeUtils';
import { getStyles } from '../utils/teacherClassworkPageStyles';
import TeacherStreamTab from '../components/teacherClasswork/TeacherStreamTab';
import TeacherClassworkTab from '../components/teacherClasswork/TeacherClassworkTab';
import TeacherMaterialsTab from '../components/teacherClasswork/TeacherMaterialsTab';
import TeacherPeopleTab from '../components/teacherClasswork/TeacherPeopleTab';
import TeacherGradesTab from '../components/teacherClasswork/TeacherGradesTab';
import TeacherClassworkSecondaryModals from '../components/teacherClasswork/TeacherClassworkSecondaryModals';
import TeacherActivityFormModal from '../components/teacherClasswork/TeacherActivityFormModal';
import TeacherClassworkDetailModals from '../components/teacherClasswork/TeacherClassworkDetailModals';
import TeacherClassworkMobileNav from '../components/teacherClasswork/TeacherClassworkMobileNav';

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

  const [classrooms, setClassrooms] = useState(() => {
    return sortClassroomsAlphabetically(getCachedClassrooms(currentUser, 'teacher').filter(c => !isPhantomClassroom(c)));
  });
  const [archivedOverride, setArchivedOverride] = useState(null);
  const [prevArchClassId, setPrevArchClassId] = useState(classroom?.id);
  if (classroom?.id !== prevArchClassId) {
    setPrevArchClassId(classroom?.id);
    setArchivedOverride(null);
  }
  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    const loadClassroomsList = () => {
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
    };
    loadClassroomsList();

    const handleArchivedEvent = (e) => {
      const detail = e?.detail;
      if (!detail) return;
      const targetId = detail.classroomId ?? detail.id;
      if (targetId == null) return;
      const nextArchived = Boolean(detail.archived);
      setClassrooms(prev => {
        const updated = prev.map(c => (String(c.id) === String(targetId) ? { ...c, archived: nextArchived } : c));
        saveCachedClassrooms(updated, currentUser, 'teacher');
        return updated;
      });
      if (classroom?.id != null && String(classroom.id) === String(targetId)) {
        setArchivedOverride(nextArchived);
      }
    };

    window.addEventListener('verity:classroom-archived', handleArchivedEvent);
    window.addEventListener('verity:classrooms-changed', loadClassroomsList);
    return () => {
      window.removeEventListener('verity:classroom-archived', handleArchivedEvent);
      window.removeEventListener('verity:classrooms-changed', loadClassroomsList);
    };
  }, [currentUser, classroom?.id]);

  const liveClassroomObj = useMemo(
    () => classrooms.find(c => String(c.id) === String(classroom?.id)) || classroom,
    [classrooms, classroom]
  );
  const isClassroomArchivedState = archivedOverride !== null ? archivedOverride : isClassroomArchived(liveClassroomObj);

  const handleUnarchiveCurrentClassroom = async () => {
    const targetId = classroom?.id;
    if (!targetId) return;
    setArchivedOverride(false);
    setClassrooms(prev => {
      const updated = prev.map(c => (String(c.id) === String(targetId) ? { ...c, archived: false } : c));
      saveCachedClassrooms(updated, currentUser, 'teacher');
      return updated;
    });
    window.dispatchEvent(new CustomEvent('verity:classroom-archived', {
      detail: { classroomId: targetId, archived: false }
    }));
    await apiFetch(`${import.meta.env.VITE_API_URL}/classrooms/${targetId}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false })
    }).catch(() => {});
  };
  const [, setIsHeaderHovered] = useState(false);
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
  const [, setTransitionMode] = useState('tab'); // 'classroom' | 'tab'
  const [classroomDirection, setClassroomDirection] = useState(1);
  const [prevNavClassroomId, setPrevNavClassroomId] = useState(classroom?.id);

  if (classroom?.id && prevNavClassroomId !== classroom?.id) {
    setPrevNavClassroomId(classroom?.id);
    setTransitionMode('classroom');
    try {
      const savedTab = sessionStorage.getItem(`verity_teacher_classwork_tab_${classroom.id}`) ||
                       sessionStorage.getItem('verity_teacher_classwork_tab_active');
      if (savedTab && TAB_ORDER[savedTab] !== undefined) {
        setActiveTab(savedTab);
      }
    } catch {}
  }

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

  const [loadingClasswork, setLoadingClasswork] = useState(true);
  const lastSyncedClassworkRef = useRef(JSON.stringify(classwork || []));
  const [activeMenu, setActiveMenu] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedInstructionId, setExpandedInstructionId] = useState(null);
  const [submissionData, setSubmissionData] = useState({ counts: {}, studentCount: 0 });

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
            const mergedJson = JSON.stringify(merged);
            const prevJson = JSON.stringify(prev || []);
            if (mergedJson === prevJson) {
              return prev;
            }
            lastSyncedClassworkRef.current = mergedJson;
            if (offlineItems.length > 0) {
              // Auto-upload offline-created items to server immediately
              apiFetch(`${import.meta.env.VITE_API_URL}/classwork/${classroomId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  ...(socketRef.current?.id ? { 'X-Socket-ID': socketRef.current.id } : {})
                },
                body: JSON.stringify({ classwork: merged })
              }).catch(() => {});
            }
            try {
              localStorage.setItem(storageKey, mergedJson);
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
    const currentJson = JSON.stringify(classwork);
    if (currentJson === lastSyncedClassworkRef.current) {
      return; // Already in sync with server! Prevent infinite ping-pong loop!
    }
    lastSyncedClassworkRef.current = currentJson;
    localStorage.setItem(storageKey, currentJson);
    if (hydrated.current) {
      if (socket) {
        socket.emit('classwork_updated', { classroomId, classwork });
      }
      apiFetch(`${import.meta.env.VITE_API_URL}/classwork/${classroomId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(socket?.id ? { 'X-Socket-ID': socket.id } : {})
        },
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
              const mergedJson = JSON.stringify(merged);
              const prevJson = JSON.stringify(prev || []);
              if (mergedJson === prevJson || mergedJson === lastSyncedClassworkRef.current) {
                return prev; // IDENTICAL: DO NOT CHANGE STATE REFERENCE!
              }
              lastSyncedClassworkRef.current = mergedJson;
              try { localStorage.setItem(storageKey, mergedJson); } catch (_) {}
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

  const toggleExpand = (id) => setExpandedId(prev => (String(prev) === String(id) ? null : id));

  useEffect(() => {
    let active = true;
    const load = () => {
      const url = (classroomId && classroomId !== 'default')
        ? `${import.meta.env.VITE_API_URL}/submission-counts?classroomId=${classroomId}`
        : `${import.meta.env.VITE_API_URL}/submission-counts`;
      apiFetch(url)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (active && data) {
            setSubmissionData({ counts: data.counts || {}, studentCount: data.studentCount || 0 });
          }
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      load();
    }, 30000);

    if (socket) {
      socket.on('submission_updated', load);
      socket.on('submission_deleted', load);
      socket.on('student_unsubmitted', load);
      socket.on('teacher_receive_submission', load);
      socket.on('classroom_students_changed', load);
    }

    return () => {
      active = false;
      clearInterval(interval);
      if (socket) {
        socket.off('submission_updated', load);
        socket.off('submission_deleted', load);
        socket.off('student_unsubmitted', load);
        socket.off('teacher_receive_submission', load);
        socket.off('classroom_students_changed', load);
      }
    };
  }, [classroomId, socket]);

  // Real-time active students tracking per activity & classroom
  const [activeActivityCounts, setActiveActivityCounts] = useState({});
  const [, setActiveClassroomCounts] = useState({});

  const getActiveCountForActivity = (item) => {
    if (!item) return 0;
    const idStr = String(item.id ?? '');
    if (idStr && Number(activeActivityCounts[idStr]) > 0) {
      return Number(activeActivityCounts[idStr]);
    }
    const altId = item.assignmentId ?? item.assignment_id ?? item._id;
    if (altId != null && Number(activeActivityCounts[String(altId)]) > 0) {
      return Number(activeActivityCounts[String(altId)]);
    }
    return 0;
  };

  useEffect(() => {
    let isSubscribed = true;
    let secSocket = null;
    const sourceCountsRef = { primary: {}, secondary: {}, liveStudents: {} };
    const sourceClassCountsRef = { primary: {}, secondary: {} };

    const recomputeMerged = () => {
      if (!isSubscribed) return;
      const mergedCounts = {};
      const allKeys = new Set([
        ...Object.keys(sourceCountsRef.primary || {}),
        ...Object.keys(sourceCountsRef.secondary || {})
      ]);
      for (const k of allKeys) {
        const val = Math.max(
          Number(sourceCountsRef.primary?.[k] || 0),
          Number(sourceCountsRef.secondary?.[k] || 0)
        );
        if (val > 0) mergedCounts[k] = val;
      }

      // Also count recently seen live student events (within last 20s) in case HTTP poll hasn't caught up
      const now = Date.now();
      const liveByAssignment = {};
      for (const [sKey, info] of Object.entries(sourceCountsRef.liveStudents)) {
        if (!info || now - info.ts > 20000) {
          delete sourceCountsRef.liveStudents[sKey];
          continue;
        }
        const aId = String(info.assignmentId);
        liveByAssignment[aId] = (liveByAssignment[aId] || 0) + 1;
      }
      for (const [aId, count] of Object.entries(liveByAssignment)) {
        mergedCounts[aId] = Math.max(Number(mergedCounts[aId] || 0), count);
      }

      setActiveActivityCounts(mergedCounts);

      const mergedClassCounts = {};
      const classKeys = new Set([
        ...Object.keys(sourceClassCountsRef.primary || {}),
        ...Object.keys(sourceClassCountsRef.secondary || {})
      ]);
      for (const k of classKeys) {
        const val = Math.max(
          Number(sourceClassCountsRef.primary?.[k] || 0),
          Number(sourceClassCountsRef.secondary?.[k] || 0)
        );
        if (val > 0) mergedClassCounts[k] = val;
      }
      setActiveClassroomCounts(mergedClassCounts);
    };

    const handlePrimaryActiveUpdate = (data) => {
      if (!data) return;
      if (data.counts) sourceCountsRef.primary = data.counts;
      if (data.classroomCounts) sourceClassCountsRef.primary = data.classroomCounts;
      recomputeMerged();
    };

    const handleSecondaryActiveUpdate = (data) => {
      if (!data) return;
      if (data.counts) sourceCountsRef.secondary = data.counts;
      if (data.classroomCounts) sourceClassCountsRef.secondary = data.classroomCounts;
      recomputeMerged();
    };

    const handleStudentUpdate = (data) => {
      if (!data || !data.assignmentId || data.assignmentId === 'none' || data.assignmentId === 'unassigned') return;
      if (data.isLive === false || data.status === 'Offline' || data.status === 'Submitted') return;
      const sId = String(data.studentId || data.id || data.name || data.studentName || '');
      if (!sId) return;
      sourceCountsRef.liveStudents[`${sId}_${data.assignmentId}`] = {
        assignmentId: String(data.assignmentId),
        classroomId: String(data.classroomId || ''),
        ts: Date.now()
      };
      recomputeMerged();
    };

    const handleStudentLeftOrSubmitted = (data) => {
      if (!data) return;
      const sId = String(data.studentId || data.id || data.name || data.studentName || '');
      if (sId) {
        for (const key of Object.keys(sourceCountsRef.liveStudents)) {
          if (key.startsWith(`${sId}_`)) {
            delete sourceCountsRef.liveStudents[key];
          }
        }
      }
      if (socket) socket.emit('get_active_activities');
      if (secSocket && secSocket.connected) secSocket.emit('get_active_activities');
      recomputeMerged();
    };

    if (socket) {
      socket.on('active_activities_update', handlePrimaryActiveUpdate);
      socket.on('teacher_update_code', handleStudentUpdate);
      socket.on('teacher_student_left', handleStudentLeftOrSubmitted);
      socket.on('teacher_receive_submission', handleStudentLeftOrSubmitted);
      socket.emit('get_active_activities');
    }

    try {
      const conn = getConnectionStatus();
      const localUrl = getLocalApiUrl();
      const cloudUrl = getCloudUrl();
      const primaryUri = socket?.io?.uri || '';

      let altTarget = null;
      if (primaryUri.includes('localhost') || primaryUri.includes('127.0.0.1') || primaryUri.includes('192.168.')) {
        if (conn.isOnline && cloudUrl && !cloudUrl.includes('localhost') && !cloudUrl.includes('127.0.0.1')) {
          altTarget = cloudUrl;
        }
      } else {
        if (!conn.isWebHosted && localUrl && !localUrl.includes('verity-2z4v')) {
          altTarget = localUrl;
        }
      }

      if (altTarget && altTarget !== primaryUri) {
        secSocket = io(altTarget, {
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          timeout: 5000,
          transports: ['websocket', 'polling'],
          auth: (cb) => {
            const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
            cb({ token });
          }
        });
        secSocket.on('connect', () => {
          const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
          secSocket.emit('authenticate', { token });
          secSocket.emit('get_active_activities');
        });
        secSocket.on('active_activities_update', handleSecondaryActiveUpdate);
        secSocket.on('teacher_update_code', handleStudentUpdate);
        secSocket.on('teacher_student_left', handleStudentLeftOrSubmitted);
        secSocket.on('teacher_receive_submission', handleStudentLeftOrSubmitted);
      }
    } catch (_) {}

    const fetchActive = () => {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      apiFetch(`${baseUrl}/active-activities`)
        .then(res => (res && res.ok ? res.json() : null))
        .then(data => {
          if (data) {
            if (data.counts) sourceCountsRef.primary = data.counts;
            if (data.classroomCounts) sourceClassCountsRef.primary = data.classroomCounts;
            recomputeMerged();
          }
        })
        .catch(() => {});

      try {
        const conn = getConnectionStatus();
        const localUrl = getLocalApiUrl();
        if (!conn.isWebHosted && localUrl && !localUrl.includes('verity-2z4v')) {
          const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
          fetch(`${localUrl}/active-activities`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          })
            .then(r => (r && r.ok ? r.json() : null))
            .then(data => {
              if (data) {
                if (data.counts) sourceCountsRef.secondary = data.counts;
                if (data.classroomCounts) sourceClassCountsRef.secondary = data.classroomCounts;
                recomputeMerged();
              }
            })
            .catch(() => {});
        }
      } catch (_) {}
    };

    fetchActive();
    const activeInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchActive();
    }, 20000);

    return () => {
      isSubscribed = false;
      if (socket) {
        socket.off('active_activities_update', handlePrimaryActiveUpdate);
        socket.off('teacher_update_code', handleStudentUpdate);
        socket.off('teacher_student_left', handleStudentLeftOrSubmitted);
        socket.off('teacher_receive_submission', handleStudentLeftOrSubmitted);
      }
      if (secSocket) {
        try {
          secSocket.off('active_activities_update', handleSecondaryActiveUpdate);
          secSocket.off('teacher_update_code', handleStudentUpdate);
          secSocket.off('teacher_student_left', handleStudentLeftOrSubmitted);
          secSocket.off('teacher_receive_submission', handleStudentLeftOrSubmitted);
          secSocket.disconnect();
        } catch (_) {}
      }
      clearInterval(activeInterval);
    };
  }, [classroom?.id, socket]);

  // Modal dialog & live classroom state
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isClassCodeModalOpen, setIsClassCodeModalOpen] = useState(false);
  const [isClassInfoModalOpen, setIsClassInfoModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [currentClassroom, setCurrentClassroom] = useState(classroom);
  const [prevCurClsId, setPrevCurClsId] = useState(classroom?.id);
  const classroomPropRef = useRef(classroom);

  if (classroom?.id !== prevCurClsId) {
    setPrevCurClsId(classroom?.id);
    setCurrentClassroom(classroom);
  }

  useEffect(() => {
    classroomPropRef.current = classroom;
  }, [classroom]);

  useEffect(() => {
    const handleClassroomUpdatedEvent = (e) => {
      const incoming = e?.detail?.classroom;
      if (!incoming || classroom?.id == null) return;
      if (String(incoming.id) === String(classroom.id)) {
        setCurrentClassroom(prev => ({ ...(prev || classroomPropRef.current), ...incoming }));
      }
    };
    window.addEventListener('verity:classroom-updated', handleClassroomUpdatedEvent);
    return () => window.removeEventListener('verity:classroom-updated', handleClassroomUpdatedEvent);
  }, [classroom?.id]);

  const displayClassroom = currentClassroom || liveClassroomObj || classroom;
  const classSettings = useMemo(
    () => normalizeClassroomSettings(displayClassroom?.settings),
    [displayClassroom?.settings]
  );

  // Class code & theme
  const classCode = displayClassroom?.code || displayClassroom?.section || (displayClassroom?.id ? `vji${displayClassroom.id}ku4` : 'vji3bku4');
  const [bannerTheme, setBannerTheme] = useState(() => getClassroomTheme(displayClassroom));
  const bannerThemeSyncKey = `${displayClassroom?.id ?? ''}|${displayClassroom?.code ?? ''}|${displayClassroom?.section ?? ''}|${displayClassroom?.name ?? ''}|${typeof displayClassroom?.theme === 'string' ? displayClassroom.theme : JSON.stringify(displayClassroom?.theme || null)}`;
  const [prevBannerThemeSyncKey, setPrevBannerThemeSyncKey] = useState(bannerThemeSyncKey);

  // Reset banner theme when classroom changes
  if (bannerThemeSyncKey !== prevBannerThemeSyncKey) {
    setPrevBannerThemeSyncKey(bannerThemeSyncKey);
    setBannerTheme(getClassroomTheme(displayClassroom));
  }

  // Real-time socket & window theme updates listener
  const displayClassroomRef = useRef(displayClassroom);
  useEffect(() => {
    displayClassroomRef.current = displayClassroom;
  }, [displayClassroom]);

  useEffect(() => {
    const handleUpdate = (e) => {
      const detail = e.detail;
      const curDisp = displayClassroomRef.current;
      if (!detail) return;
      const matches =
        (curDisp?.id != null && String(detail.classroomId) === String(curDisp.id)) ||
        (curDisp?.code && detail.code && String(detail.code).toLowerCase() === String(curDisp.code).toLowerCase()) ||
        (curDisp?.section && detail.code && String(detail.code).toLowerCase() === String(curDisp.section).toLowerCase()) ||
        (curDisp?.name && detail.name && String(detail.name).toLowerCase() === String(curDisp.name).toLowerCase()) ||
        (detail.keys && detail.keys.includes(`verity_classroom_theme_${curDisp?.id}`));

      if (matches && detail.theme) {
        setBannerTheme(detail.theme);
      }
    };

    const handleSocketTheme = (data) => handleUpdate({ detail: data });
    window.addEventListener('verity:banner-updated', handleUpdate);
    if (socket) {
      socket.on('classroom_theme_changed', handleSocketTheme);
    }
    return () => {
      window.removeEventListener('verity:banner-updated', handleUpdate);
      if (socket) {
        socket.off('classroom_theme_changed', handleSocketTheme);
      }
    };
  }, [socket]);

  const handleUpdateClassroom = (updated) => {
    const merged = { ...(displayClassroom || {}), ...updated };
    setCurrentClassroom(merged);
    setClassrooms(prev => {
      const updatedList = sortClassroomsAlphabetically(
        (prev || []).map(c => (String(c.id) === String(merged.id) ? { ...c, ...merged } : c))
      );
      saveCachedClassrooms(updatedList, currentUser, 'teacher');
      return updatedList;
    });
  };
  const [codeCopied, setCodeCopied] = useState(false);
  
  const [allowManageStudents, setAllowManageStudents] = useState(true);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const applyPermission = (settingsObj) => {
      if (!active || !settingsObj) return;
      const config = settingsObj.global_config || settingsObj;
      if (config?.roles && typeof config.roles.allowManageStudents === 'boolean') {
        const nextAllowed = config.roles.allowManageStudents;
        setAllowManageStudents(nextAllowed);
        if (!nextAllowed) {
          setIsAddStudentOpen(false);
        }
      }
    };

    const fetchPermission = () => {
      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`)
        .then(res => (res.ok ? res.json() : null))
        .then(d => {
          if (d?.settings) applyPermission(d.settings);
        })
        .catch(() => {});
    };

    fetchPermission();

    const handleSocketSettings = (payload) => {
      if (payload?.settings) applyPermission(payload.settings);
      else fetchPermission();
    };
    const handleFocusOrServer = () => fetchPermission();

    if (socket) socket.on('system_settings_updated', handleSocketSettings);
    window.addEventListener('focus', handleFocusOrServer);
    window.addEventListener('verity:server-changed', handleFocusOrServer);
    window.addEventListener('verity:sync-completed', handleFocusOrServer);

    return () => {
      active = false;
      if (socket) socket.off('system_settings_updated', handleSocketSettings);
      window.removeEventListener('focus', handleFocusOrServer);
      window.removeEventListener('verity:server-changed', handleFocusOrServer);
      window.removeEventListener('verity:sync-completed', handleFocusOrServer);
    };
  }, [socket]);
  const [originalBannerTheme, setOriginalBannerTheme] = useState(null);



  // Enrolled students and Instructor Info for People tab
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const sortedEnrolledStudents = useMemo(() => {
    return [...enrolledStudents].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }, [enrolledStudents]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [refreshStudentsKey, setRefreshStudentsKey] = useState(0);
  const [prevPeopleLoadKey, setPrevPeopleLoadKey] = useState(null);
  const peopleLoadKey = `${classroom?.id ?? ''}|${refreshStudentsKey}`;
  if (classroom?.id && peopleLoadKey !== prevPeopleLoadKey) {
    setPrevPeopleLoadKey(peopleLoadKey);
    setLoadingStudents(true);
  }
  const [instructorInfo, setInstructorInfo] = useState({
    name: classroom?.instructor || (currentUser?.role === 'Teacher' ? currentUser.name : ''),
    email: classroom?.instructorEmail || classroom?.instructor_email || (currentUser?.role === 'Teacher' ? currentUser.email : ''),
    avatar: (currentUser?.role === 'Teacher' && currentUser?.avatar) ? currentUser.avatar : null
  });

  useEffect(() => {
    if (!classroom?.id) return;

    const loadStudents = async () => {
      const studentsMap = {};
      const nameToKey = {};
      const upsertStudent = (rawName, rawEmail, avatar = null) => {
        const cleanName = String(rawName || '').trim();
        if (!cleanName) return;
        const nameKey = cleanName.toLowerCase();
        const cleanEmail = String(rawEmail || '').trim().toLowerCase();
        const hasRealEmail = cleanEmail.includes('@') && !cleanEmail.endsWith('@student.verity.edu');
        const key = hasRealEmail
          ? cleanEmail
          : (nameToKey[nameKey] || nameKey);
        if (hasRealEmail && nameToKey[nameKey] && !studentsMap[cleanEmail] && studentsMap[nameToKey[nameKey]]?.email?.endsWith('@student.verity.edu')) {
          delete studentsMap[nameToKey[nameKey]];
          nameToKey[nameKey] = cleanEmail;
        }
        const resolvedEmail = hasRealEmail ? cleanEmail : `${nameKey.replace(/\s+/g, '.')}@student.verity.edu`;
        studentsMap[key] = {
          name: cleanName,
          email: resolvedEmail,
          avatar: avatar || studentsMap[key]?.avatar || null
        };
        if (!nameToKey[nameKey]) nameToKey[nameKey] = key;
      };

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
                  upsertStudent(studentName, '');
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
                upsertStudent(s.name, s.email, s.avatar || null);
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
                upsertStudent(s.name, s.email, s.avatar || null);
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
      socket.on('classroom_students_changed', loadStudents);
    }

    return () => {
      if (socket) {
        socket.off('user_avatar_updated', handleAvatarBroadcast);
        socket.off('classroom_students_changed', loadStudents);
      }
    };
  }, [classroom?.id, classCode, classroom?.section, socket, currentUser, refreshStudentsKey]);

  const isMaterialItem = (item) => Boolean(item && (item.activityType === 'Material' || String(item.activityType || '').toLowerCase() === 'material' || String(item.type || '').toLowerCase() === 'material'));

  const showDeletedItems = Boolean(classSettings?.showDeleted);
  const isRemovedItem = (item) => Boolean(item && (item.archived || item.deleted));

  // GRADES TAB STATE (Scoped to this classroom only)
  const visibleClasswork = useMemo(
    () => classwork.filter(item => !isMaterialItem(item) && (showDeletedItems || !isRemovedItem(item))),
    [classwork, showDeletedItems]
  );
  const visibleMaterials = useMemo(
    () => classwork.filter(item => isMaterialItem(item) && (showDeletedItems || !isRemovedItem(item))),
    [classwork, showDeletedItems]
  );

  // STREAM FEED STATE: obeys Classroom Settings -> Classwork on the Stream & Show deleted items
  const visibleStreamItems = useMemo(() => {
    if (classSettings?.classworkStream === 'Hide notifications') {
      return [];
    }
    return classwork
      .filter(item => showDeletedItems || !isRemovedItem(item))
      .sort((a, b) => {
        const timeA = new Date(a.posted || a.createdAt || (typeof a.id === 'number' && a.id > 1e12 ? a.id : 0)).getTime() || 0;
        const timeB = new Date(b.posted || b.createdAt || (typeof b.id === 'number' && b.id > 1e12 ? b.id : 0)).getTime() || 0;
        return timeB - timeA;
      });
  }, [classwork, classSettings?.classworkStream, showDeletedItems]);

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
  const [isGradesActivityDropdownOpen, setIsGradesActivityDropdownOpen] = useState(false);
  const gradesActivityDropdownRef = useRef(null);

  useEffect(() => {
    if (!isGradesActivityDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (gradesActivityDropdownRef.current && !gradesActivityDropdownRef.current.contains(e.target)) {
        setIsGradesActivityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isGradesActivityDropdownOpen]);

  const [prevGradActivityId, setPrevGradActivityId] = useState(activeGradingActivity?.id);
  if (activeGradingActivity?.id !== prevGradActivityId) {
    setPrevGradActivityId(activeGradingActivity?.id);
    if (!activeGradingActivity?.id) {
      setGradingStudents([]);
    }
  }

  // Load ONLY students who have submitted this activity for this classroom
  useEffect(() => {
    if (!activeGradingActivity?.id) {
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
          setSelectedStudentId(prev => (prev && map[prev] ? prev : (list[0]?.id || null)));
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

  const curStudentForGrade = selectedStudentId ? gradingStudents.find(s => s.id === selectedStudentId) : null;
  const savedGradeItem = selectedStudentId ? getStudentGrade(gradingGrades, curStudentForGrade || selectedStudentId) : null;
  const studentGradeSyncKey = `${selectedStudentId ?? ''}|${savedGradeItem?.grade ?? ''}|${savedGradeItem?.feedback ?? ''}|${maxPoints}`;
  const [prevStudentGradeSyncKey, setPrevStudentGradeSyncKey] = useState(null);
  if (studentGradeSyncKey !== prevStudentGradeSyncKey) {
    setPrevStudentGradeSyncKey(studentGradeSyncKey);
    if (selectedStudentId) {
      setStudentGradeInput(savedGradeItem?.grade != null ? String(savedGradeItem.grade) : String(maxPoints));
      setStudentFeedbackInput(savedGradeItem?.feedback || '');
      setIndivSaveStatus('idle');
      setIndivSaveError('');
    }
  }

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
  const [pasteCodeModal, setPasteCodeModal] = useState(null);
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
        } catch {}
      }
    }
    callback();
  };

  const uploadFile = async (file, type) => {
    const filename = file.name;
    const cleanFilename = encodeURIComponent(filename);
    const uploadBase = getActiveUploadBaseUrl() || getLocalApiUrl();
    let lastError = 'Failed to upload file to server. Please check your connection and try again.';

    // 1. Direct binary streaming upload (fast, supports 100MB+ MP4/WebM/MOV)
    try {
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      const headers = { 'X-Filename': filename };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${uploadBase}/upload-raw?filename=${cleanFilename}`, {
        method: 'POST',
        headers,
        body: file
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url || data.path) {
          const canonicalPath = data.path || extractUploadPath(data.url) || data.url;
          const canonicalThumb = data.thumbnailPath || (data.thumbnailUrl ? extractUploadPath(data.thumbnailUrl) : null) || data.thumbnailUrl;
          return { type, name: filename, url: canonicalPath, thumbnailUrl: canonicalThumb };
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData?.message) lastError = errData.message;
      }
    } catch (rawErr) {
      console.warn('Direct stream upload failed, trying base64...', rawErr);
      if (rawErr?.message) lastError = rawErr.message;
    }

    // 2. Base64 fallback to /upload (for smaller images/clips)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${uploadBase}/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ filename, dataUrl })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url || data.path) {
          const canonicalPath = data.path || extractUploadPath(data.url) || data.url;
          const canonicalThumb = data.thumbnailPath || (data.thumbnailUrl ? extractUploadPath(data.thumbnailUrl) : null) || data.thumbnailUrl;
          return { type, name: filename, url: canonicalPath, thumbnailUrl: canonicalThumb };
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData?.message) lastError = errData.message;
      }
    } catch (b64Err) {
      console.warn('Base64 fallback failed:', b64Err);
      if (b64Err?.message) lastError = b64Err.message;
    }

    // Never save a session-only blob: URL into the database (breaks across devices & Incognito)
    throw new Error(lastError);
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
    try {
      const attachment = await uploadFile(file, type);

      // Always register in attachments list so it shows as an attached resource
      setForm(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), attachment]
      }));

      if (type === 'image') {
        const resolvedImg = resolveMediaUrl(attachment.url);
        const appendHtml = `<br/><img src="${resolvedImg}" alt="${attachment.name}" style="max-width: 100%; height: auto; border-radius: 8px;" /><br/>`;
        if (!insertAtMarker(appendHtml)) {
          setForm(prev => ({
            ...prev,
            instruction: (prev.instruction || "") + appendHtml
          }));
        }
      }
    } catch (err) {
      alert(err?.message || 'Upload failed. Please verify the file format and server connection.');
    } finally {
      setUploading(false);
    }
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
      
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            const type = file.type.startsWith('image/') ? 'image' : 'video';
            const attachment = await uploadFile(file, type);
            setForm(prev => ({
              ...prev,
              attachments: [...(prev.attachments || []), attachment]
            }));
            if (type === 'image') {
              const resolvedImg = resolveMediaUrl(attachment.url);
              const appendHtml = `<br/><img src="${resolvedImg}" alt="${attachment.name}" style="max-width: 100%; height: auto; border-radius: 8px;" /><br/>`;
              if (editorObj?.s) {
                editorObj.s.insertHTML(appendHtml);
              }
            }
          }
        }
      } catch (err) {
        alert(err?.message || 'Upload failed. Please verify the file format and server connection.');
      } finally {
        setUploading(false);
      }
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
      
      try {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
            const file = item.getAsFile();
            if (!file) continue;
            const type = item.type.startsWith('image/') ? 'image' : 'video';
            const attachment = await uploadFile(file, type);
            setForm(prev => ({
              ...prev,
              attachments: [...(prev.attachments || []), attachment]
            }));
            if (type === 'image') {
              const resolvedImg = resolveMediaUrl(attachment.url);
              const appendHtml = `<br/><img src="${resolvedImg}" alt="${attachment.name}" style="max-width: 100%; height: auto; border-radius: 8px;" /><br/>`;
              const editorObj = joditRef.current;
              if (editorObj?.s) {
                if (editorObj.editor?.focus) editorObj.editor.focus();
                else if (editorObj.focus) editorObj.focus();
                editorObj.s.insertHTML(appendHtml);
              }
            }
          }
        }
      } catch (err) {
        alert(err?.message || 'Upload failed. Please verify the file format and server connection.');
      } finally {
        setUploading(false);
      }
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
  const [archiveClassworkConfirm, setArchiveClassworkConfirm] = useState(null);

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
    const existingItem = classwork.find(c => String(c.id) === String(toDeleteId));
    const isAlreadyRemoved = Boolean(existingItem && (existingItem.deleted || existingItem.archived));

    setClasswork(prev => {
      const next = isAlreadyRemoved
        ? prev.filter(c => String(c.id) !== String(toDeleteId))
        : prev.map(c => (String(c.id) === String(toDeleteId) ? { ...c, deleted: true, deletedAt: new Date().toISOString() } : c));
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
    apiFetch(`${import.meta.env.VITE_API_URL}/classwork/${classroomId}/${toDeleteId}${isAlreadyRemoved ? '' : '?soft=1'}`, {
      method: 'DELETE'
    }).catch(() => {});
    setDeleteClassworkConfirm(null);
  };

  const handleRestoreClasswork = (e, id) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    setClasswork(prev => prev.map(item => (
      String(item.id) === String(id)
        ? { ...item, deleted: false, deletedAt: null, archived: false }
        : item
    )));
    setActiveMenu(null);
  };

  const openCreate = async (type = 'Activity') => {
    if (isClassroomArchivedState) return;
    setEditingId(null);
    let defaults = { ...EMPTY_FORM, activityType: type };
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`);
      if (res.ok) {
        const data = await res.json();
        const examDefaults = data?.settings?.global_config?.examDefaults || data?.settings?.examDefaults;
        if (examDefaults) {
          defaults.autoSaveInterval = examDefaults.autoSaveInterval || '30s';
          defaults.treatWarningsAsErrors = !!examDefaults.treatWarningsAsErrors;
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
    } catch {}

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
    const item = classwork.find(c => c.id === id);
    setArchiveClassworkConfirm({
      id,
      title: item?.title || 'this item',
      itemType: isMaterialItem(item) ? 'material' : 'activity'
    });
    setActiveMenu(null);
  };

  const handleExecuteArchiveClasswork = () => {
    if (!archiveClassworkConfirm) return;
    const toArchiveId = archiveClassworkConfirm.id;
    setClasswork(classwork.map(item => (item.id === toArchiveId ? { ...item, archived: true } : item)));
    setArchiveClassworkConfirm(null);
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

  const joditConfig = useMemo(() => {
    const toolbarRows = [
      'bold', 'italic', 'underline', 'strikethrough', '|', 'inlineCode', 'codeBox', '|', 'ul', 'ol', '|', 'undo', 'redo',
      '\n',
      'font', 'fontsize', 'brush', 'paragraph', '|', 'table', '|', 'eraser'
    ];
    return {
      readonly: false,
      theme: isDark ? 'dark' : 'default',
      toolbarAdaptive: false,
      buttons: toolbarRows,
      buttonsMD: toolbarRows,
      buttonsSM: toolbarRows,
      buttonsXS: toolbarRows,
      controls: {
        inlineCode: {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><g fill="none"><path d="m7 8-4 4 4 4m10-8 4 4-4 4m-3-11-4 14"/></g></svg>',
          tooltip: 'Highlight (Code)',
          exec: (editor) => {
            editor.s.commitStyle({
              element: 'code',
              attributes: {
                class: 'inline-code-highlight'
              }
            });
          }
        },
        codeBox: {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><g fill="none"><rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="m9 9-3 3 3 3m6-6 3 3-3 3"/></g></svg>',
          tooltip: 'Code Box (Block)',
          exec: (editor) => {
            const selHtml = editor.s?.html || '';
            const escapeHtml = (str) => String(str || '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
            let blockText = '';
            if (selHtml.trim()) {
              const tmp = document.createElement('div');
              tmp.innerHTML = selHtml
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n');
              blockText = (tmp.textContent || tmp.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
            }
            const safeContent = escapeHtml(blockText || 'Input:\n\nOutput:');
            editor.s.insertHTML(
              `<pre class="verity-code-box" style="background: #1e1e1e; color: #e5e7eb; border: 1px solid #3f3f46; padding: 12px 16px; border-radius: 8px; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 0.88rem; line-height: 1.5; white-space: pre-wrap; margin: 8px 0; overflow-x: auto;">${safeContent}</pre><p><br></p>`
            );
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
      i18n: {
        en: {
          'Paste as HTML': 'Paste as Code?',
          'Your code is similar to HTML. Keep as HTML?': 'The content you are pasting looks like code or HTML. How would you like to paste it?',
          'Keep': 'Paste as HTML',
          'Insert as Text': 'Paste as Code'
        }
      },
      events: {
        beforeOpenPasteDialog: (msg, title, callback, buttonList) => {
          const isWord = String(title || '').toLowerCase().includes('word');
          setPasteCodeModal({
            isWord,
            title: isWord ? 'Word Paste Detected' : 'Paste as Code?',
            msg: isWord
              ? 'The pasted content is coming from a Microsoft Word or Excel document. Do you want to keep formatting or clean it up?'
              : 'The content you are pasting looks like code or HTML. How would you like to format it in the instructions?',
            callback,
            buttonList
          });
          return false;
        },
        onCustomPasteHTMLOption: (action, html) => {
          if (action === 'cancel') {
            return '';
          }
          if (action === 'as-code') {
            const escape = (str) => String(str || '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
            const bg = isDark ? '#1a221f' : '#f8fafc';
            const text = isDark ? '#a7f3d0' : '#065f46';
            const border = isDark ? '#2e3d38' : '#cbd5e1';
            return `<pre style="background-color: ${bg}; color: ${text}; border: 1px solid ${border}; padding: 12px 16px; border-radius: 8px; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 0.88rem; line-height: 1.5; white-space: pre-wrap; margin: 8px 0; overflow-x: auto;"><code>${escape(html)}</code></pre><p><br></p>`;
          }
          return html;
        }
      },
      style: {
        background: isDark ? '#242424' : '#f9fafb',
        color: isDark ? '#E8EAED' : '#111827'
      }
    };
  }, [isDark, setPasteCodeModal]);

  // ═══ Design tokens for the instructor classroom shell ═══
  const [streamFallbackNow] = useState(() => Date.now());
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
  const activeClassrooms = sortClassroomsAlphabetically((classrooms || []).filter(c => !isClassroomArchived(c)));
  const sidebarClassrooms = (liveClassroomObj && isClassroomArchivedState && !activeClassrooms.some(c => String(c.id) === String(liveClassroomObj.id)))
    ? [{ ...liveClassroomObj, archived: true }, ...activeClassrooms]
    : activeClassrooms;
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
      animate={{ opacity: 1 }}
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
            {classSettings.inviteCodes === 'Turned off' ? (
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                title="Click to manage invite codes in Class settings"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', borderRadius: '10px',
                  border: `1px solid ${ui.border}`,
                  background: isDark ? 'rgba(148,163,184,0.08)' : '#f8fafc',
                  color: ui.muted,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <Lock size={13} /> Invite codes turned off
              </button>
            ) : (
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
            )}
          </div>

          {/* CLASSROOM TAB BAR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px', borderRadius: '12px', background: ui.surface, border: `1px solid ${ui.border}`, marginBottom: '24px' }}>
            <div style={{ display: 'flex', flex: 1 }}>
              {CLASSROOM_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const hasLiveClasswork = tab.id === 'classwork' && visibleClasswork.some(item => getActiveCountForActivity(item) > 0);
                return (
                  <button
                    key={tab.id}
                    className="vt-tab"
                    onClick={() => handleTabChange(tab.id)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: isActive ? 700 : 500, color: isActive ? ui.accentText : ui.muted, transition: 'color 0.2s ease' }}
                  >
                    <span style={{ position: 'relative', padding: '8px 16px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {isActive && (
                        <motion.span
                          layoutId="teacherClassroomTabPill"
                          style={{ position: 'absolute', inset: 0, borderRadius: '8px', background: ui.accentSoft, pointerEvents: 'none' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                        />
                      )}
                      <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                      {hasLiveClasswork && (
                        <span
                          title="Students are actively working in Classwork"
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            boxShadow: '0 0 8px #10b981',
                            animation: 'live-pulse 1.8s infinite',
                            flexShrink: 0
                          }}
                        />
                      )}
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

              {activeTab === 'stream' && (
                <TeacherStreamTab
                  isMobile={isMobile}
                  isDark={isDark}
                  ui={ui}
                  sectionLabelStyle={sectionLabelStyle}
                  smallIconBtnStyle={smallIconBtnStyle}
                  isClassroomArchivedState={isClassroomArchivedState}
                  bannerTheme={bannerTheme}
                  displayClassroom={displayClassroom}
                  classroom={classroom}
                  classroomDirection={classroomDirection}
                  classroomSlideVariants={classroomSlideVariants}
                  activeClassrooms={activeClassrooms}
                  sidebarClassrooms={sidebarClassrooms}
                  badgeColors={BADGE_COLORS}
                  handleUnarchiveCurrentClassroom={handleUnarchiveCurrentClassroom}
                  setOriginalBannerTheme={setOriginalBannerTheme}
                  setIsCustomizeOpen={setIsCustomizeOpen}
                  handleSelectClassroom={handleSelectClassroom}
                  loadingClasswork={loadingClasswork}
                  filteredStreamItems={filteredStreamItems}
                  visibleStreamItems={visibleStreamItems}
                  streamFallbackNow={streamFallbackNow}
                  classSettings={classSettings}
                  isMaterialItem={isMaterialItem}
                  getMaterialIcon={getMaterialIcon}
                  getActiveCountForActivity={getActiveCountForActivity}
                  renderTeacherAvatar={renderTeacherAvatar}
                  handleTabChange={handleTabChange}
                  setExpandedId={setExpandedId}
                />
              )}

              {activeTab === 'classwork' && (
                <TeacherClassworkTab
                  isDark={isDark}
                  isMobile={isMobile}
                  styles={styles}
                  isClassroomArchivedState={isClassroomArchivedState}
                  openCreate={openCreate}
                  loadingClasswork={loadingClasswork}
                  visibleClasswork={visibleClasswork}
                  expandedId={expandedId}
                  toggleExpand={toggleExpand}
                  getActiveCountForActivity={getActiveCountForActivity}
                  getMaterialIcon={getMaterialIcon}
                  activeMenu={activeMenu}
                  toggleMenu={toggleMenu}
                  handleRestoreClasswork={handleRestoreClasswork}
                  handleDeleteClasswork={handleDeleteClasswork}
                  openModify={openModify}
                  handleArchive={handleArchive}
                  handleCopy={handleCopy}
                  expandedInstructionId={expandedInstructionId}
                  setExpandedInstructionId={setExpandedInstructionId}
                  handleInstructionClick={handleInstructionClick}
                  setPreviewImage={setPreviewImage}
                  setPreviewVideo={setPreviewVideo}
                  setPreviewIframe={setPreviewIframe}
                  submissionData={submissionData}
                  enrolledStudents={enrolledStudents}
                  classroom={classroom}
                  activeTab={activeTab}
                  onOpenGrading={onOpenGrading}
                  setSelectedGradingActivityId={setSelectedGradingActivityId}
                  handleTabChange={handleTabChange}
                  onOpenPlayback={onOpenPlayback}
                  onStartMonitoring={onStartMonitoring}
                />
              )}

              {activeTab === 'materials' && (
                <TeacherMaterialsTab
                  isDark={isDark}
                  isMobile={isMobile}
                  styles={styles}
                  isClassroomArchivedState={isClassroomArchivedState}
                  openCreate={openCreate}
                  loadingClasswork={loadingClasswork}
                  visibleMaterials={visibleMaterials}
                  expandedId={expandedId}
                  toggleExpand={toggleExpand}
                  activeMenu={activeMenu}
                  toggleMenu={toggleMenu}
                  handleRestoreClasswork={handleRestoreClasswork}
                  handleDeleteClasswork={handleDeleteClasswork}
                  openModify={openModify}
                  handleArchive={handleArchive}
                  expandedInstructionId={expandedInstructionId}
                  setExpandedInstructionId={setExpandedInstructionId}
                  handleInstructionClick={handleInstructionClick}
                  setPreviewImage={setPreviewImage}
                  setPreviewVideo={setPreviewVideo}
                  setPreviewIframe={setPreviewIframe}
                  setViewingMaterialModal={setViewingMaterialModal}
                />
              )}

              {activeTab === 'people' && (
                <TeacherPeopleTab
                  isDark={isDark}
                  styles={styles}
                  instructorInfo={instructorInfo}
                  classroom={classroom}
                  currentUser={currentUser}
                  isClassroomArchivedState={isClassroomArchivedState}
                  allowManageStudents={allowManageStudents}
                  setIsAddStudentOpen={setIsAddStudentOpen}
                  enrolledStudents={enrolledStudents}
                  sortedEnrolledStudents={sortedEnrolledStudents}
                  loadingStudents={loadingStudents}
                  classCode={classCode}
                />
              )}

              {activeTab === 'grades' && (
                <TeacherGradesTab
                  isDark={isDark}
                  isMobile={isMobile}
                  styles={styles}
                  displayClassroom={displayClassroom}
                  bulkToastMsg={bulkToastMsg}
                  isClassroomArchivedState={isClassroomArchivedState}
                  gradingStudents={gradingStudents}
                  setShowBulkGradeModal={setShowBulkGradeModal}
                  loadingClasswork={loadingClasswork}
                  visibleClasswork={visibleClasswork}
                  gradesActivityDropdownRef={gradesActivityDropdownRef}
                  isGradesActivityDropdownOpen={isGradesActivityDropdownOpen}
                  setIsGradesActivityDropdownOpen={setIsGradesActivityDropdownOpen}
                  activeGradingActivity={activeGradingActivity}
                  setSelectedGradingActivityId={setSelectedGradingActivityId}
                  gradingGrades={gradingGrades}
                  selectedStudentId={selectedStudentId}
                  setSelectedStudentId={setSelectedStudentId}
                  maxPoints={maxPoints}
                  classroom={classroom}
                  activeTab={activeTab}
                  onOpenPlayback={onOpenPlayback}
                  studentGradeInput={studentGradeInput}
                  setStudentGradeInput={setStudentGradeInput}
                  studentFeedbackInput={studentFeedbackInput}
                  setStudentFeedbackInput={setStudentFeedbackInput}
                  handleSaveIndividualGrade={handleSaveIndividualGrade}
                  indivSaveStatus={indivSaveStatus}
                  indivSaveError={indivSaveError}
                />
              )}
              </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

      <TeacherClassworkSecondaryModals
        isDark={isDark}
        styles={styles}
        classroom={classroom}
        displayClassroom={displayClassroom}
        classCode={classCode}
        classSettings={classSettings}
        currentUser={currentUser}
        socket={socket}
        isCustomizeOpen={isCustomizeOpen}
        setIsCustomizeOpen={setIsCustomizeOpen}
        bannerTheme={bannerTheme}
        setBannerTheme={setBannerTheme}
        originalBannerTheme={originalBannerTheme}
        isClassCodeModalOpen={isClassCodeModalOpen}
        setIsClassCodeModalOpen={setIsClassCodeModalOpen}
        codeCopied={codeCopied}
        copyToClipboard={copyToClipboard}
        isClassInfoModalOpen={isClassInfoModalOpen}
        setIsClassInfoModalOpen={setIsClassInfoModalOpen}
        isSettingsModalOpen={isSettingsModalOpen}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        handleUpdateClassroom={handleUpdateClassroom}
        showBulkGradeModal={showBulkGradeModal}
        setShowBulkGradeModal={setShowBulkGradeModal}
        gradingStudents={gradingStudents}
        maxPoints={maxPoints}
        bulkGradeVal={bulkGradeVal}
        setBulkGradeVal={setBulkGradeVal}
        bulkFeedbackVal={bulkFeedbackVal}
        setBulkFeedbackVal={setBulkFeedbackVal}
        handleApplyBulkGrade={handleApplyBulkGrade}
      />

      <TeacherActivityFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isDark={isDark}
        styles={styles}
        editingId={editingId}
        form={form}
        setForm={setForm}
        handleSubmit={handleSubmit}
        handleAttachmentClick={handleAttachmentClick}
        handleAddLink={handleAddLink}
        imageInputRef={imageInputRef}
        videoInputRef={videoInputRef}
        docInputRef={docInputRef}
        handleFilePicked={handleFilePicked}
        handleDropCapture={handleDropCapture}
        handlePasteCapture={handlePasteCapture}
        joditRef={joditRef}
        joditConfig={joditConfig}
        uploading={uploading}
        removeAttachment={removeAttachment}
        onPreviewImage={setPreviewImage}
        onPreviewVideo={setPreviewVideo}
        onPreviewIframe={setPreviewIframe}
      />

      <TeacherClassworkDetailModals
        isDark={isDark}
        styles={styles}
        classroomId={classroom?.id}
        classCode={classCode}
        isClassroomArchivedState={isClassroomArchivedState}
        previewImage={previewImage}
        setPreviewImage={setPreviewImage}
        isLinkModalOpen={isLinkModalOpen}
        setIsLinkModalOpen={setIsLinkModalOpen}
        handleSaveLink={handleSaveLink}
        previewVideo={previewVideo}
        setPreviewVideo={setPreviewVideo}
        previewIframe={previewIframe}
        setPreviewIframe={setPreviewIframe}
        pasteCodeModal={pasteCodeModal}
        setPasteCodeModal={setPasteCodeModal}
        isAddStudentOpen={isAddStudentOpen}
        setIsAddStudentOpen={setIsAddStudentOpen}
        onStudentAdded={() => setRefreshStudentsKey(k => k + 1)}
        deleteClassworkConfirm={deleteClassworkConfirm}
        setDeleteClassworkConfirm={setDeleteClassworkConfirm}
        handleExecuteDeleteClasswork={handleExecuteDeleteClasswork}
        archiveClassworkConfirm={archiveClassworkConfirm}
        setArchiveClassworkConfirm={setArchiveClassworkConfirm}
        handleExecuteArchiveClasswork={handleExecuteArchiveClasswork}
        viewingMaterialModal={viewingMaterialModal}
        setViewingMaterialModal={setViewingMaterialModal}
        handleInstructionClick={handleInstructionClick}
        openModify={openModify}
      />

      {isMobile && (
        <TeacherClassworkMobileNav
          isDark={isDark}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onNavigateView={onNavigateView}
          onBack={onBack}
        />
      )}
    </motion.div>
  );
}
