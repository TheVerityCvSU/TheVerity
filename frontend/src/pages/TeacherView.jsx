import React, { useState, useEffect, useRef, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Home, ArrowLeft, Maximize2, Play, Pause, Settings, X, Moon, Sun, Bell, Square } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useDarkMode } from '../hooks/useDarkMode';
import { getStudentGrade, isStudentGraded } from '../utils/gradeUtils';

export default function TeacherView({ socket, assignment, classroom, initialStudent, onBack, onLogout, mode = 'live' }) {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [students, setStudents] = useState(() => {
    if (initialStudent && (initialStudent.id || initialStudent.name)) {
      const sId = initialStudent.id || initialStudent.name;
      let hist = Array.isArray(initialStudent.history) && initialStudent.history.length > 0
        ? initialStudent.history
        : (Array.isArray(initialStudent.codeHistory) && initialStudent.codeHistory.length > 0
          ? initialStudent.codeHistory
          : (initialStudent.finalCode ? [{ time: Date.now(), code: initialStudent.finalCode }] : []));

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

      return {
        [sId]: {
          id: sId,
          name: initialStudent.name || sId,
          status: 'Submitted',
          code: initialStudent.finalCode || initialStudent.code || (hist.length > 0 ? hist[hist.length - 1]?.code : '') || '',
          codeHistory: hist,
          logs: initialStudent.logs || []
        }
      };
    }
    return {};
  });

  const [selectedStudentId, setSelectedStudentId] = useState(() => {
    return initialStudent?.id || initialStudent?.name || null;
  });
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [evalOutput, setEvalOutput] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(() => parseInt(localStorage.getItem('verity_editor_font_size') || '16', 10));
  const [gradeInput, setGradeInput] = useState(assignment?.points ? String(assignment.points) : '100');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [displayProgress, setDisplayProgress] = useState(0); // smooth float 0..(history.length-1)
  const playTimerRef = useRef(null);
  const animFrameRef = useRef(null);
  // Records { fromIndex, toIndex, startAt, endAt } for smooth rAF interpolation between steps
  const stepTimingRef = useRef(null);

  const [notifSettings, setNotifSettings] = useState({
    soundAlerts: true,
    notifyOnSubmission: true,
    showToastWarnings: false,
  });
  const notifSettingsRef = useRef(notifSettings);
  useEffect(() => { notifSettingsRef.current = notifSettings; }, [notifSettings]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let isMounted = true;
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`)
      .then(res => res.ok ? res.json() : {})
      .then(d => {
        if (!isMounted) return;
        if (d.settings?.notifications) {
          setNotifSettings(d.settings.notifications);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Load submissions from backend and localStorage so submitted students and their VCR history are ready
  useEffect(() => {
    if (!assignment?.id) return;

    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${assignment.id}`)
      .then((res) => res.json())
      .then((data) => {
        const subs = Array.isArray(data?.submissions) ? data.submissions : [];
        setStudents((prev) => {
          const next = { ...prev };
          subs.forEach((s) => {
            const sName = s.student_name || s.studentName || 'Unknown';
            const hist = Array.isArray(s.history) ? s.history : [];
            const finalCode = s.finalCode || (hist.length > 0 ? hist[hist.length - 1]?.code : '') || '';
            const existing = next[sName] || {};
            const combinedHist = hist.length > 0 ? hist : (existing.codeHistory || [{ time: Date.now(), code: finalCode }]);
            next[sName] = {
              ...existing,
              id: sName,
              name: sName,
              status: 'Submitted',
              code: finalCode || existing.code || '',
              codeHistory: combinedHist,
              logs: existing.logs || []
            };
          });
          return next;
        });
      })
      .catch(() => { });

    try {
      const cId = classroom?.id ?? 'default';
      const aId = assignment.id;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(`verity_sub_${cId}_${aId}_`) || key.startsWith(`verity_sub_default_${aId}_`))) {
          const val = JSON.parse(localStorage.getItem(key));
          if (val && (val.studentName || val.studentId)) {
            const sName = val.studentName || val.studentId;
            const hist = Array.isArray(val.codeHistory) && val.codeHistory.length > 0 ? val.codeHistory : [{ time: Date.now(), code: val.finalCode || '' }];
            setStudents((prev) => {
              const existing = prev[sName] || {};
              const longerHist = (val.codeHistory && val.codeHistory.length > (existing.codeHistory?.length || 0))
                ? val.codeHistory
                : (existing.codeHistory || hist);
              return {
                ...prev,
                [sName]: {
                  ...existing,
                  id: sName,
                  name: sName,
                  status: 'Submitted',
                  code: val.finalCode || existing.code || (longerHist.length > 0 ? longerHist[longerHist.length - 1]?.code : ''),
                  codeHistory: longerHist,
                  logs: existing.logs || []
                }
              };
            });
          }
        }
      }
    } catch { }
  }, [assignment?.id, classroom?.id]);

  // Load session proctor warning logs so late-joining teachers immediately see all student warnings
  useEffect(() => {
    if (!assignment?.id) return;
    const cId = classroom?.id ? `?classroomId=${classroom.id}` : '';
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/proctor-logs/${assignment.id}${cId}`)
      .then((res) => res.ok ? res.json() : { logs: [] })
      .then((data) => {
        if (Array.isArray(data?.logs) && data.logs.length > 0) {
          setStudents((prev) => {
            const next = { ...prev };
            data.logs.forEach((log) => {
              const sId = log.student_id;
              const sName = log.student_name || log.student_id;
              const sKey = Object.keys(next).find(k => next[k].id === sId || next[k].name === sName || next[k].name === sId) || sId;
              const existing = next[sKey] || { id: sId, name: sName, code: "", logs: [], status: "Live" };
              const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];
              const logItem = {
                id: log.id,
                action: log.action || log.message || 'Violation',
                message: log.message || log.action || 'Violation',
                time: log.time,
                color: log.color,
                studentName: sName,
                studentId: sId
              };
              const exists = existingLogs.some(l => l.id === log.id || (l.action === logItem.action && l.time === logItem.time));
              if (!exists) {
                existingLogs.push(logItem);
              }
              next[sKey] = {
                ...existing,
                logs: existingLogs.sort((a, b) => (b.id || 0) - (a.id || 0))
              };
            });
            return next;
          });
        }
      })
      .catch(() => {});
  }, [assignment?.id, classroom?.id]);

  // Sync initialStudent prop
  useEffect(() => {
    if (initialStudent && (initialStudent.id || initialStudent.name)) {
      const sId = initialStudent.id || initialStudent.name;
      setSelectedStudentId(sId);
      let hist = Array.isArray(initialStudent.history) && initialStudent.history.length > 0
        ? initialStudent.history
        : (Array.isArray(initialStudent.codeHistory) && initialStudent.codeHistory.length > 0
          ? initialStudent.codeHistory
          : (initialStudent.finalCode ? [{ time: Date.now(), code: initialStudent.finalCode }] : []));

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
        const longerHist = (Array.isArray(existing.codeHistory) && existing.codeHistory.length > hist.length)
          ? existing.codeHistory
          : (hist.length > 0 ? hist : [{ time: Date.now(), code: initialStudent.finalCode || '' }]);

        return {
          ...prev,
          [sId]: {
            ...existing,
            id: sId,
            name: initialStudent.name || sId,
            status: 'Submitted',
            code: initialStudent.finalCode || initialStudent.code || (longerHist.length > 0 ? longerHist[longerHist.length - 1]?.code : '') || '',
            codeHistory: longerHist,
            logs: initialStudent.logs || existing.logs || []
          }
        };
      });
    }
  }, [initialStudent, classroom?.id, assignment?.id]);

  useEffect(() => {
    if (!selectedStudentId && Object.keys(students).length > 0) {
      setSelectedStudentId(Object.keys(students)[0]);
    }
  }, [students, selectedStudentId]);

  // Load backend grades to keep submitted students marked as Graded
  useEffect(() => {
    if (!assignment?.id) return;
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/grades/${assignment.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.grades) {
          const gradesKey = `verity_grades_${assignment.id}`;
          let merged = {};
          try {
            const current = JSON.parse(localStorage.getItem(gradesKey)) || {};
            merged = { ...current, ...data.grades };
            localStorage.setItem(gradesKey, JSON.stringify(merged));
          } catch {}

          setStudents(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => {
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

  // Pre-populate grade form when selected student changes
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

  // The instruction comes from the assignment the teacher created (its "details").
  const assignmentInstruction = assignment?.details || "";

  useEffect(() => {
    setPlaybackIndex(-1);
    setIsPlaying(false);
    setEvalOutput("");
  }, [selectedStudentId]);

  // Push the assignment's instruction to students automatically when monitoring starts.
  useEffect(() => {
    if (assignmentInstruction) {
      socket.emit('set_instruction', assignmentInstruction);
    }
  }, [socket, assignmentInstruction]);

  useEffect(() => {
    if (mode === 'live') {
      // Ask the server for the current roster for THIS classroom/assignment
      // so students who joined BEFORE this view opened show up immediately.
      socket.emit('teacher_join', {
        classroomId: classroom?.id,
        assignmentId: assignment?.id
      });
    }

    // Helper to auto-select a student if they are the first one to connect
    const checkSelection = (id) => {
      setSelectedStudentId(prev => prev ? prev : id);
    };

    if (mode === 'live') {
      socket.on('teacher_update_code', (data) => {
        setStudents(prev => {
          const sKey = Object.keys(prev).find(k => prev[k].id === data.studentId || prev[k].name === data.name || prev[k].name === data.studentId) || data.studentId;
          const existing = prev[sKey] || { id: data.studentId, name: data.name, code: "", logs: [], status: "Live" };
          const next = { ...prev };
          if (sKey !== data.studentId && next[data.studentId]) delete next[data.studentId];
          const newHist = Array.isArray(existing.codeHistory) && existing.codeHistory.length > 0
            ? [...existing.codeHistory, { time: Date.now(), code: data.code }]
            : [{ time: Date.now(), code: data.code }];

          // Merge logs so late-joining instructors see all prior student warnings
          const incomingLogs = Array.isArray(data.logs) ? data.logs : [];
          const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];
          const map = new Map();
          [...incomingLogs, ...existingLogs].forEach(l => {
            if (!l) return;
            const k = `${l.id || ''}-${l.action || l.message || ''}-${l.time || ''}`;
            if (!map.has(k)) {
              map.set(k, {
                id: l.id || Date.now(),
                action: l.action || l.message || 'Violation',
                message: l.message || l.action || 'Violation',
                time: l.time || '',
                color: l.color || '#ef4444',
                studentName: l.studentName || data.name || existing.name || data.studentId,
                studentId: l.studentId || data.studentId || existing.id
              });
            }
          });
          const mergedLogs = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));

          next[sKey] = {
            ...existing,
            name: data.name || existing.name || data.studentId,
            code: data.code !== undefined ? data.code : (existing.code || ''),
            codeHistory: newHist,
            logs: mergedLogs,
            status: existing.status === 'Submitted' || existing.status === 'Graded' ? existing.status : 'Live'
          };
          return next;
        });
        checkSelection(data.studentId);
      });

      socket.on('teacher_receive_alert', (data) => {
        setStudents(prev => {
          const sKey = Object.keys(prev).find(k => prev[k].id === data.studentId || prev[k].name === data.name || prev[k].name === data.studentId) || data.studentId;
          const existing = prev[sKey] || { id: data.studentId, name: data.name || data.studentId, code: "", logs: [], status: "Live" };
          const actionText = data.action || data.message || 'Violation';
          const newLog = { 
            id: data.id || Date.now(), 
            action: actionText, 
            message: data.message || actionText,
            time: data.time || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(), 
            color: data.color || '#ef4444',
            studentName: data.name || existing.name || data.studentId,
            studentId: data.studentId || existing.id
          };
          const next = { ...prev };
          if (sKey !== data.studentId && next[data.studentId]) delete next[data.studentId];

          const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];
          const isDup = existingLogs.some(l => l.action === newLog.action && (l.time === newLog.time || Math.abs((l.id || 0) - newLog.id) < 1000));
          const updatedLogs = isDup ? existingLogs : [newLog, ...existingLogs];

          next[sKey] = { 
            ...existing, 
            logs: updatedLogs, 
            status: existing.status === 'Submitted' || existing.status === 'Graded' ? existing.status : 'Live' 
          };
          return next;
        });
        checkSelection(data.studentId);
        
        // Notifications & Alerts Logic
        if (notifSettingsRef.current.soundAlerts) {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
          } catch (e) {}
        }
        
        // Pop-up warnings in live monitoring removed per user request (recorded silently in Warning panel)
      });

      socket.on('teacher_terminal_update', (data) => {
        setStudents(prev => {
          const sKey = Object.keys(prev).find(k => prev[k].id === data.studentId || prev[k].name === data.studentId) || data.studentId;
          const existing = prev[sKey] || { id: data.studentId, name: data.studentId, code: "", logs: [], status: "Live" };
          const next = { ...prev };
          if (sKey !== data.studentId && next[data.studentId]) delete next[data.studentId];
          next[sKey] = { ...existing, terminal: data.output };
          return next;
        });
        checkSelection(data.studentId);
      });

      // A student disconnected — remove them from the roster.
      socket.on('teacher_student_left', ({ studentId }) => {
        setStudents(prev => {
          if (!prev[studentId]) return prev;
          const next = { ...prev };
          delete next[studentId];
          return next;
        });
        setSelectedStudentId(prev => (prev === studentId ? null : prev));
      });
    }

    // Always listen for submissions
    socket.on('teacher_receive_submission', (data) => {
      setStudents(prev => {
        if (mode === 'live') {
          const next = { ...prev };
          if (data.studentName) delete next[data.studentName];
          if (data.studentId) delete next[data.studentId];
          return next;
        }
        const existing = prev[data.studentName] || prev[data.studentId];
        if (!existing) return prev;
        return {
          ...prev,
          [data.studentName]: { ...existing, status: "Submitted", code: data.finalCode || data.code, codeHistory: data.codeHistory }
        };
      });
      if (mode === 'live') {
        setSelectedStudentId(prev => (prev === data.studentName || prev === data.studentId ? null : prev));
      }
      
      if (notifSettingsRef.current.notifyOnSubmission) {
        setToast({ message: `${data.studentName || data.studentId || 'A student'} submitted their exam.`, type: 'success' });
        setTimeout(() => setToast(null), 3500);
      }
    });

      socket.on('teacher_student_unsubmitted', (data) => {
        if (!data) return;
        const sName = data.studentName || data.studentId;
        setStudents(prev => {
          const sKey = Object.keys(prev).find(k => prev[k].id === sName || prev[k].name === sName) || sName;
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
      });

      socket.on('student_unsubmitted', (data) => {
        if (!data) return;
        const sName = data.studentName || data.studentId;
        setStudents(prev => {
          const sKey = Object.keys(prev).find(k => prev[k].id === sName || prev[k].name === sName) || sName;
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
      });

      const handleLiveGradeUpdate = (data) => {
        if (!data || String(data.assignmentId) !== String(assignment?.id) || !data.studentId) return;
        const gradesKey = `verity_grades_${assignment.id}`;
        try {
          const current = JSON.parse(localStorage.getItem(gradesKey)) || {};
          current[data.studentId] = { grade: data.grade, feedback: data.feedback, gradedAt: data.gradedAt };
          localStorage.setItem(gradesKey, JSON.stringify(current));
        } catch {}
        setStudents(prev => {
          const sKey = Object.keys(prev).find(k => k === data.studentId || prev[k].id === data.studentId || prev[k].name === data.studentId) || data.studentId;
          if (!prev[sKey]) return prev;
          return {
            ...prev,
            [sKey]: { ...prev[sKey], status: 'Graded' }
          };
        });
      };
      socket.on('grade_updated', handleLiveGradeUpdate);

      return () => {
        if (mode === 'live') {
          socket.off('teacher_update_code');
          socket.off('teacher_receive_alert');
          socket.off('teacher_terminal_update');
          socket.off('teacher_student_left');
        }
        socket.off('teacher_receive_submission');
        socket.off('teacher_student_unsubmitted');
        socket.off('student_unsubmitted');
        socket.off('grade_updated', handleLiveGradeUpdate);
      };
  }, [socket, mode, classroom?.id, assignment?.id]);

  // Output from "Evaluate" (running the submitted code) comes back on this socket.
  useEffect(() => {
    const onOut = (chunk) => setEvalOutput(prev => prev + chunk);
    const onExit = () => setEvaluating(false);
    socket.on('terminal_output', onOut);
    socket.on('process_exit', onExit);
    return () => {
      socket.off('terminal_output', onOut);
      socket.off('process_exit', onExit);
    };
  }, [socket]);

  const activeStudent = students[selectedStudentId] || { name: "Waiting for students...", code: "// No student selected", logs: [] };

  const allLogs = useMemo(() => {
    const logs = [];
    
    const sanitizeAction = (actionStr) => {
      if (typeof actionStr !== 'string') return actionStr;
      if (actionStr.includes('Exit tab') || actionStr.includes('Alt+Tab')) return 'Alt Tab';
      return actionStr;
    };

    const getLogColor = (actionStr) => {
      const lower = actionStr.toLowerCase();
      if (lower.includes('alt tab') || lower.includes('alt+tab') || lower.includes('exit')) return '#eab308'; // Yellow
      if (lower.includes('paste') || lower.includes('copy') || lower.includes('clipboard')) return '#ef4444'; // Red
      return '#ef4444';
    };

    Object.values(students).forEach(student => {
      if (mode === 'playback' && student.id !== selectedStudentId) return;

      if (Array.isArray(student.logs)) {
        student.logs.forEach(log => {
          const rawAction = log.action || log.message || 'Violation';
          const sanitizedAction = sanitizeAction(rawAction);
          logs.push({ 
            ...log, 
            id: log.id || Date.now(),
            studentName: log.studentName || student.name, 
            action: sanitizedAction, 
            message: sanitizeAction(log.message || rawAction), 
            color: log.color || getLogColor(sanitizedAction),
            time: log.time || ''
          });
        });
      }
      
      if (mode === 'playback') {
        const hist = student.codeHistory || student.history || [];
        if (Array.isArray(hist)) {
          hist.forEach(h => {
            if (h.warning) {
              const sanitizedWarning = sanitizeAction(h.warning);
              logs.push({
                id: h.time || Date.now(),
                message: sanitizedWarning,
                action: sanitizedWarning,
                time: new Date(h.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(),
                color: getLogColor(sanitizedWarning),
                studentName: student.name
              });
            }
          });
        }
      }
    });
    // Sort descending by ID (which is a timestamp)
    return logs.sort((a, b) => b.id - a.id);
  }, [students, mode, selectedStudentId]);

  const history = activeStudent.codeHistory || activeStudent.history || [];
  const hasPlayback = mode === 'playback' && (activeStudent.status === 'Submitted' || history.length > 0) && Array.isArray(history) && history.length > 0;

  let displayCode = activeStudent.code || "";
  if (hasPlayback) {
    if (playbackIndex >= 0 && history[playbackIndex]) {
      displayCode = history[playbackIndex].code;
    } else if (!displayCode && history.length > 0) {
      displayCode = history[history.length - 1]?.code || "";
    }
  }

  // VCR playback — advance through the keystroke timeline using the REAL time
  // gaps the student took (clamped so long idle pauses don't stall the replay).
  // The visual progress bar (displayProgress) moves at a constant linear rate over
  // the total estimated duration so it always feels smooth and uniform.
  useEffect(() => {
    if (!isPlaying) return;
    if (!hasPlayback || history.length < 2) { setIsPlaying(false); return; }

    const startI = (playbackIndex < 0 || playbackIndex >= history.length - 1) ? 0 : playbackIndex;
    setPlaybackIndex(startI);
    setDisplayProgress(startI);

    // ── 1. Calculate total estimated playback duration from startI to end ──
    let totalDuration = 0;
    const delays = [];
    for (let k = startI; k < history.length - 1; k++) {
      const gap = (history[k + 1].time || 0) - (history[k].time || 0);
      const d = Math.min(Math.max(gap, 50), 1500);
      delays.push(d);
      totalDuration += d;
    }
    if (totalDuration === 0) totalDuration = (history.length - 1 - startI) * 200;

    // ── 2. Advance code display step-by-step via setTimeout (unchanged) ──
    const step = (idx) => {
      if (idx >= history.length - 1) {
        setDisplayProgress(history.length - 1);
        setIsPlaying(false);
        return;
      }
      const delay = delays[idx - startI] ?? 200;
      playTimerRef.current = setTimeout(() => {
        setPlaybackIndex(idx + 1);
        step(idx + 1);
      }, delay);
    };
    step(startI);

    // ── 3. Animate displayProgress LINEARLY over totalDuration via rAF ──
    const rafStart = performance.now();
    const totalSteps = history.length - 1 - startI;

    const tick = () => {
      const elapsed = performance.now() - rafStart;
      const fraction = Math.min(elapsed / totalDuration, 1);
      setDisplayProgress(startI + fraction * totalSteps);
      if (fraction < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const togglePlay = () => {
    if (!isPlaying) {
      if (playbackIndex >= history.length - 1) {
        setPlaybackIndex(0);
        setDisplayProgress(0);
        stepTimingRef.current = null;
      }
      setIsPlaying(true);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setIsPlaying(false);
    }
  };

  const handleEvaluate = () => {
    if (evaluating) return;
    setEvalOutput("");
    setEvaluating(true);
    socket.emit('compile_code', { code: activeStudent.code });
  };

  const handleStopCode = () => {
    socket.emit('stop_code');
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
        body: JSON.stringify({ studentId: selectedStudentId, grade: gradeInput, feedback: feedbackInput })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save grade');
      }

      setStudents(prev => {
        const next = { ...prev };
        if (next[selectedStudentId]) {
          next[selectedStudentId] = { ...next[selectedStudentId], status: 'Graded' };
        }
        return next;
      });

      setToast({ message: `Successfully graded ${activeStudent.name}!`, type: 'success' });
      setTimeout(() => setToast(null), 3500);
      setShowGradeModal(false);
    } catch (e) {
      console.error(e);
      setToast({ message: "Failed to save grade", type: 'warning' });
      setTimeout(() => setToast(null), 3500);
    }
  };

  return (
    <div style={getStyles(isDark).container}>
      
      {showGradeModal && (
        <div style={getStyles(isDark).modalOverlay} onClick={() => setShowGradeModal(false)}>
          <div style={getStyles(isDark).modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.2rem' }}>Grade {activeStudent.name}</h3>
                <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
                  Assign a grade for this activity.
                </p>
              </div>
              <button onClick={() => setShowGradeModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#a3a3a3' : '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={getStyles(isDark).fieldLabel}>Grade (out of {assignment?.points || 100}):</label>
                <input
                  type="number"
                  min="0"
                  max={assignment?.points || 100}
                  value={gradeInput}
                  onChange={(e) => setGradeInput(e.target.value)}
                  style={getStyles(isDark).input}
                />
              </div>
              <div>
                <label style={getStyles(isDark).fieldLabel}>Feedback:</label>
                <textarea
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  style={{ ...getStyles(isDark).input, height: '80px', resize: 'vertical' }}
                  placeholder="e.g. Great job on this activity!"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowGradeModal(false)} style={getStyles(isDark).cancelBtn}>Cancel</button>
                <button type="button" onClick={handleSaveGrade} style={getStyles(isDark).saveGradeBtn}>Save Grade</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div style={getStyles(isDark).modalOverlay} onClick={() => setShowSettingsModal(false)}>
          <div style={{...getStyles(isDark).modalCard, width: '90%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '20px'}} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Settings size={22} color={isDark ? '#10b981' : '#0ea5e9'} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b' }}>Settings</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#a3a3a3' : '#64748b', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '14px', backgroundColor: isDark ? '#222222' : '#f8fafc', border: isDark ? '1px solid #3c3c3c' : '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isDark ? <Moon size={22} color="#10b981" /> : <Sun size={22} color="#f59e0b" />}
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem', color: isDark ? '#E8EAED' : '#1e293b' }}>{isDark ? 'Dark Mode' : 'Light Mode'}</div>
                  <div style={{ fontSize: '0.8rem', color: isDark ? '#a3a3a3' : '#64748b', marginTop: '2px' }}>{isDark ? 'Dark theme active' : 'Light theme active'}</div>
                </div>
              </div>
              <button type="button" onClick={toggleDarkMode} style={{ position: 'relative', width: '50px', height: '28px', borderRadius: '9999px', border: 'none', cursor: 'pointer', backgroundColor: isDark ? '#10b981' : '#cbd5e1', transition: 'background-color 0.25s ease', padding: 0 }}>
                <span style={{ position: 'absolute', top: '3px', left: isDark ? '25px' : '3px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.25s ease' }} />
              </button>
            </div>

            {/* Font Size Selector */}
            <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: isDark ? '#222222' : '#f8fafc', border: isDark ? '1px solid #3c3c3c' : '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: isDark ? '#E8EAED' : '#1e293b' }}>Editor Font Size</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#10b981' }}>{editorFontSize}px</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[13, 14, 16, 18, 20].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => {
                      setEditorFontSize(sz);
                      try { localStorage.setItem('verity_editor_font_size', String(sz)); } catch {}
                    }}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s ease', fontSize: '0.85rem',
                      border: `1px solid ${editorFontSize === sz ? '#10b981' : (isDark ? '#484848' : '#cbd5e1')}`,
                      backgroundColor: editorFontSize === sz ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#333333' : '#ffffff'),
                      color: editorFontSize === sz ? '#10b981' : (isDark ? '#E8EAED' : '#475569'),
                      fontWeight: editorFontSize === sz ? '700' : '500'
                    }}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setShowSettingsModal(false)} style={{ ...getStyles(isDark).saveGradeBtn, width: '100%', marginTop: '10px' }}>Done</button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            style={{
              position: 'fixed',
              bottom: '30px',
              right: '30px',
              backgroundColor: toast.type === 'warning' ? '#fef3c7' : '#dcfce7',
              border: `2px solid ${toast.type === 'warning' ? '#f59e0b' : '#22c55e'}`,
              color: toast.type === 'warning' ? '#b45309' : '#15803d',
              padding: '12px 20px',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              fontWeight: 'bold',
              zIndex: 9999
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
      <div style={getStyles(isDark).leftSidebar}>
        <div style={getStyles(isDark).rosterSection}>
          <button
            onClick={onBack || onLogout}
            style={{ ...getStyles(isDark).backButton, marginBottom: '20px' }}
            title={onBack ? "Back" : "Back to Dashboard"}
          >
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>

          <h2 style={getStyles(isDark).heading}>{mode === 'playback' ? 'Submitted Students' : 'Student Roster'}</h2>

          <div style={getStyles(isDark).pillContainer}>
            {Object.values(students).filter(s => mode !== 'live' || (s.status !== 'Submitted' && s.status !== 'Graded')).length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Waiting for students...</p>
            ) : (
              Object.values(students).filter(s => mode !== 'live' || (s.status !== 'Submitted' && s.status !== 'Graded')).map(student => {
                const isActive = student.id === selectedStudentId;
                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    style={{
                      ...getStyles(isDark).studentPill,
                      border: isActive ? '2px solid #22c55e' : '2px solid transparent',
                      backgroundColor: isActive ? (isDark ? '#4b5563' : '#e5e7eb') : (isDark ? '#374151' : '#d1d5db')
                    }}
                  >
                    {student.name}
                    <span style={{ fontSize: '0.7rem', marginLeft: 'auto', color: (student.status === 'Submitted' || student.status === 'Graded') ? '#10b981' : '#6b7280' }}>
                      {student.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>

        </div>

        <div style={getStyles(isDark).warningSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ fontSize: '1.1rem', color: isDark ? '#f3f4f6' : '#1f2937', fontWeight: 'bold' }}>Warning</span>
            <span style={{ fontSize: '1.1rem', color: isDark ? '#f3f4f6' : '#1f2937', fontWeight: 'bold' }}>Time</span>
          </div>
          <div style={getStyles(isDark).logContainer}>
            {allLogs.length === 0 ? (
              <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem' }}>No warnings...</span>
            ) : (
              allLogs.map((log, idx) => (
                <div key={`${log.id || 'log'}-${log.studentName || 'student'}-${idx}`} style={getStyles(isDark).logRow}>
                  <span style={{ color: log.color, paddingRight: '15px', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                    <span style={{ fontWeight: 'bold' }}>{log.studentName}</span> ({log.action})
                  </span>
                  <span style={{ color: isDark ? '#a3a3a3' : '#6b7280', flexShrink: 0, backgroundColor: 'transparent', whiteSpace: 'nowrap' }}>{log.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={getStyles(isDark).mainArea}>
        <div style={{ ...getStyles(isDark).toolbar, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {(activeStudent.status === 'Submitted' || activeStudent.status === 'Graded') && (
              <>
                <button onClick={handleEvaluate} disabled={evaluating} style={getStyles(isDark).runButton}>
                  <Play size={16} fill="currentColor" /> Run
                </button>
                <button onClick={handleStopCode} disabled={!evaluating} style={{ ...getStyles(isDark).stopButton, opacity: evaluating ? 1 : 0.5, cursor: evaluating ? 'pointer' : 'not-allowed' }}>
                  <Square size={14} fill="currentColor" /> Stop
                </button>
              </>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {(activeStudent.status === 'Submitted' || activeStudent.status === 'Graded') ? (
              <>
                <button onClick={() => setShowGradeModal(true)} style={getStyles(isDark).gradeButton}>
                  {activeStudent.status === 'Graded' ? 'Update Grade' : 'Grade Student'}
                </button>
                <button onClick={() => setShowSettingsModal(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: '10px', display: 'flex', alignItems: 'center' }} title="Settings">
                  <Settings size={22} color={isDark ? '#a3a3a3' : '#64748b'} />
                </button>
              </>
            ) : (
              <>
                <div className="recording-dot-blink" style={getStyles(isDark).recordingDot} title="Live Monitoring Active"></div>
                <button onClick={() => setShowSettingsModal(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Settings">
                  <Settings size={22} color={isDark ? '#a3a3a3' : '#64748b'} />
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ ...getStyles(isDark).editorWrapper, position: 'relative' }}>
          <Editor
            height="100%"
            language="csharp"
            theme={isDark ? "vs-dark" : "light"}
            value={displayCode}
            options={{ fontSize: editorFontSize, minimap: { enabled: false }, readOnly: true }}
          />
        </div>

        {hasPlayback && (
          <div style={getStyles(isDark).scrubberBar}>
            <style>{`
              .vcr-scrubber {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 4px;
                border-radius: 2px;
                background: linear-gradient(
                  to right,
                  #ef4444 var(--progress, 0%),
                  ${isDark ? '#4b5563' : '#d1d5db'} var(--progress, 0%)
                );
                outline: none;
                cursor: pointer;
              }
              .vcr-scrubber::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 0px;
                height: 0px;
                opacity: 0;
              }
              .vcr-scrubber::-moz-range-thumb {
                width: 0px;
                height: 0px;
                border: none;
                opacity: 0;
                background: transparent;
              }
            `}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: isDark ? '#d1d5db' : '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isPlaying ? '#ef4444' : '#16a34a', display: 'inline-block' }}></span>
                VCR PLAYBACK {isPlaying ? '• PLAYING' : ''}
              </span>
              <span style={{ fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#4b5563', fontWeight: '600' }}>
                Keystroke {(playbackIndex < 0 ? history.length : playbackIndex + 1)} of {history.length}
              </span>
            </div>
            <input
              type="range"
              className="vcr-scrubber"
              min="0"
              max={history.length - 1}
              value={isPlaying ? displayProgress : (playbackIndex < 0 ? history.length - 1 : playbackIndex)}
              onChange={(e) => {
                if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
                setIsPlaying(false);
                const v = parseInt(e.target.value);
                setPlaybackIndex(v);
                setDisplayProgress(v);
              }}
              style={{
                '--progress': `${((isPlaying ? displayProgress : (playbackIndex < 0 ? history.length - 1 : playbackIndex)) / Math.max(history.length - 1, 1)) * 100}%`
              }}
            />
            <div style={getStyles(isDark).vcrControls}>
              <button onClick={togglePlay} style={getStyles(isDark).playButton} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying
                  ? <Pause size={20} fill="#16a34a" color="#16a34a" />
                  : <Play size={20} fill="#16a34a" color="#16a34a" />}
              </button>
            </div>
          </div>
        )}

        <div style={getStyles(isDark).terminalWrapper}>
          <div style={getStyles(isDark).terminalHeader}>
            <span style={{ fontWeight: 'bold', marginRight: '10px' }}>V</span>
            <Maximize2 size={14} color={isDark ? "#fff" : "#000"} style={{ cursor: 'pointer' }} />
          </div>
          <div style={getStyles(isDark).terminalBody}>
            <span style={{ whiteSpace: 'pre-wrap', color: isDark ? '#e5e7eb' : 'black' }}>
              {evalOutput
                ? evalOutput
                : (activeStudent.status === 'Submitted'
                  ? "Exam completed. Click Evaluate to run the submitted code."
                  : (activeStudent.terminal || "Monitoring terminal in real-time..."))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const getStyles = (isDark) => ({
  container: { height: '100%', width: '100%', display: 'flex', fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: isDark ? '#262626' : '#e5e7eb' },
  leftSidebar: { width: '300px', display: 'flex', flexDirection: 'column', borderRight: isDark ? '1px solid #4A4A4A' : '1px solid #d1d5db', backgroundColor: isDark ? '#323232' : '#f3f4f6' },
  rosterSection: { flex: 1, padding: '30px' },
  homeButton: { background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '20px' },
  heading: { color: isDark ? '#E8EAED' : 'black', margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 'normal' },
  pillContainer: { display: 'flex', flexDirection: 'column', gap: '15px' },
  studentPill: { height: '35px', borderRadius: '50px', display: 'flex', alignItems: 'center', padding: '0 15px', color: isDark ? '#E8EAED' : '#4b5563', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.1)' },
  warningSection: { height: '250px', backgroundColor: isDark ? '#282828' : '#ffffff', borderTop: isDark ? '1px solid #4A4A4A' : '1px solid #d1d5db', padding: '30px', display: 'flex', flexDirection: 'column' },
  logContainer: { overflowY: 'auto', flex: 1, paddingRight: '5px' },
  logRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '1rem' },
  mainArea: { flex: 1, display: 'flex', flexDirection: 'column' },
  toolbar: { height: '56px', backgroundColor: isDark ? '#323232' : '#f3f4f6', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 20px', borderBottom: isDark ? '1px solid #4A4A4A' : 'none' },
  recordingDot: { width: '12px', height: '12px', backgroundColor: '#dc2626', borderRadius: '50%', boxShadow: '0 0 8px rgba(220, 38, 38, 0.8)' },
  evaluateButton: { padding: '8px 20px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s ease' },
  gradeButton: { padding: '8px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s ease' },
  runButton: { padding: '8px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' },
  stopButton: { padding: '8px 20px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' },
  editorWrapper: { flex: 2, backgroundColor: isDark ? '#1e1e1e' : '#fffffe' },
  scrubberBar: { backgroundColor: isDark ? '#262626' : '#e5e7eb', padding: '10px 20px 4px 20px', borderTop: isDark ? '2px solid #4A4A4A' : '2px solid #d1d5db', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' },
  vcrControls: { display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' },
  playButton: { background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' },
  terminalWrapper: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: isDark ? '#323232' : 'white', borderTop: isDark ? '2px solid #4A4A4A' : '2px solid #d1d5db' },
  terminalHeader: { padding: '5px 15px', backgroundColor: isDark ? '#262626' : 'white', borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e5e7eb', display: 'flex', alignItems: 'center', color: isDark ? '#fff' : 'black' },
  terminalBody: { flex: 1, padding: '15px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '1rem', color: isDark ? '#E8EAED' : 'black', textAlign: 'left' },
  backButton: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 0', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#d1d5db' : '#4b5563', fontWeight: 'bold', fontSize: '0.9rem', transition: 'color 0.2s ease' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalCard: { backgroundColor: isDark ? '#1e1e1e' : 'white', borderRadius: '12px', padding: '25px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: isDark ? '1px solid #4A4A4A' : '1px solid #d1d5db', backgroundColor: isDark ? '#262626' : 'white', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.95rem', boxSizing: 'border-box' },
  saveGradeBtn: { padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  cancelBtn: { padding: '10px 20px', backgroundColor: 'transparent', color: isDark ? '#a3a3a3' : '#64748b', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
  fieldLabel: { display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 'bold', color: isDark ? '#E8EAED' : '#475569' }
});