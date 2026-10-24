/* eslint-disable react-hooks/set-state-in-effect, no-empty, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  PanelLeft,
  PanelLeftClose,
  Play,
  Pause,
  Settings,
  X,
  Moon,
  Sun,
  Square,
  Users,
  AlertTriangle,
  AlertOctagon,
  Search,
  Terminal as TerminalIcon,
  CheckCircle2,
  PlayCircle,
  Monitor
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useDarkMode } from '../hooks/useDarkMode';
import { getStudentGrade, isStudentGraded } from '../utils/gradeUtils';


const formatStudentName = (name) => {
  if (!name) return 'Student';
  const str = String(name).trim();
  if (str.includes('@')) {
    const prefix = str.split('@')[0];
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return str
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const toSentenceCase = (str) => {
  if (!str) return '';
  const s = String(str).trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export default function TeacherView({
  socket,
  currentUser,
  assignment,
  classroom,
  initialStudent,
  onBack,
  onLogout,
  mode = 'live',
  onSwitchMode
}) {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();

  // Responsive screen sizing
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCompact = windowWidth < 1024;
  const isMobile = windowWidth < 768;

  // Sidebar & Terminal states
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [sidebarTab, setSidebarTab] = useState('roster'); // 'roster' | 'warnings'
  const [studentSearch, setStudentSearch] = useState('');
  const [terminalMode, setTerminalMode] = useState('normal'); // 'normal' | 'collapsed' | 'maximized'

  // Persistent warning logs for this activity session (cached in localStorage & synced with server)
  const [sessionWarnings, setSessionWarnings] = useState(() => {
    if (!assignment?.id) return [];
    try {
      const key = `verity_session_warnings_${classroom?.id || 'all'}_${assignment.id}`;
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const mergeWarningLogs = useCallback((incomingList) => {
    if (!Array.isArray(incomingList) || incomingList.length === 0) return;
    setSessionWarnings((prev) => {
      const map = new Map();
      [...incomingList, ...prev].forEach((l) => {
        if (!l) return;
        const sName = String(l.studentName || l.student_name || l.studentId || l.student_id || 'Student').trim();
        const sId = String(l.studentId || l.student_id || sName).trim();
        const act = l.action || l.message || 'Violation';
        const key = `${l.id || ''}-${sId}-${act}-${l.time || ''}`;
        if (!map.has(key)) {
          map.set(key, {
            id: l.id || Date.now(),
            action: act,
            message: l.message || act,
            time: l.time || '',
            color: l.color || '#ef4444',
            studentName: sName,
            studentId: sId,
            classroomId: l.classroomId || l.classroom_id,
            assignmentId: l.assignmentId || l.assignment_id
          });
        }
      });
      const merged = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
      try {
        if (assignment?.id) {
          localStorage.setItem(`verity_session_warnings_${classroom?.id || 'all'}_${assignment.id}`, JSON.stringify(merged));
        }
      } catch {}
      return merged;
    });
  }, [assignment?.id, classroom?.id]);

  // Student roster state
  const [students, setStudents] = useState(() => {
    const initialMap = {};
    if (initialStudent && (initialStudent.id || initialStudent.name) && mode !== 'live') {
      const sId = initialStudent.id || initialStudent.name;
      let hist =
        Array.isArray(initialStudent.history) && initialStudent.history.length > 0
          ? initialStudent.history
          : Array.isArray(initialStudent.codeHistory) && initialStudent.codeHistory.length > 0
          ? initialStudent.codeHistory
          : initialStudent.finalCode
          ? [{ time: Date.now(), code: initialStudent.finalCode }]
          : [];

      initialMap[sId] = {
        id: sId,
        name: initialStudent.name || sId,
        status: 'Submitted',
        code:
          initialStudent.finalCode ||
          initialStudent.code ||
          (hist.length > 0 ? hist[hist.length - 1]?.code : '') ||
          '',
        codeHistory: hist,
        logs: initialStudent.logs || []
      };
    }
    return initialMap;
  });

  const [selectedStudentId, setSelectedStudentId] = useState(() => {
    return initialStudent?.id || initialStudent?.name || null;
  });

  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [evalOutput, setEvalOutput] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(() =>
    parseInt(localStorage.getItem('verity_editor_font_size') || '15', 10)
  );
  const [gradeInput, setGradeInput] = useState(
    assignment?.points ? String(assignment.points) : '100'
  );
  const [feedbackInput, setFeedbackInput] = useState('');

  const playTimerRef = useRef(null);
  const animFrameRef = useRef(null);
  const stepTimingRef = useRef(null);
  const progressLineRef = useRef(null);
  const progressThumbRef = useRef(null);
  const smoothProgressRef = useRef(0);
  const currentIdxRef = useRef(0);
  const currentAnimTimeRef = useRef(0);

  const [notifSettings, setNotifSettings] = useState({
    soundAlerts: true,
    notifyOnSubmission: true,
    showToastWarnings: false
  });
  const notifSettingsRef = useRef(notifSettings);
  useEffect(() => {
    notifSettingsRef.current = notifSettings;
  }, [notifSettings]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let isMounted = true;
    apiFetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`
    )
      .then((res) => (res.ok ? res.json() : {}))
      .then((d) => {
        if (!isMounted) return;
        if (d.settings?.notifications) {
          setNotifSettings(d.settings.notifications);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // I-track ang submitted students para hiwalay sa Live
  const [submittedStudentNames, setSubmittedStudentNames] = useState(() => new Set());
  const submittedStudentNamesRef = useRef(submittedStudentNames);
  submittedStudentNamesRef.current = submittedStudentNames;

  // Kuhanin ang submissions sa backend at localStorage
  useEffect(() => {
    if (!assignment?.id) return;

    apiFetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${assignment.id}`
    )
      .then((res) => res.json())
      .then((data) => {
        const subs = Array.isArray(data?.submissions) ? data.submissions : [];
        const newSubmittedSet = new Set();
        subs.forEach((s) => {
          const sName = String(s.student_name || s.studentName || '').trim().toLowerCase();
          const sId = String(s.student_id || s.studentId || '').trim().toLowerCase();
          if (sName) newSubmittedSet.add(sName);
          if (sId) newSubmittedSet.add(sId);
        });

        // I-check din ang submissions sa local storage
        try {
          const cId = classroom?.id ?? 'default';
          const aId = assignment.id;
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (
              key &&
              (key.startsWith(`verity_sub_${cId}_${aId}_`) ||
                key.startsWith(`verity_sub_default_${aId}_`))
            ) {
              const val = JSON.parse(localStorage.getItem(key));
              if (val && (val.studentName || val.studentId)) {
                const sName = String(val.studentName || '').trim().toLowerCase();
                const sId = String(val.studentId || '').trim().toLowerCase();
                if (sName) newSubmittedSet.add(sName);
                if (sId) newSubmittedSet.add(sId);
              }
            }
          }
        } catch {}

        setSubmittedStudentNames(newSubmittedSet);

        if (mode === 'live') {
          // Tanggalin sa live monitoring kapag submitted na si student
          setStudents((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const [k, s] of Object.entries(next)) {
              const curName = String(s.name || s.studentName || '').trim().toLowerCase();
              const curId = String(s.id || s.studentId || '').trim().toLowerCase();
              const kStr = String(k).trim().toLowerCase();
              if (
                newSubmittedSet.has(curName) ||
                newSubmittedSet.has(curId) ||
                newSubmittedSet.has(kStr) ||
                s.status === 'Submitted'
              ) {
                delete next[k];
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        } else {
          // Sa replay mode, i-load ang submissions para ma-play
          setStudents((prev) => {
            const next = { ...prev };
            subs.forEach((s) => {
              const sName = s.student_name || s.studentName || 'Unknown';
              const hist = Array.isArray(s.history) ? s.history : [];
              const finalCode =
                s.finalCode || (hist.length > 0 ? hist[hist.length - 1]?.code : '') || '';
              const existing = next[sName] || {};
              const combinedHist =
                hist.length > 0
                  ? hist
                  : existing.codeHistory || [{ time: Date.now(), code: finalCode }];
              next[sName] = {
                ...existing,
                id: sName,
                name: sName,
                status: 'Submitted',
                isLive: false,
                code: finalCode || existing.code || '',
                codeHistory: combinedHist,
                logs: existing.logs || []
              };
            });
            return next;
          });
        }
      })
      .catch(() => {});
  }, [assignment?.id, classroom?.id, mode]);

  // Load session proctor warning logs
  useEffect(() => {
    if (!assignment?.id) return;
    const cId = classroom?.id && classroom.id !== 'none' ? `?classroomId=${classroom.id}` : '';
    apiFetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/proctor-logs/${assignment.id}${cId}`
    )
      .then((res) => (res.ok ? res.json() : { logs: [] }))
      .then((data) => {
        if (Array.isArray(data?.logs) && data.logs.length > 0) {
          mergeWarningLogs(data.logs);
        }
      })
      .catch(() => {});
  }, [assignment?.id, classroom?.id, mergeWarningLogs]);

  // Sync initialStudent prop
  useEffect(() => {
    if (initialStudent && (initialStudent.id || initialStudent.name)) {
      const sId = initialStudent.id || initialStudent.name;
      setSelectedStudentId(sId);
      let hist =
        Array.isArray(initialStudent.history) && initialStudent.history.length > 0
          ? initialStudent.history
          : Array.isArray(initialStudent.codeHistory) && initialStudent.codeHistory.length > 0
          ? initialStudent.codeHistory
          : initialStudent.finalCode
          ? [{ time: Date.now(), code: initialStudent.finalCode }]
          : [];

      const cId = classroom?.id ?? 'default';
      const aId = assignment?.id ?? 'default';
      const possibleKeys = [
        `verity_history_${cId}_${aId}_${sId}`,
        `verity_history_${aId}_${sId}`,
        `verity_history_${cId}_${aId}_${initialStudent.name}`,
        `verity_history_${aId}_${initialStudent.name}`
      ];
      for (const pk of possibleKeys) {
        try {
          const raw = localStorage.getItem(pk);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > hist.length) {
              hist = parsed;
              break;
            }
          }
        } catch {}
      }

      setStudents((prev) => {
        const existing = prev[sId] || {};
        const longerHist =
          Array.isArray(existing.codeHistory) && existing.codeHistory.length > hist.length
            ? existing.codeHistory
            : hist.length > 0
            ? hist
            : [{ time: Date.now(), code: initialStudent.finalCode || '' }];

        return {
          ...prev,
          [sId]: {
            ...existing,
            id: sId,
            name: initialStudent.name || sId,
            status: 'Submitted',
            code:
              initialStudent.finalCode ||
              initialStudent.code ||
              (longerHist.length > 0 ? longerHist[longerHist.length - 1]?.code : '') ||
              '',
            codeHistory: longerHist,
            logs: initialStudent.logs || existing.logs || []
          }
        };
      });
    }
  }, [initialStudent, classroom?.id, assignment?.id]);

  useEffect(() => {
    if (mode === 'live') {
      const liveKeys = Object.keys(students).filter((k) => {
        const s = students[k];
        if (!s || s.isLive === false || s.status === 'Offline' || s.status === 'Submitted') return false;
        const sNameLower = String(s.name || s.studentName || '').trim().toLowerCase();
        const sIdLower = String(s.id || s.studentId || '').trim().toLowerCase();
        const kLower = String(k).trim().toLowerCase();
        return !submittedStudentNames.has(sNameLower) && !submittedStudentNames.has(sIdLower) && !submittedStudentNames.has(kLower);
      });
      if (liveKeys.length > 0) {
        const currentStudent = students[selectedStudentId];
        const curName = String(currentStudent?.name || currentStudent?.studentName || '').trim().toLowerCase();
        const curId = String(currentStudent?.id || currentStudent?.studentId || selectedStudentId || '').trim().toLowerCase();
        const isCurrentValid = currentStudent && currentStudent.status === 'Live' && !submittedStudentNames.has(curName) && !submittedStudentNames.has(curId);
        if (!isCurrentValid) {
          setSelectedStudentId(liveKeys[0]);
        }
      } else {
        setSelectedStudentId(null);
      }
    } else {
      const validKeys = Object.keys(students).filter((k) => students[k] && (students[k].status === 'Submitted' || students[k].status === 'Graded' || (Array.isArray(students[k].codeHistory) && students[k].codeHistory.length > 0) || Boolean(students[k].code || students[k].finalCode)));
      if (validKeys.length > 0) {
        if (!selectedStudentId || !students[selectedStudentId]) {
          setSelectedStudentId(validKeys[0]);
        }
      }
    }
  }, [students, selectedStudentId, mode, submittedStudentNames]);

  // Load backend grades
  useEffect(() => {
    if (!assignment?.id) return;
    apiFetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/grades/${assignment.id}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.grades) {
          const gradesKey = `verity_grades_${assignment.id}`;
          let merged = {};
          try {
            const current = JSON.parse(localStorage.getItem(gradesKey)) || {};
            merged = { ...current, ...data.grades };
            localStorage.setItem(gradesKey, JSON.stringify(merged));
          } catch {}

          setStudents((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((k) => {
              if (isStudentGraded(merged, next[k])) {
                next[k] = { ...next[k], status: 'Graded' };
              }
            });
            return next;
          });
        }
      })
      .catch(() => {});
  }, [assignment?.id]);

  // Pre-populate grade form
  useEffect(() => {
    if (selectedStudentId && assignment?.id) {
      const gradesKey = `verity_grades_${assignment.id}`;
      try {
        const savedGrades = JSON.parse(localStorage.getItem(gradesKey)) || {};
        const curStudent = students[selectedStudentId] || { id: selectedStudentId };
        const saved = getStudentGrade(savedGrades, curStudent);
        if (saved) {
          if (saved.grade != null) setGradeInput(String(saved.grade));
          if (saved.feedback != null) setFeedbackInput(saved.feedback);
        } else {
          setGradeInput(assignment?.points ? String(assignment.points) : '100');
          setFeedbackInput('');
        }
      } catch {}
    }
  }, [selectedStudentId, assignment?.id, students]);

  const assignmentInstruction = assignment?.details || '';

  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    setPlaybackIndex(-1);
    setIsPlaying(false);
    setEvalOutput('');
    currentAnimTimeRef.current = 0;
    smoothProgressRef.current = 0;
  }, [selectedStudentId, mode]);

  useEffect(() => {
    if (assignmentInstruction && socket) {
      socket.emit('set_instruction', assignmentInstruction);
    }
  }, [socket, assignmentInstruction]);

  useEffect(() => {
    if (!socket) return;

    const joinRoom = () => {
      if (mode === 'live') {
        const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
        socket.emit('teacher_join', {
          classroomId: classroom?.id,
          assignmentId: assignment?.id,
          token,
          user: currentUser
        });
      }
    };

    const handlePastWarnings = (pastLogs) => {
      if (Array.isArray(pastLogs) && pastLogs.length > 0) {
        mergeWarningLogs(pastLogs);
      }
    };
    socket.on('teacher_past_warnings', handlePastWarnings);

    joinRoom();
    socket.on('connect', joinRoom);

    let syncInterval = null;
    if (mode === 'live') {
      syncInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('teacher_request_sync', {
            classroomId: classroom?.id,
            assignmentId: assignment?.id
          });
        }
      }, 4000);
    }

    const checkSelection = (id) => {
      if (!id) return;
      setSelectedStudentId((prev) => (prev ? prev : id));
    };

    if (mode === 'live') {
      socket.on('teacher_update_code', (data) => {
        if (!data) return;
        // Isolate updates strictly to the active assignment
        if (data.assignmentId && assignment?.id && data.assignmentId !== 'none' && String(data.assignmentId) !== String(assignment.id)) {
          return;
        }
        if (data.classroomId && data.classroomId !== 'none' && classroom?.id && String(data.classroomId) !== String(classroom.id)) {
          return;
        }
        const studentId = String(data.studentId || data.id || data.name || '');
        const studentName = String(data.name || data.studentName || studentId || 'Student').trim();
        const studentIdLower = studentId.toLowerCase();
        const studentNameLower = studentName.toLowerCase();

        const incomingLogs = Array.isArray(data.logs) ? data.logs : [];
        if (incomingLogs.length > 0) {
          mergeWarningLogs(incomingLogs);
        }

        // If in live mode and student has submitted or is in submitted set, REMOVE them and do not add
        if (mode === 'live') {
          const isSubmitted =
            data.status === 'Submitted' ||
            Boolean(data.submitted) ||
            submittedStudentNamesRef.current.has(studentNameLower) ||
            submittedStudentNamesRef.current.has(studentIdLower);

          if (isSubmitted) {
            setStudents((prev) => {
              const next = { ...prev };
              let changed = false;
              for (const [k, s] of Object.entries(next)) {
                const curId = String(s.id || s.studentId || '').trim().toLowerCase();
                const curName = String(s.name || s.studentName || '').trim().toLowerCase();
                const kStr = String(k).trim().toLowerCase();
                if (
                  curId === studentIdLower ||
                  curName === studentNameLower ||
                  kStr === studentIdLower ||
                  kStr === studentNameLower
                ) {
                  delete next[k];
                  changed = true;
                }
              }
              return changed ? next : prev;
            });
            return;
          }
        }

        setStudents((prev) => {
          const sKey =
            Object.keys(prev).find(
              (k) =>
                prev[k].id === studentId ||
                prev[k].studentId === studentId ||
                prev[k].name === studentName ||
                prev[k].name === studentId ||
                (data.email && prev[k].email === data.email)
            ) || studentId || studentName;

          const existing = prev[sKey] || {
            id: studentId || studentName,
            studentId: studentId || studentName,
            name: studentName,
            code: '',
            logs: [],
            status: 'Live',
            isLive: true
          };
          const next = { ...prev };
          if (sKey !== studentId && sKey !== studentName && next[studentId]) {
            delete next[studentId];
          }

          const newHist =
            Array.isArray(existing.codeHistory) && existing.codeHistory.length > 0
              ? (data.code !== undefined && existing.code !== data.code
                  ? [...existing.codeHistory, { time: Date.now(), code: data.code }]
                  : existing.codeHistory)
              : [{ time: Date.now(), code: data.code || '' }];

          const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];
          const map = new Map();
          [...incomingLogs, ...existingLogs].forEach((l) => {
            if (!l) return;
            const k = `${l.id || ''}-${l.action || l.message || ''}-${l.time || ''}`;
            if (!map.has(k)) {
              map.set(k, {
                id: l.id || Date.now(),
                action: l.action || l.message || 'Violation',
                message: l.message || l.action || 'Violation',
                time: l.time || '',
                color: l.color || '#ef4444',
                studentName: l.studentName || studentName,
                studentId: l.studentId || studentId
              });
            }
          });
          const mergedLogs = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));

          next[sKey] = {
            ...existing,
            id: studentId || existing.id || studentName,
            studentId: studentId || existing.studentId || studentName,
            name: studentName,
            studentName: studentName,
            email: data.email || existing.email || '',
            avatar: data.avatar || existing.avatar || '',
            code: data.code !== undefined ? data.code : existing.code || '',
            codeHistory: newHist,
            logs: mergedLogs,
            status: data.status || (data.isLive === false ? 'Offline' : (mode === 'live' ? 'Live' : (existing.status || 'Live'))),
            isLive: data.isLive !== undefined ? data.isLive : (data.status === 'Offline' ? false : true),
            lastActive: Date.now()
          };
          return next;
        });
        checkSelection(studentId || studentName);
      });

      socket.on('teacher_receive_alert', (data) => {
        if (!data) return;
        // Isolate alerts strictly to the active assignment
        if (data.assignmentId && assignment?.id && data.assignmentId !== 'none' && data.assignmentId !== 'default' && String(data.assignmentId) !== String(assignment.id)) {
          return;
        }
        if (data.classroomId && data.classroomId !== 'none' && data.classroomId !== 'default' && classroom?.id && String(data.classroomId) !== String(classroom.id)) {
          return;
        }
        const studentId = String(data.studentId || data.id || data.name || '');
        const studentName = String(data.name || data.studentName || studentId || 'Student').trim();

        const actionText = data.action || data.message || 'Violation';
        const newLog = {
          id: data.id || Date.now(),
          action: actionText,
          message: data.message || actionText,
          time:
            data.time ||
            new Date().toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }).toLowerCase(),
          color: data.color || '#ef4444',
          studentName: studentName,
          studentId: studentId
        };

        // Merge into persistent session warnings immediately
        mergeWarningLogs([newLog]);

        if (mode === 'live') {
          const isSubmitted =
            data.status === 'Submitted' ||
            Boolean(data.submitted) ||
            submittedStudentNamesRef.current.has(studentName.toLowerCase()) ||
            submittedStudentNamesRef.current.has(studentId.toLowerCase());

          if (isSubmitted) {
            // Still merge warning into persistent session logs, but DO NOT re-add to live roster
            return;
          }
        }

        setStudents((prev) => {
          const sKey =
            Object.keys(prev).find(
              (k) =>
                prev[k].id === studentId ||
                prev[k].studentId === studentId ||
                prev[k].name === studentName ||
                prev[k].name === studentId ||
                (data.email && prev[k].email === data.email)
            ) || studentId || studentName;

          const existing = prev[sKey] || {
            id: studentId || studentName,
            studentId: studentId || studentName,
            name: studentName,
            code: '',
            logs: [],
            status: 'Live',
            isLive: true
          };
          const next = { ...prev };
          if (sKey !== studentId && sKey !== studentName && next[studentId]) {
            delete next[studentId];
          }

          const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];
          const isDup = existingLogs.some(
            (l) =>
              l.action === newLog.action &&
              (l.time === newLog.time || Math.abs((l.id || 0) - newLog.id) < 1000)
          );
          const updatedLogs = isDup ? existingLogs : [newLog, ...existingLogs];

          next[sKey] = {
            ...existing,
            id: studentId || existing.id || studentName,
            studentId: studentId || existing.studentId || studentName,
            name: studentName,
            studentName: studentName,
            logs: updatedLogs,
            status: existing.status || 'Live',
            lastActive: Date.now()
          };
          return next;
        });
        checkSelection(studentId || studentName);

        const isCrash = Boolean(
          data.isCrash ||
          (actionText && actionText.toLowerCase().includes('crash')) ||
          (data.message && data.message.toLowerCase().includes('crash'))
        );

        const cleanAction = isCrash
          ? 'System crash'
          : (actionText.toLowerCase().includes('alt') || actionText.toLowerCase().includes('tab') || actionText.toLowerCase().includes('blur'))
          ? 'Alt tab'
          : toSentenceCase(actionText);

        const formattedStudentName = formatStudentName(studentName);

        setToast({
          message: `Alert: ${formattedStudentName} - ${cleanAction}`,
          type: isCrash ? 'error' : 'warning',
          isAlert: true
        });
        setTimeout(() => setToast(null), 5000);

        if (notifSettingsRef.current.soundAlerts) {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
          } catch {}
        }
      });

      socket.on('teacher_terminal_update', (data) => {
        if (!data) return;
        const studentId = String(data.studentId || data.name || '');
        const studentName = String(data.name || data.studentName || studentId || 'Student').trim();
        setStudents((prev) => {
          const sKey =
            Object.keys(prev).find(
              (k) =>
                prev[k].id === studentId ||
                prev[k].studentId === studentId ||
                prev[k].name === studentName ||
                prev[k].name === studentId
            ) || studentId || studentName;
          const existing = prev[sKey] || {
            id: studentId || studentName,
            studentId: studentId || studentName,
            name: studentName,
            code: '',
            logs: [],
            status: 'Live',
            isLive: true
          };
          const next = { ...prev };
          if (sKey !== studentId && sKey !== studentName && next[studentId]) {
            delete next[studentId];
          }
          next[sKey] = {
            ...existing,
            id: studentId || existing.id || studentName,
            studentId: studentId || existing.studentId || studentName,
            name: studentName,
            studentName: studentName,
            terminal: data.output
          };
          return next;
        });
        checkSelection(studentId || studentName);
      });

      socket.on('teacher_student_left', ({ studentId, studentName, assignmentId: leftAssignmentId, classroomId: leftClassroomId }) => {
        if (leftAssignmentId && assignment?.id && leftAssignmentId !== 'none' && String(leftAssignmentId) !== String(assignment.id)) {
          return;
        }
        if (leftClassroomId && leftClassroomId !== 'none' && classroom?.id && String(leftClassroomId) !== String(classroom.id)) {
          return;
        }

        // Pag umalis o lumipat si student, tanggalin sa live roster
        const targetId = String(studentId || '');
        const targetName = String(studentName || '').trim().toLowerCase();

        setStudents((prev) => {
          const next = { ...prev };
          for (const [k, s] of Object.entries(next)) {
            const sId = String(s.id || s.studentId || '');
            const sName = String(s.name || s.studentName || '').trim().toLowerCase();
            const kStr = String(k).trim().toLowerCase();

            if (
              (targetId && (sId === targetId || k === targetId)) ||
              (targetName && (sName === targetName || kStr === targetName))
            ) {
              delete next[k];
            }
          }
          return next;
        });

        setSelectedStudentId((prev) => {
          const prevStr = String(prev || '').trim().toLowerCase();
          if (prev === targetId || prevStr === targetName) {
            return null;
          }
          return prev;
        });
      });
    }

    socket.on('teacher_receive_submission', (data) => {
      const sName = String(data.studentName || data.studentId || '').trim();
      const sId = String(data.studentId || data.studentName || '').trim();
      const sNameLower = sName.toLowerCase();
      const targetId = sId.toLowerCase();

      // I-save agad sa submitted list
      setSubmittedStudentNames((prev) => {
        const next = new Set(prev);
        if (sNameLower) next.add(sNameLower);
        if (targetId) next.add(targetId);
        return next;
      });

      // Tanggalin agad sa live monitoring kapag nag-submit
      if (mode === 'live') {
        setStudents((prev) => {
          const next = { ...prev };
          for (const [k, s] of Object.entries(next)) {
            const curId = String(s.id || s.studentId || '').trim().toLowerCase();
            const curName = String(s.name || s.studentName || '').trim().toLowerCase();
            const kStr = String(k).trim().toLowerCase();

            if (
              (targetId && (curId === targetId || kStr === targetId)) ||
              (sNameLower && (curName === sNameLower || kStr === sNameLower))
            ) {
              delete next[k];
            }
          }
          return next;
        });

        setSelectedStudentId((prev) => {
          const prevStr = String(prev || '').trim().toLowerCase();
          if (prevStr === targetId || prevStr === sNameLower) {
            return null;
          }
          return prev;
        });
      } else {
        setStudents((prev) => {
          const sKey =
            Object.keys(prev).find(
              (k) => prev[k].id === sId || prev[k].name === sName || k === sName || k === sId
            ) || sName;
          const existing = prev[sKey] || { id: sId, name: sName, code: '', logs: [] };
          return {
            ...prev,
            [sKey]: {
              ...existing,
              id: sId,
              studentId: sId,
              name: sName,
              studentName: sName,
              status: 'Submitted',
              isLive: false,
              code: data.finalCode || data.code || existing.code,
              codeHistory: data.codeHistory || existing.codeHistory || []
            }
          };
        });
      }

      if (notifSettingsRef.current.notifyOnSubmission) {
        const sName = formatStudentName(data.studentName || data.studentId || 'A student');
        setToast({
          message: `${sName} submitted their exam.`,
          type: 'success'
        });
        setTimeout(() => setToast(null), 3500);
      }
    });

    const handleUnsubmitted = (data) => {
      if (!data) return;
      const sName = data.studentName || data.studentId;
      setStudents((prev) => {
        const sKey =
          Object.keys(prev).find((k) => prev[k].id === sName || prev[k].name === sName) ||
          sName;
        const existing = prev[sKey];
        if (!existing) return prev;
        return {
          ...prev,
          [sKey]: {
            ...existing,
            status: 'Live'
          }
        };
      });
    };

    socket.on('teacher_student_unsubmitted', handleUnsubmitted);
    socket.on('student_unsubmitted', handleUnsubmitted);

    const handleLiveGradeUpdate = (data) => {
      if (!data || String(data.assignmentId) !== String(assignment?.id) || !data.studentId)
        return;
      const gradesKey = `verity_grades_${assignment.id}`;
      try {
        const current = JSON.parse(localStorage.getItem(gradesKey)) || {};
        current[data.studentId] = {
          grade: data.grade,
          feedback: data.feedback,
          gradedAt: data.gradedAt
        };
        localStorage.setItem(gradesKey, JSON.stringify(current));
      } catch {}
      setStudents((prev) => {
        const sKey =
          Object.keys(prev).find(
            (k) =>
              k === data.studentId ||
              prev[k].id === data.studentId ||
              prev[k].name === data.studentId
          ) || data.studentId;
        if (!prev[sKey]) return prev;
        return {
          ...prev,
          [sKey]: { ...prev[sKey], status: 'Graded' }
        };
      });
    };
    socket.on('grade_updated', handleLiveGradeUpdate);

    return () => {
      socket.off('connect', joinRoom);
      if (syncInterval) clearInterval(syncInterval);
      if (socket) {
        socket.emit('teacher_leave', { classroomId: classroom?.id, assignmentId: assignment?.id });
      }
      if (mode === 'live') {
        socket.off('teacher_update_code');
        socket.off('teacher_receive_alert');
        socket.off('teacher_terminal_update');
        socket.off('teacher_student_left');
      }
      socket.off('teacher_receive_submission');
      socket.off('teacher_past_warnings', handlePastWarnings);
      socket.off('teacher_student_unsubmitted', handleUnsubmitted);
      socket.off('student_unsubmitted', handleUnsubmitted);
      socket.off('grade_updated', handleLiveGradeUpdate);
    };
  }, [socket, mode, classroom?.id, assignment?.id, currentUser]);

  useEffect(() => {
    if (!socket) return;
    const onOut = (chunk) => setEvalOutput((prev) => prev + chunk);
    const onExit = () => setEvaluating(false);
    socket.on('terminal_output', onOut);
    socket.on('process_exit', onExit);
    return () => {
      socket.off('terminal_output', onOut);
      socket.off('process_exit', onExit);
    };
  }, [socket]);

  const activeStudent = useMemo(() => {
    let s =
      students[selectedStudentId] ||
      Object.values(students).find(
        (st) =>
          st.id === selectedStudentId ||
          st.studentId === selectedStudentId ||
          st.name === selectedStudentId
      );
    if (mode === 'live' && s) {
      const sNameLower = String(s.name || s.studentName || '').trim().toLowerCase();
      const sIdLower = String(s.id || s.studentId || '').trim().toLowerCase();
      if (submittedStudentNames.has(sNameLower) || submittedStudentNames.has(sIdLower) || s.status === 'Submitted') {
        s = null;
      }
    }
    return (
      s || {
        name: mode === 'live' ? 'Waiting for students...' : 'Select a student submission',
        code: mode === 'live' ? '// No student currently live' : '// Select a student to replay their session',
        logs: []
      }
    );
  }, [students, selectedStudentId, mode, submittedStudentNames]);

  const allLogs = useMemo(() => {
    const logs = [];

    const sanitizeAction = (actionStr) => {
      if (typeof actionStr !== 'string') return actionStr;
      const lower = actionStr.toLowerCase();
      if (lower.includes('crash')) return 'System Crash';
      if (actionStr.includes('Exit tab') || actionStr.includes('Alt+Tab') || lower.includes('alt tab') || lower.includes('blur') || lower.includes('exit')) return 'Alt Tab';
      if (lower.includes('cognitive pause') || lower.includes('inactivity')) return 'Cognitive Pause';
      if (lower.includes('paste') || lower.includes('clipboard') || lower.includes('copy')) return 'Copy/Paste';
      if (lower.includes('system exit') || lower.includes('exited system')) return 'System Exit';
      return actionStr;
    };

    const getLogColor = (actionStr) => {
      const lower = String(actionStr).toLowerCase();
      if (lower.includes('crash')) return '#dc2626';
      if (lower.includes('alt tab') || lower.includes('alt+tab') || lower.includes('exit'))
        return '#eab308';
      if (lower.includes('paste') || lower.includes('copy') || lower.includes('clipboard'))
        return '#ef4444';
      if (lower.includes('pause') || lower.includes('inactivity'))
        return '#f59e0b';
      return '#ef4444';
    };

    const seenMap = new Map();

    const addLog = (rawLog, fallbackName, fallbackId) => {
      if (!rawLog) return;
      const sName = String(rawLog.studentName || rawLog.student_name || fallbackName || 'Student').trim();
      const sId = String(rawLog.studentId || rawLog.student_id || fallbackId || sName).trim();
      const rawAction = rawLog.action || rawLog.message || 'Violation';
      const sanitizedAction = sanitizeAction(rawAction);
      const dedupeKey = `${rawLog.id || ''}-${sName}-${sanitizedAction}-${rawLog.time || ''}`;
      if (seenMap.has(dedupeKey)) return;

      const logItem = {
        ...rawLog,
        id: rawLog.id || Date.now(),
        studentName: sName,
        studentId: sId,
        action: sanitizedAction,
        message: sanitizeAction(rawLog.message || rawAction),
        color: rawLog.color || getLogColor(sanitizedAction),
        time: rawLog.time || ''
      };
      seenMap.set(dedupeKey, logItem);
      logs.push(logItem);
    };

    // 1. Add persistent session warnings (retained even if students leave or teacher navigates)
    if (Array.isArray(sessionWarnings)) {
      sessionWarnings.forEach((w) => addLog(w));
    }

    // 2. Add logs from student objects
    Object.values(students).forEach((student) => {
      if (mode === 'playback' && student.id !== selectedStudentId && student.name !== selectedStudentId) return;

      if (Array.isArray(student.logs)) {
        student.logs.forEach((log) => {
          addLog(log, student.name, student.id);
        });
      }

      // Capture warnings in codeHistory across both Live and Playback modes
      const hist = student.codeHistory || student.history || [];
      if (Array.isArray(hist)) {
        hist.forEach((h) => {
          if (h && h.warning) {
            const sanitizedWarning = sanitizeAction(h.warning);
            addLog({
              id: h.time || Date.now(),
              message: sanitizedWarning,
              action: sanitizedWarning,
              time: new Date(h.time)
                .toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })
                .toLowerCase(),
              color: getLogColor(sanitizedWarning),
              studentName: student.name,
              studentId: student.id
            }, student.name, student.id);
          }
        });
      }
    });

    return logs.sort((a, b) => (b.id || 0) - (a.id || 0));
  }, [students, sessionWarnings, mode, selectedStudentId]);

  const activeStudentWarnings = useMemo(() => {
    if (!activeStudent || (!activeStudent.id && !activeStudent.name)) return [];
    const aId = String(activeStudent.id || '');
    const aName = String(activeStudent.name || activeStudent.studentName || '');
    return allLogs.filter(
      (l) => (aId && l.studentId === aId) || (aName && l.studentName === aName) || (aName && l.studentId === aName) || (aId && l.studentName === aId)
    );
  }, [allLogs, activeStudent]);

  const rawHistory = activeStudent.codeHistory || activeStudent.history || [];
  const history =
    Array.isArray(rawHistory) && rawHistory.length > 0
      ? rawHistory
      : (activeStudent.code || activeStudent.finalCode)
      ? [{ time: Date.now(), code: activeStudent.code || activeStudent.finalCode }]
      : [];

  const hasPlayback =
    mode === 'playback' &&
    (activeStudent.status === 'Submitted' || history.length > 0 || Boolean(activeStudent.code || activeStudent.finalCode));

  let displayCode = activeStudent.code || activeStudent.finalCode || '';
  if (hasPlayback) {
    if (playbackIndex >= 0 && history[playbackIndex]) {
      displayCode = history[playbackIndex].code;
    } else if (history.length > 0) {
      displayCode = history[history.length - 1]?.code || displayCode;
    }
  }

  // Precompute cumulative playback timeline so the scrubber can glide smoothly without stopping
  const cumulativeTimes = useMemo(() => {
    if (!history || history.length < 2) return [0];
    const times = [0];
    for (let i = 0; i < history.length - 1; i++) {
      const rawGap = (history[i + 1].time || 0) - (history[i].time || 0);
      // Continuous natural pacing: regular typing glides in ~60-90ms, pauses glide in ~150-280ms (never frozen or stopped)
      const stepDuration = rawGap > 0
        ? Math.min(Math.max(rawGap * 0.35, 60), 280)
        : 75;
      times.push(times[i] + stepDuration);
    }
    return times;
  }, [history]);

  const totalPlaybackDuration = cumulativeTimes[cumulativeTimes.length - 1] || 1;

  // VCR playback logic - ultra-smooth continuous glide
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      return;
    }
    if (!hasPlayback || history.length < 2) {
      setIsPlaying(false);
      return;
    }

    const maxIndex = Math.max(history.length - 1, 1);
    let currentAnimTime = currentAnimTimeRef.current;
    if (
      currentAnimTime < 0 ||
      currentAnimTime >= totalPlaybackDuration ||
      (playbackIndex >= 0 && Math.abs(currentAnimTime - (cumulativeTimes[playbackIndex] || 0)) > 2000)
    ) {
      const startIdx = playbackIndex < 0 || playbackIndex >= maxIndex ? 0 : playbackIndex;
      currentAnimTime = cumulativeTimes[startIdx] || 0;
    }
    currentAnimTimeRef.current = currentAnimTime;

    let lastFrameTimestamp = performance.now();
    currentIdxRef.current = playbackIndex < 0 ? 0 : playbackIndex;

    const animate = (now) => {
      const delta = now - lastFrameTimestamp;
      lastFrameTimestamp = now;

      // Continuously glide forward with elapsed frame time
      currentAnimTime += delta;
      currentAnimTimeRef.current = currentAnimTime;

      if (currentAnimTime >= totalPlaybackDuration) {
        smoothProgressRef.current = 100;
        currentAnimTimeRef.current = totalPlaybackDuration;
        if (progressLineRef.current) progressLineRef.current.style.width = '100%';
        if (progressThumbRef.current) progressThumbRef.current.style.left = '100%';
        setPlaybackIndex(maxIndex);
        setIsPlaying(false);
        return;
      }

      // Linear progress across total playback duration for silky glide
      const progressPercent = Math.min(Math.max((currentAnimTime / totalPlaybackDuration) * 100, 0), 100);
      smoothProgressRef.current = progressPercent;

      // Update progress bar and thumb directly on every animation frame (60/120fps)
      if (progressLineRef.current) {
        progressLineRef.current.style.width = `${progressPercent}%`;
      }
      if (progressThumbRef.current) {
        progressThumbRef.current.style.left = `${progressPercent}%`;
      }

      // Scan for the keystroke snapshot at currentAnimTime
      let idx = 0;
      while (idx < cumulativeTimes.length - 1 && cumulativeTimes[idx + 1] <= currentAnimTime) {
        idx++;
      }
      idx = Math.min(idx, maxIndex);

      // If we crossed a keystroke boundary, update Monaco editor
      if (idx !== currentIdxRef.current) {
        currentIdxRef.current = idx;
        setPlaybackIndex(idx);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, hasPlayback, history, cumulativeTimes, totalPlaybackDuration]);

  const togglePlay = () => {
    if (!isPlaying) {
      const maxIndex = Math.max(history.length - 1, 1);
      if (
        playbackIndex >= maxIndex ||
        currentAnimTimeRef.current >= totalPlaybackDuration ||
        playbackIndex < 0
      ) {
        setPlaybackIndex(0);
        currentIdxRef.current = 0;
        currentAnimTimeRef.current = 0;
        smoothProgressRef.current = 0;
        if (progressLineRef.current) progressLineRef.current.style.width = '0%';
        if (progressThumbRef.current) progressThumbRef.current.style.left = '0%';
      }
      setIsPlaying(true);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setIsPlaying(false);
    }
  };

  const handleScrub = (targetTime) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    setIsPlaying(false);

    const clampedTime = Math.min(Math.max(targetTime, 0), totalPlaybackDuration);
    currentAnimTimeRef.current = clampedTime;

    const maxIndex = Math.max(history.length - 1, 0);
    let idx = 0;
    while (idx < cumulativeTimes.length - 1 && cumulativeTimes[idx + 1] <= clampedTime) {
      idx++;
    }
    idx = Math.min(idx, maxIndex);

    currentIdxRef.current = idx;
    setPlaybackIndex(idx);

    const percent = totalPlaybackDuration > 0
      ? Math.min(Math.max((clampedTime / totalPlaybackDuration) * 100, 0), 100)
      : 0;
    smoothProgressRef.current = percent;
    if (progressLineRef.current) progressLineRef.current.style.width = `${percent}%`;
    if (progressThumbRef.current) progressThumbRef.current.style.left = `${percent}%`;
  };

  const handleEvaluate = () => {
    if (evaluating || !socket) return;
    setEvalOutput('');
    setEvaluating(true);
    socket.emit('compile_code', { code: activeStudent.code });
  };

  const handleStopCode = () => {
    if (socket) socket.emit('stop_code');
    setEvaluating(false);
  };

  const handleSaveGrade = async () => {
    if (!assignment?.id || !selectedStudentId) return;
    try {
      const now = new Date().toISOString();
      const gradesKey = `verity_grades_${assignment.id}`;
      const savedGrades = JSON.parse(localStorage.getItem(gradesKey)) || {};
      const updated = {
        ...savedGrades,
        [selectedStudentId]: { grade: gradeInput, feedback: feedbackInput, gradedAt: now }
      };
      try {
        localStorage.setItem(gradesKey, JSON.stringify(updated));
      } catch {}

      const res = await apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignment.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          grade: gradeInput,
          feedback: feedbackInput
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save grade');
      }

      setStudents((prev) => {
        const next = { ...prev };
        if (next[selectedStudentId]) {
          next[selectedStudentId] = { ...next[selectedStudentId], status: 'Graded' };
        }
        return next;
      });

      setToast({
        message: `Successfully graded ${activeStudent.name}!`,
        type: 'success'
      });
      setTimeout(() => setToast(null), 3500);
      setShowGradeModal(false);
    } catch (e) {
      console.error(e);
      setToast({ message: 'Failed to save grade', type: 'warning' });
      setTimeout(() => setToast(null), 3500);
    }
  };

  // I-filter ang list: sa live mode, active coders lang at bawal ang submitted
  const visibleStudents = useMemo(() => {
    let list = Object.values(students);
    if (mode === 'live') {
      list = list.filter((s) => {
        if (!s) return false;
        const sNameLower = String(s.name || s.studentName || '').trim().toLowerCase();
        const sIdLower = String(s.id || s.studentId || '').trim().toLowerCase();
        if (submittedStudentNames.has(sNameLower) || submittedStudentNames.has(sIdLower)) {
          return false;
        }
        return s.isLive !== false && s.status === 'Live' && s.status !== 'Submitted' && s.status !== 'Offline';
      });
    } else {
      list = list.filter((s) => s && (s.status === 'Submitted' || s.status === 'Graded' || (Array.isArray(s.codeHistory) && s.codeHistory.length > 0) || Boolean(s.code || s.finalCode)));
    }
    if (!studentSearch.trim()) return list;
    const q = studentSearch.toLowerCase();
    return list.filter((s) => String(s.name || s.studentName || s.id || '').toLowerCase().includes(q));
  }, [students, studentSearch, mode, submittedStudentNames]);

  const liveStudentCount = useMemo(() => {
    return Object.values(students).filter((s) => {
      if (!s) return false;
      const sNameLower = String(s.name || s.studentName || '').trim().toLowerCase();
      const sIdLower = String(s.id || s.studentId || '').trim().toLowerCase();
      if (submittedStudentNames.has(sNameLower) || submittedStudentNames.has(sIdLower)) {
        return false;
      }
      return s.isLive !== false && s.status === 'Live' && s.status !== 'Submitted' && s.status !== 'Offline';
    }).length;
  }, [students, submittedStudentNames]);

  const activeStudentCount = useMemo(() => {
    return liveStudentCount;
  }, [liveStudentCount]);

  // Color tokens
  const theme = useMemo(() => {
    if (isDark) {
      return {
        bg: '#18181b',
        headerBg: '#27272a',
        sidebarBg: '#202023',
        cardBg: '#27272a',
        border: '#3f3f46',
        borderSubtle: '#27272a',
        textPrimary: '#f4f4f5',
        textSecondary: '#a1a1aa',
        textMuted: '#71717a',
        accent: '#10b981',
        accentBg: 'rgba(16, 185, 129, 0.12)',
        activePill: '#3f3f46',
        inactivePill: '#27272a',
        hoverPill: '#323236',
        terminalBg: '#18181b',
        terminalHeader: '#202023'
      };
    }
    return {
      bg: '#f1f5f9',
      headerBg: '#ffffff',
      sidebarBg: '#f8fafc',
      cardBg: '#ffffff',
      border: '#e2e8f0',
      borderSubtle: '#edf2f7',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#94a3b8',
      accent: '#059669',
      accentBg: 'rgba(5, 150, 105, 0.1)',
      activePill: '#e2e8f0',
      inactivePill: '#ffffff',
      hoverPill: '#f1f5f9',
      terminalBg: '#ffffff',
      terminalHeader: '#f8fafc'
    };
  }, [isDark]);

  return (
    <div
      style={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.bg,
        color: theme.textPrimary,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      {/* ═══ TOP APP BAR / TOOLBAR ═══ */}
      <header
        style={{
          height: isMobile ? '56px' : '62px',
          backgroundColor: theme.headerBg,
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 20px',
          flexShrink: 0,
          zIndex: 40,
          gap: '12px'
        }}
      >
        {/* Left Section: Back button, Sidebar toggle, and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px', minWidth: 0 }}>
          <button
            onClick={onBack || onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: isMobile ? '6px 8px' : '6px 12px',
              backgroundColor: isDark ? '#3f3f46' : '#e2e8f0',
              border: 'none',
              borderRadius: '8px',
              color: theme.textPrimary,
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              transition: 'background-color 0.15s ease'
            }}
            title="Return to previous screen"
          >
            <ArrowLeft size={16} />
            {!isMobile && <span>Back</span>}
          </button>



          {/* Breadcrumb info */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: isMobile ? '0.85rem' : '1rem',
                  fontWeight: '700',
                  color: theme.textPrimary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {assignment?.title || (mode === 'live' ? 'Live Proctoring Session' : 'Replay & Submissions')}
              </span>

              {/* Status Indicator */}
              {mode === 'live' ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    letterSpacing: '0.04em',
                    flexShrink: 0
                  }}
                >
                  <span
                    className="recording-dot-blink"
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: '#ef4444'
                    }}
                  />
                  LIVE MONITORING
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: isDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff',
                    color: isDark ? '#c084fc' : '#7e22ce',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    letterSpacing: '0.04em',
                    flexShrink: 0
                  }}
                >
                  <PlayCircle size={12} />
                  VCR REPLAY
                </span>
              )}
            </div>

            {classroom?.name && !isMobile && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: theme.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {classroom.name}
              </span>
            )}
          </div>
        </div>

        {/* Center Section: Active Student Name Badge */}
        {!isMobile && activeStudent && activeStudent.name !== 'Waiting for students...' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              backgroundColor: isDark ? '#202023' : '#f8fafc',
              border: `1px solid ${theme.border}`,
              borderRadius: '9999px',
              maxWidth: '320px',
              minWidth: 0
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: (activeStudent.isLive !== false && activeStudent.status === 'Live') ? theme.accent : isDark ? '#4b5563' : '#94a3b8',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: '700',
                flexShrink: 0
              }}
            >
              {((activeStudent.name || activeStudent.studentName || activeStudent.id || 'S')[0] || 'S').toUpperCase()}
            </div>
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: '600',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: theme.textPrimary
              }}
            >
              {activeStudent.name || activeStudent.studentName || activeStudent.id || 'Student'}
            </span>
          </div>
        )}

        {/* Right Section: Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px' }}>
          {(activeStudent.status === 'Submitted' || activeStudent.status === 'Graded') && (
            <>
              <button
                onClick={handleEvaluate}
                disabled={evaluating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: isMobile ? '6px 10px' : '7px 14px',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: evaluating ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '0.82rem',
                  opacity: evaluating ? 0.7 : 1,
                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                }}
                title="Run & Evaluate Code"
              >
                <Play size={14} fill="currentColor" />
                {!isMobile && <span>Run</span>}
              </button>

              <button
                onClick={handleStopCode}
                disabled={!evaluating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: isMobile ? '6px 8px' : '7px 12px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: evaluating ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                  fontSize: '0.82rem',
                  opacity: evaluating ? 1 : 0.4
                }}
                title="Stop Execution"
              >
                <Square size={12} fill="currentColor" />
                {!isMobile && <span>Stop</span>}
              </button>

              <button
                onClick={() => setShowGradeModal(true)}
                style={{
                  padding: isMobile ? '6px 10px' : '7px 14px',
                  backgroundColor: isDark ? '#3b82f6' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.82rem',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                }}
                title="Grade or update student grade"
              >
                {activeStudent.status === 'Graded' ? 'Grade: Done' : 'Grade'}
              </button>
            </>
          )}

          {/* Mode Switcher: Hidden in Live Monitoring per request */}
          {onSwitchMode && mode !== 'live' && (
            <button
              onClick={() => onSwitchMode('live')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: isMobile ? '6px 8px' : '7px 12px',
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.82rem',
                transition: 'all 0.15s ease'
              }}
              title="Switch to Live Monitoring Page"
            >
              <Monitor size={14} />
              {!isMobile && <span>Live Monitoring</span>}
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            style={{
              background: 'transparent',
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              padding: isMobile ? '6px' : '7px 9px',
              cursor: 'pointer',
              color: theme.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Appearance and Editor Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* ═══ MAIN WORKSPACE BODY ═══ */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden',
          position: 'relative',
          minHeight: 0
        }}
      >
        {/* COMPACT MOBILE OVERLAY BACKDROP */}
        {isCompact && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed',
              top: isMobile ? '56px' : '62px',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(2px)',
              zIndex: 45
            }}
          />
        )}

        {/* ═══ RESPONSIVE SIDEBAR (ROSTER & WARNINGS) ═══ */}
        {!sidebarOpen ? (
          <div
            style={{
              width: isMobile ? '100%' : '44px',
              height: isMobile ? '44px' : '100%',
              backgroundColor: isDark ? '#252525' : '#f1f5f9',
              borderRight: isMobile ? 'none' : (isDark ? '1px solid #3c3c3c' : '1px solid #cbd5e1'),
              borderBottom: isMobile ? (isDark ? '1px solid #3c3c3c' : '1px solid #cbd5e1') : 'none',
              display: 'flex',
              flexDirection: isMobile ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              padding: isMobile ? '0 12px' : '14px 0',
              gap: '12px',
              flexShrink: 0,
              transition: 'width 0.2s ease, height 0.2s ease',
              zIndex: 5
            }}
          >
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'transparent',
                border: isDark ? '1px solid #484848' : '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px',
                cursor: 'pointer',
                color: isDark ? '#10b981' : '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? '#333333' : '#ffffff',
                transition: 'all 0.15s ease'
              }}
              title="Expand Students Panel"
            >
              {isMobile ? <ChevronDown size={16} /> : <PanelLeft size={16} />}
            </button>
            {!isMobile && (
              <div
                onClick={() => setSidebarOpen(true)}
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                  color: isDark ? '#9ca3af' : '#64748b',
                  fontWeight: '600',
                  fontSize: '0.82rem',
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  userSelect: 'none',
                  marginTop: '10px'
                }}
                title="Click to expand panel"
              >
                STUDENTS
              </div>
            )}
            {isMobile && (
              <span
                onClick={() => setSidebarOpen(true)}
                style={{
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: isDark ? '#9ca3af' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                Show Students
              </span>
            )}
            {allLogs.length > 0 && (
              <div
                style={{
                  marginTop: isMobile ? '0' : 'auto',
                  marginLeft: isMobile ? 'auto' : '0',
                  marginBottom: isMobile ? '0' : '12px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#eab308'
                }}
                title={`${allLogs.length} warning(s)`}
              />
            )}
          </div>
        ) : (
          <aside
            style={{
              position: isCompact ? 'fixed' : 'relative',
              top: isCompact ? (isMobile ? '56px' : '62px') : 'auto',
              left: 0,
              bottom: isCompact ? 0 : 'auto',
              height: isCompact ? `calc(100vh - ${isMobile ? 56 : 62}px)` : '100%',
              width: isCompact
                ? Math.min(360, windowWidth * 0.88)
                : windowWidth >= 1600
                ? '340px'
                : '300px',
              maxWidth: '100vw',
              backgroundColor: isDark ? '#282828' : '#f3f4f6',
              borderRight: isMobile ? 'none' : (isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db'),
              borderBottom: isMobile ? (isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db') : 'none',
              display: 'flex',
              flexDirection: 'column',
              transition: isCompact ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'width 0.2s ease',
              zIndex: isCompact ? 50 : 20,
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
            {/* Sidebar Tabs & Close header */}
            <div
              style={{
                padding: '12px 14px 8px 14px',
                borderBottom: isDark ? '1px solid #333333' : '1px solid #e5e7eb',
                backgroundColor: isDark ? '#262626' : '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: 0 }}>
                  <button
                    onClick={() => setSidebarTab('roster')}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: sidebarTab === 'roster' ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5') : 'transparent',
                      color: sidebarTab === 'roster' ? (isDark ? '#10b981' : '#059669') : (isDark ? '#9ca3af' : '#64748b'),
                      fontWeight: '700',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      minWidth: 0
                    }}
                  >
                    <Users size={14} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mode === 'live' ? `Live (${visibleStudents.length})` : `Submissions (${visibleStudents.length})`}
                    </span>
                  </button>

                  <button
                    onClick={() => setSidebarTab('warnings')}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: sidebarTab === 'warnings' ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2') : 'transparent',
                      color: sidebarTab === 'warnings' ? '#ef4444' : (isDark ? '#9ca3af' : '#64748b'),
                      fontWeight: '700',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      minWidth: 0
                    }}
                  >
                    <AlertTriangle size={14} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Warning
                    </span>
                  </button>
                </div>

                {/* Hide Button placed right side of warnings (icon only) */}
                <button
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '5px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: isDark ? '#9ca3af' : '#6b7280',
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                    flexShrink: 0
                  }}
                  title="Collapse Panel"
                >
                  {isMobile ? <ChevronUp size={18} /> : <PanelLeftClose size={18} />}
                </button>
              </div>

            {/* Student search input */}
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: theme.textMuted
                }}
              />
              <input
                type="text"
                placeholder={sidebarTab === 'roster' ? 'Filter students...' : 'Filter warnings...'}
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.bg,
                  color: theme.textPrimary,
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {studentSearch && (
                <button
                  onClick={() => setStudentSearch('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: theme.textMuted,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* TAB CONTENT: ROSTER */}
          {sidebarTab === 'roster' && (
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {visibleStudents.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '30px 15px',
                    color: theme.textMuted,
                    fontSize: '0.85rem'
                  }}
                >
                  {studentSearch
                    ? 'No matching students found'
                    : mode === 'live'
                    ? 'No students currently active in live workspace. Students will appear here when they start coding.'
                    : 'No submitted student recordings yet.'}
                </div>
              ) : (
                visibleStudents.map((student) => {
                  const sId = String(student.id || student.studentId || '');
                  const sName = String(student.name || student.studentName || sId || 'Student');
                  const isActive = sId === selectedStudentId || sName === selectedStudentId || activeStudent?.id === sId || activeStudent?.name === sName;
                  const isStudentLive = student.isLive !== false && student.status === 'Live';
                  const studentLogCount = allLogs.filter(
                    (l) => l.studentId === sId || l.studentName === sName || l.studentId === sName || l.studentName === sId
                  ).length;
                  return (
                    <div
                      key={sId || sName}
                      onClick={() => {
                        setSelectedStudentId(sId || sName);
                        if (isCompact) setSidebarOpen(false);
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        backgroundColor: isActive
                          ? theme.activePill
                          : theme.inactivePill,
                        border: `1px solid ${isActive ? theme.accent : theme.borderSubtle}`,
                        boxShadow: isActive
                          ? isDark
                            ? '0 2px 8px rgba(0,0,0,0.4)'
                            : '0 2px 6px rgba(0,0,0,0.06)'
                          : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: isActive ? theme.accent : isDark ? '#4b5563' : '#cbd5e1',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            flexShrink: 0
                          }}
                        >
                          {((sName || 'S')[0] || 'S').toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: isActive ? '700' : '600',
                              color: theme.textPrimary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {sName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color:
                                student.status === 'Graded'
                                  ? '#3b82f6'
                                  : student.status === 'Submitted'
                                  ? '#10b981'
                                  : isStudentLive
                                  ? '#10b981'
                                  : '#9ca3af',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {isStudentLive ? (
                              <>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                                Live
                              </>
                            ) : student.status === 'Submitted' ? (
                              'Submitted'
                            ) : student.status === 'Graded' ? (
                              'Graded'
                            ) : (
                              <>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                                Offline
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Warnings badge for this specific student */}
                      {studentLogCount > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            padding: '2px 7px',
                            borderRadius: '9999px',
                            flexShrink: 0
                          }}
                          title={`${studentLogCount} warnings recorded`}
                        >
                          <AlertTriangle size={11} color="#ef4444" />
                          <span>{studentLogCount}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB CONTENT: WARNING LOGS */}
          {sidebarTab === 'warnings' && (
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {allLogs.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '30px 15px',
                    color: theme.textMuted,
                    fontSize: '0.85rem',
                    fontStyle: 'italic'
                  }}
                >
                  No violations or warnings recorded.
                </div>
              ) : (
                allLogs
                  .filter((log) => {
                    if (!studentSearch.trim()) return true;
                    const q = studentSearch.toLowerCase();
                    return (
                      (log.studentName || '').toLowerCase().includes(q) ||
                      (log.action || '').toLowerCase().includes(q)
                    );
                  })
                  .map((log, idx) => (
                    <div
                      key={`${log.id || 'log'}-${idx}`}
                      onClick={() => {
                        const matched = Object.values(students).find(
                          (s) => (s.isLive !== false && s.status !== 'Offline') && (s.id === log.studentId || s.name === log.studentName || s.id === log.studentName || s.name === log.studentId)
                        );
                        if (matched) {
                          setSelectedStudentId(matched.id || matched.name);
                        }
                        if (isCompact) setSidebarOpen(false);
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: theme.cardBg,
                        border: `1px solid ${theme.border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: theme.textPrimary }}>
                          {log.studentName}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>{log.time}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: log.color || '#ef4444'
                          }}
                        />
                        <span style={{ fontSize: '0.78rem', color: log.color || '#ef4444', fontWeight: '600' }}>
                          {log.action}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </aside>
      )}

        {/* ═══ MAIN WORKSPACE (EDITOR, SCRUBBER, TERMINAL) ═══ */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
            minHeight: 0,
            backgroundColor: theme.bg
          }}
        >

          {/* 1. CODE EDITOR WRAPPER */}
          {terminalMode !== 'maximized' && (
            <div
              style={{
                flex: terminalMode === 'collapsed' ? 1 : 2,
                minHeight: '180px',
                width: '100%',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <Editor
                height="100%"
                width="100%"
                language="csharp"
                theme={isDark ? 'vs-dark' : 'light'}
                value={displayCode}
                options={{
                  fontSize: editorFontSize,
                  minimap: { enabled: windowWidth >= 1200 },
                  readOnly: true,
                  automaticLayout: true,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderLineHighlight: 'all',
                  scrollBeyondLastLine: false,
                  fontFamily: 'Consolas, "Courier New", monospace'
                }}
              />
            </div>
          )}

          {/* 2. TIMELINE SCRUBBER (FOR PLAYBACK REVIEW) */}
          {hasPlayback && terminalMode !== 'maximized' && (() => {
            const maxIndex = Math.max(history.length - 1, 1);
            const currIndex = playbackIndex < 0 ? history.length - 1 : playbackIndex;
            const progressPercent = playbackIndex < 0
              ? 100
              : (totalPlaybackDuration > 0
                  ? Math.min(Math.max(((cumulativeTimes[currIndex] ?? 0) / totalPlaybackDuration) * 100, 0), 100)
                  : 0);
            const displayPercent = isPlaying && typeof smoothProgressRef.current === 'number'
              ? smoothProgressRef.current
              : progressPercent;

            return (
              <div
                style={{
                  backgroundColor: theme.headerBg,
                  borderTop: `1px solid ${theme.border}`,
                  borderBottom: `1px solid ${theme.border}`,
                  padding: isMobile ? '8px 12px' : '10px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  flexShrink: 0
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.78rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={togglePlay}
                      style={{
                        background: isPlaying ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        color: isPlaying ? '#ef4444' : '#10b981',
                        fontWeight: '700',
                        fontSize: '0.78rem'
                      }}
                      title={isPlaying ? 'Pause replay' : 'Play replay'}
                    >
                      {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                      <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
                    </button>
                  </div>

                  <span style={{ color: theme.textMuted, fontWeight: '600' }}>
                    Keystroke {currIndex + 1} / {history.length}
                  </span>
                </div>

                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  {/* Base Track Line */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '5px',
                      borderRadius: '9999px',
                      backgroundColor: isDark ? '#4b5563' : '#d1d5db',
                      overflow: 'visible'
                    }}
                  >
                    {/* Active Progress Line */}
                    <div
                      ref={progressLineRef}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${displayPercent}%`,
                        backgroundColor: '#ef4444',
                        borderRadius: '9999px',
                        transition: 'none'
                      }}
                    />

                    {/* Circle Thumb: precisely anchored at displayPercent */}
                    <div
                      ref={progressThumbRef}
                      style={{
                        position: 'absolute',
                        left: `${displayPercent}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '13px',
                        height: '13px',
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        boxShadow: '0 0 5px rgba(0,0,0,0.35)',
                        pointerEvents: 'none',
                        zIndex: 2,
                        transition: 'none'
                      }}
                    />
                  </div>

                  {/* Accessible overlay slider for native dragging / clicks */}
                  <input
                    type="range"
                    min="0"
                    max={totalPlaybackDuration}
                    step="any"
                    value={
                      isPlaying && typeof currentAnimTimeRef.current === 'number'
                        ? currentAnimTimeRef.current
                        : (playbackIndex < 0
                            ? totalPlaybackDuration
                            : (cumulativeTimes[currIndex] ?? 0))
                    }
                    onChange={(e) => handleScrub(parseFloat(e.target.value))}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                      margin: 0,
                      padding: 0,
                      zIndex: 3
                    }}
                  />
                </div>
              </div>
            );
          })()}

          {/* 3. TERMINAL CONSOLE WRAPPER */}
          {terminalMode !== 'collapsed' ? (
            <div
              style={{
                flex: terminalMode === 'maximized' ? 1 : 1,
                minHeight: terminalMode === 'maximized' ? '100%' : isMobile ? '140px' : '180px',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: theme.terminalBg,
                borderTop: `1px solid ${theme.border}`,
                overflow: 'hidden'
              }}
            >
              {/* Terminal Header */}
              <div
                style={{
                  height: '36px',
                  backgroundColor: theme.terminalHeader,
                  borderBottom: `1px solid ${theme.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 14px',
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TerminalIcon size={14} color={theme.accent} />
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: theme.textPrimary }}>
                    Terminal Output
                  </span>
                  {evaluating && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: theme.accent,
                        backgroundColor: theme.accentBg,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}
                    >
                      Running...
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {evalOutput && (
                    <button
                      onClick={() => setEvalOutput('')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: theme.textMuted,
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                      title="Clear terminal output"
                    >
                      Clear
                    </button>
                  )}

                  {/* Maximize / Restore Button */}
                  <button
                    onClick={() => {
                      setTerminalMode((prev) => (prev === 'maximized' ? 'normal' : 'maximized'));
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: theme.textSecondary,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={terminalMode === 'maximized' ? 'Restore height' : 'Maximize terminal'}
                  >
                    {terminalMode === 'maximized' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>

                  {/* Collapse Button */}
                  <button
                    onClick={() => setTerminalMode('collapsed')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: theme.textSecondary,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Minimize terminal"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>

              {/* Terminal Body */}
              <div
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  overflowY: 'auto',
                  overflowX: 'auto',
                  fontFamily: 'Consolas, "Fira Code", monospace',
                  fontSize: '0.85rem',
                  lineHeight: '1.45',
                  color: isDark ? '#e4e4e7' : '#18181b',
                  backgroundColor: isDark ? '#141416' : '#ffffff'
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'inherit'
                  }}
                >
                  {evalOutput
                    ? evalOutput
                    : activeStudent.status === 'Submitted'
                    ? 'Exam completed. Click "Run" in the toolbar to execute the submitted code.'
                    : activeStudent.terminal || 'Monitoring student terminal activity in real-time...'}
                </pre>
              </div>
            </div>
          ) : (
            /* Minimized Bar when collapsed */
            <div
              onClick={() => setTerminalMode('normal')}
              style={{
                height: '32px',
                backgroundColor: theme.terminalHeader,
                borderTop: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 14px',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title="Click to expand terminal"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TerminalIcon size={14} color={theme.textMuted} />
                <span style={{ fontSize: '0.78rem', fontWeight: '600', color: theme.textSecondary }}>
                  Terminal (Collapsed)
                </span>
              </div>
              <ChevronUp size={16} color={theme.textSecondary} />
            </div>
          )}
        </main>
      </div>

      {/* ═══ GRADE MODAL ═══ */}
      <AnimatePresence>
        {showGradeModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(3px)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setShowGradeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                backgroundColor: theme.cardBg,
                borderRadius: '14px',
                padding: '24px',
                width: '100%',
                maxWidth: '440px',
                border: `1px solid ${theme.border}`,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px'
                }}
              >
                <div>
                  <h3 style={{ margin: 0, color: theme.textPrimary, fontSize: '1.2rem', fontWeight: '700' }}>
                    Grade {activeStudent.name}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', color: theme.textSecondary, fontSize: '0.85rem' }}>
                    Assign a grade for {assignment?.title || 'this assignment'}.
                  </p>
                </div>
                <button
                  onClick={() => setShowGradeModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.textMuted,
                    padding: '4px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      color: theme.textPrimary
                    }}
                  >
                    Grade (Max: {assignment?.points || 100}):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={assignment?.points || 100}
                    value={gradeInput}
                    onChange={(e) => setGradeInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.border}`,
                      backgroundColor: theme.bg,
                      color: theme.textPrimary,
                      fontSize: '0.95rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      color: theme.textPrimary
                    }}
                  >
                    Instructor Feedback:
                  </label>
                  <textarea
                    value={feedbackInput}
                    onChange={(e) => setFeedbackInput(e.target.value)}
                    placeholder="e.g. Clean solution, good variable names!"
                    style={{
                      width: '100%',
                      height: '85px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.border}`,
                      backgroundColor: theme.bg,
                      color: theme.textPrimary,
                      fontSize: '0.9rem',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowGradeModal(false)}
                    style={{
                      padding: '9px 18px',
                      backgroundColor: 'transparent',
                      color: theme.textSecondary,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGrade}
                    style={{
                      padding: '9px 20px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '700'
                    }}
                  >
                    Save Grade
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ SETTINGS MODAL ═══ */}
      <AnimatePresence>
        {showSettingsModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(3px)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setShowSettingsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                backgroundColor: theme.cardBg,
                borderRadius: '14px',
                padding: '24px',
                width: '100%',
                maxWidth: '420px',
                border: `1px solid ${theme.border}`,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={20} color={theme.accent} />
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: theme.textPrimary }}>
                    Monitoring Settings
                  </h3>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.textMuted
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Theme Toggle */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: theme.bg,
                  border: `1px solid ${theme.border}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isDark ? <Moon size={20} color="#10b981" /> : <Sun size={20} color="#f59e0b" />}
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', color: theme.textPrimary }}>
                      {isDark ? 'Dark Theme' : 'Light Theme'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: theme.textSecondary }}>
                      Adjust workspace color scheme
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  style={{
                    position: 'relative',
                    width: '48px',
                    height: '26px',
                    borderRadius: '9999px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: isDark ? '#10b981' : '#cbd5e1',
                    transition: 'background-color 0.25s ease',
                    padding: 0
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '3px',
                      left: isDark ? '24px' : '3px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      transition: 'left 0.25s ease'
                    }}
                  />
                </button>
              </div>

              {/* Font Size Selector */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: theme.bg,
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '600', fontSize: '0.88rem', color: theme.textPrimary }}>
                    Editor Font Size
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: theme.accent }}>
                    {editorFontSize}px
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[12, 14, 15, 16, 18, 20].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => {
                        setEditorFontSize(sz);
                        try {
                          localStorage.setItem('verity_editor_font_size', String(sz));
                        } catch {}
                      }}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: editorFontSize === sz ? '700' : '500',
                        border: `1px solid ${editorFontSize === sz ? theme.accent : theme.border}`,
                        backgroundColor:
                          editorFontSize === sz ? theme.accentBg : theme.cardBg,
                        color: editorFontSize === sz ? theme.accent : theme.textPrimary,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  padding: '10px 0',
                  backgroundColor: theme.accent,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  width: '100%'
                }}
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ TOAST NOTIFICATIONS ═══ */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={toast.isAlert ? {
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              backgroundColor: 'transparent',
              border: 'none',
              boxShadow: 'none',
              color: isDark ? '#f87171' : '#dc2626',
              fontWeight: '700',
              fontSize: '0.88rem',
              zIndex: 99999,
              pointerEvents: 'none'
            } : {
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              backgroundColor: toast.type === 'error' ? (isDark ? '#450a0a' : '#fee2e2') : toast.type === 'warning' ? (isDark ? '#451a03' : '#fef3c7') : (isDark ? '#052e16' : '#dcfce7'),
              border: `1px solid ${toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f59e0b' : '#22c55e'}`,
              color: toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#b45309' : '#15803d',
              padding: '10px 18px',
              borderRadius: '10px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.22)',
              fontWeight: '600',
              fontSize: '0.85rem',
              zIndex: 99999
            }}
          >
            {toast.message ? toast.message.charAt(0).toUpperCase() + toast.message.slice(1) : ''}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}