import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Home, Calendar, ClipboardList, Settings, Menu, Archive, ArrowLeft, CheckCircle2, Code2, ExternalLink, X, Link2, TerminalSquare, Award, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import ProfileMenu from './ProfileMenu';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import Skeleton from '../components/Skeleton';
import ImagePreviewModal from '../components/ImagePreviewModal';
import VideoPreviewModal from '../components/VideoPreviewModal';
import VideoAttachment from '../components/VideoAttachment';
import AttachmentCard from '../components/AttachmentCard';
import { localStore } from '../services/localStore';
import { getClassroomStorageKey, getCachedClassrooms, saveCachedClassrooms } from '../utils/classroomUtils';
import { getStudentGrade, isStudentGraded, formatGradeScore } from '../utils/gradeUtils';

const getStorageKey = (user) => getClassroomStorageKey(user, 'student');

export default function StudentActivityDetail({
  classroom,
  assignment,
  currentUser,
  socket,
  onBack,
  onNavigateView,
  onStartCoding,
  onEnterClassroom,
  onLogout
}) {
  const { isDark } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const styles = getStyles(isDark, isMobile);
  const safeUsername = currentUser?.name || currentUser?.email || 'Student';
  const studentId = currentUser?.email || currentUser?.name || 'student';
  const assignmentId = assignment?.id ?? 'default';
  const classroomId = classroom?.id ?? 'default';
  const [loading, setLoading] = useState(!assignment);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);

  useEffect(() => {
    if (!assignment) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [assignment]);

  // Local storage keys
  const submissionKey = `verity_sub_${classroomId}_${assignmentId}_${studentId}`;
  const gradesKey = `verity_grades_${assignmentId}`;
  const draftCodeKey = `verity_code_${assignmentId}_${studentId}`;

  // Submission state
  const [submission, setSubmission] = useState(() => {
    try {
      const saved = localStorage.getItem(submissionKey) ||
        (currentUser?.id ? localStorage.getItem(`verity_sub_${classroomId}_${assignmentId}_id_${currentUser.id}`) : null) ||
        (currentUser?.name ? localStorage.getItem(`verity_sub_${classroomId}_${assignmentId}_${currentUser.name}`) : null) ||
        (currentUser?.email ? localStorage.getItem(`verity_sub_${classroomId}_${assignmentId}_${currentUser.email}`) : null);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const isSubmitted = !!submission;

  // Grade & Instructor Feedback state
  const [gradeData, setGradeData] = useState(() => {
    try {
      const saved = localStorage.getItem(gradesKey);
      const allGrades = saved ? JSON.parse(saved) : {};
      return getStudentGrade(allGrades, { id: currentUser?.id, name: currentUser?.name, email: currentUser?.email }) ||
             getStudentGrade(allGrades, studentId) ||
             getStudentGrade(allGrades, safeUsername) ||
             null;
    } catch {
      return null;
    }
  });

  // Modal to preview submitted code
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showUnsubmitModal, setShowUnsubmitModal] = useState(false);

  // Sidebar & Layout state - only load the current student's enrolled classrooms
  const [classrooms, setClassrooms] = useState(() => {
    return getCachedClassrooms(currentUser, 'student');
  });

  useEffect(() => {
    const sync = () => {
      setClassrooms(getCachedClassrooms(currentUser, 'student'));
    };
    sync();

    apiFetch(`${import.meta.env.VITE_API_URL}/classrooms`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        const list = (Array.isArray(data) ? data : (data.classrooms || [])).filter(c => c && c.name);
        if (list.length > 0) {
          setClassrooms(list);
          saveCachedClassrooms(list, currentUser, 'student');
        }
      })
      .catch(() => {});

    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [currentUser]);


  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [headerIndicatorStyle, setHeaderIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const headerNavRefs = useRef({});

  useLayoutEffect(() => {
    // When hovering over the header, highlight 'classrooms' (Home) as default for Activity Details
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

  // Sync submission & grade from backend
  useEffect(() => {
    let cancelled = false;

    const allKeys = [
      submissionKey,
      `verity_sub_${classroomId}_${assignmentId}_${studentId}`,
      `verity_sub_${classroomId}_${assignmentId}_${safeUsername}`,
      currentUser?.name ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.name}` : null,
      currentUser?.email ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.email}` : null,
      currentUser?.id ? `verity_sub_${classroomId}_${assignmentId}_id_${currentUser.id}` : null
    ].filter(Boolean);

    // 1. Fetch submissions for this assignment to check if currently submitted
    apiFetch(`${import.meta.env.VITE_API_URL}/submissions/${assignmentId}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data?.submissions)) {
          const mySub = data.submissions.find(s => {
            const sName = (s.student_name || s.studentName || '').toLowerCase();
            const sId = (s.student_id || s.studentId || '').toLowerCase();
            const targetName = safeUsername.toLowerCase();
            const targetId = studentId.toLowerCase();
            const targetEmail = (currentUser?.email || '').toLowerCase();
            return sName === targetName || sName === targetId || sName === targetEmail ||
                   (sId && (sId === targetName || sId === targetId || sId === targetEmail));
          });
          if (mySub) {
            setSubmission(mySub);
            localStorage.setItem(submissionKey, JSON.stringify(mySub));
          } else {
            setSubmission(null);
            allKeys.forEach(k => {
              try { localStorage.removeItem(k); } catch { }
            });
          }
        }
      })
      .catch(() => {});

    // 2. Fetch grades from backend
    apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignmentId}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data?.grades) {
          const myGrade = getStudentGrade(data.grades, { id: currentUser?.id, name: currentUser?.name, email: currentUser?.email }) ||
                          getStudentGrade(data.grades, studentId) ||
                          getStudentGrade(data.grades, safeUsername);
          if (myGrade) {
            setGradeData(myGrade);
          }
        }
      })
      .catch(() => {});

    // 3. Listen to live grading or submission updates
    const onStorageUpdate = () => {
      try {
        const saved = localStorage.getItem(submissionKey) ||
          (currentUser?.name ? localStorage.getItem(`verity_sub_${classroomId}_${assignmentId}_${currentUser.name}`) : null) ||
          (currentUser?.email ? localStorage.getItem(`verity_sub_${classroomId}_${assignmentId}_${currentUser.email}`) : null);
        setSubmission(saved ? JSON.parse(saved) : null);
      } catch { }

      try {
        const savedGrades = localStorage.getItem(gradesKey);
        const allGrades = savedGrades ? JSON.parse(savedGrades) : {};
        const myGrade = getStudentGrade(allGrades, { id: currentUser?.id, name: currentUser?.name, email: currentUser?.email }) ||
                        getStudentGrade(allGrades, studentId) ||
                        getStudentGrade(allGrades, safeUsername);
        if (myGrade) setGradeData(myGrade);
      } catch { /* ignore */ }
    };

    window.addEventListener('storage', onStorageUpdate);

    let handleSocketUnsub = null;
    if (socket) {
      handleSocketUnsub = (data) => {
        if (!data) return;
        const targetName = (safeUsername || '').toLowerCase();
        const targetId = (studentId || '').toLowerCase();
        const eventName = (data.studentName || '').toLowerCase();
        const eventId = (data.studentId || '').toLowerCase();

        if (eventName === targetName || eventName === targetId || eventId === targetName || eventId === targetId) {
          // Backup existing submission history to persistent history keys before removing
          const hKeys = [
            `verity_history_${classroomId}_${assignmentId}_${studentId}`,
            `verity_history_${classroomId}_${assignmentId}_${safeUsername}`,
            currentUser?.name ? `verity_history_${classroomId}_${assignmentId}_${currentUser.name}` : null,
            currentUser?.email ? `verity_history_${classroomId}_${assignmentId}_${currentUser.email}` : null,
            `verity_history_${assignmentId}_${studentId}`,
            `verity_history_${assignmentId}_${safeUsername}`
          ].filter(Boolean);

          let foundHist = null;
          for (const k of allKeys) {
            try {
              const item = localStorage.getItem(k);
              if (item) {
                const parsed = JSON.parse(item);
                const h = parsed?.codeHistory || parsed?.history;
                if (Array.isArray(h) && h.length > (foundHist?.length || 0)) {
                  foundHist = h;
                }
              }
            } catch {}
          }

          if (Array.isArray(foundHist) && foundHist.length > 0) {
            hKeys.forEach(hk => {
              try {
                const cur = localStorage.getItem(hk);
                if (!cur || JSON.parse(cur).length < foundHist.length) {
                  localStorage.setItem(hk, JSON.stringify(foundHist));
                }
              } catch {}
            });
            try {
              localStore.saveDraft(assignmentId, studentId, localStorage.getItem(draftCodeKey) || '', foundHist);
            } catch {}
          }

          setSubmission(null);
          allKeys.forEach(k => {
            try { localStorage.removeItem(k); } catch { }
          });
        }
      };

      const handleLiveGradeUpdate = (data) => {
        if (!data || String(data.assignmentId) !== String(assignmentId)) return;
        const myGrade = getStudentGrade({ [data.studentId]: data }, { id: currentUser?.id, name: currentUser?.name, email: currentUser?.email }) ||
                        getStudentGrade({ [data.studentId]: data }, studentId) ||
                        getStudentGrade({ [data.studentId]: data }, safeUsername);
        if (myGrade) {
          setGradeData({ grade: data.grade, feedback: data.feedback, gradedAt: data.gradedAt });
        }
      };

      const handleLiveBulkGradesUpdate = (data) => {
        if (!data || String(data.assignmentId) !== String(assignmentId) || !Array.isArray(data.grades)) return;
        const map = {};
        data.grades.forEach(g => { if (g.studentId) map[g.studentId] = g; });
        const myGrade = getStudentGrade(map, { id: currentUser?.id, name: currentUser?.name, email: currentUser?.email }) ||
                        getStudentGrade(map, studentId) ||
                        getStudentGrade(map, safeUsername);
        if (myGrade) {
          setGradeData({ grade: myGrade.grade, feedback: myGrade.feedback, gradedAt: myGrade.gradedAt });
        }
      };

      const handleLiveGradeDelete = (data) => {
        if (!data || String(data.assignmentId) !== String(assignmentId)) return;
        const myGrade = getStudentGrade({ [data.studentId]: true }, { id: currentUser?.id, name: currentUser?.name, email: currentUser?.email }) ||
                        getStudentGrade({ [data.studentId]: true }, studentId) ||
                        getStudentGrade({ [data.studentId]: true }, safeUsername);
        if (myGrade) {
          setGradeData(null);
        }
      };

      socket.on('student_unsubmitted', handleSocketUnsub);
      socket.on('teacher_student_unsubmitted', handleSocketUnsub);
      socket.on('grade_updated', handleLiveGradeUpdate);
      socket.on('bulk_grades_updated', handleLiveBulkGradesUpdate);
      socket.on('grade_deleted', handleLiveGradeDelete);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorageUpdate);
      if (socket) {
        if (handleSocketUnsub) {
          socket.off('student_unsubmitted', handleSocketUnsub);
          socket.off('teacher_student_unsubmitted', handleSocketUnsub);
        }
        socket.off('grade_updated');
        socket.off('bulk_grades_updated');
        socket.off('grade_deleted');
      }
    };
  }, [assignmentId, classroomId, studentId, safeUsername, submissionKey, gradesKey, socket, currentUser]);

  // Handle Submit action
  const handleSubmit = () => {
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = () => {
    setShowSubmitModal(false);
    let currentCode = "";
    try {
      currentCode = localStorage.getItem(draftCodeKey) || "";
    } catch { /* ignore */ }

    if (!currentCode) {
      currentCode = assignment?.starterCode || "";
    }

    // Resolve complete history from persistent history keys / localStore / submission
    const hKeys = [
      `verity_history_${classroomId}_${assignmentId}_${studentId}`,
      `verity_history_${classroomId}_${assignmentId}_${safeUsername}`,
      currentUser?.name ? `verity_history_${classroomId}_${assignmentId}_${currentUser.name}` : null,
      currentUser?.email ? `verity_history_${classroomId}_${assignmentId}_${currentUser.email}` : null,
      `verity_history_${assignmentId}_${studentId}`,
      `verity_history_${assignmentId}_${safeUsername}`
    ].filter(Boolean);

    let resolvedHistory = [];
    for (const hk of hKeys) {
      try {
        const item = localStorage.getItem(hk);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed) && parsed.length > resolvedHistory.length) {
            resolvedHistory = parsed;
          }
        }
      } catch {}
    }

    if (resolvedHistory.length === 0) {
      const priorH = submission?.codeHistory || submission?.history;
      if (Array.isArray(priorH) && priorH.length > 0) {
        resolvedHistory = priorH;
      }
    }

    if (resolvedHistory.length === 0) {
      resolvedHistory = [{ time: Date.now(), code: currentCode }];
    }

    // Ensure persistent history has this
    hKeys.forEach(hk => {
      try { localStorage.setItem(hk, JSON.stringify(resolvedHistory)); } catch {}
    });
    try {
      localStore.saveDraft(assignmentId, studentId, currentCode, resolvedHistory);
    } catch {}

    const subData = {
      studentName: safeUsername,
      studentId: studentId,
      assignmentId: assignmentId,
      classroomId: classroomId,
      finalCode: currentCode,
      codeHistory: resolvedHistory,
      submittedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };

    const allKeys = [
      submissionKey,
      `verity_sub_${classroomId}_${assignmentId}_${studentId}`,
      `verity_sub_${classroomId}_${assignmentId}_${safeUsername}`,
      currentUser?.name ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.name}` : null,
      currentUser?.email ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.email}` : null,
      currentUser?.id ? `verity_sub_${classroomId}_${assignmentId}_id_${currentUser.id}` : null
    ].filter(Boolean);
    allKeys.forEach(k => {
      try { localStorage.setItem(k, JSON.stringify(subData)); } catch { }
    });
    setSubmission(subData);

    // Save to backend database
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${assignmentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: safeUsername,
        studentId: studentId,
        finalCode: currentCode,
        codeHistory: resolvedHistory,
        classroomId: classroomId
      })
    }).catch(() => {});

    if (socket) {
      socket.emit('submit_exam', {
        studentName: safeUsername,
        studentId: studentId,
        assignmentId: assignmentId,
        finalCode: currentCode,
        classroomId: classroomId,
        codeHistory: resolvedHistory
      });
    }

    try {
      window.dispatchEvent(new CustomEvent('verity:submission-updated', {
        detail: {
          assignmentId: assignmentId,
          classroomId: classroomId,
          submitted: true
        }
      }));
    } catch {}
  };

  // Handle Unsubmit action
  const handleUnsubmit = () => {
    setShowUnsubmitModal(true);
  };

  const handleConfirmUnsubmit = () => {
    setShowUnsubmitModal(false);

    // Preserve existing history into persistent history keys before removing submission
    const existingHist = submission?.codeHistory || submission?.history;
    const hKeys = [
      `verity_history_${classroomId}_${assignmentId}_${studentId}`,
      `verity_history_${classroomId}_${assignmentId}_${safeUsername}`,
      currentUser?.name ? `verity_history_${classroomId}_${assignmentId}_${currentUser.name}` : null,
      currentUser?.email ? `verity_history_${classroomId}_${assignmentId}_${currentUser.email}` : null,
      `verity_history_${assignmentId}_${studentId}`,
      `verity_history_${assignmentId}_${safeUsername}`
    ].filter(Boolean);

    if (Array.isArray(existingHist) && existingHist.length > 0) {
      hKeys.forEach(hk => {
        try {
          const cur = localStorage.getItem(hk);
          if (!cur || JSON.parse(cur).length < existingHist.length) {
            localStorage.setItem(hk, JSON.stringify(existingHist));
          }
        } catch {}
      });
      try {
        localStore.saveDraft(assignmentId, studentId, submission?.finalCode || '', existingHist);
      } catch {}
    }

    const keysToRemove = [
      submissionKey,
      `verity_sub_${classroomId}_${assignmentId}_${studentId}`,
      `verity_sub_${classroomId}_${assignmentId}_${safeUsername}`,
      currentUser?.name ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.name}` : null,
      currentUser?.email ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.email}` : null,
      currentUser?.id ? `verity_sub_${classroomId}_${assignmentId}_id_${currentUser.id}` : null
    ].filter(Boolean);

    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch { }
    });
    setSubmission(null);

    // Call backend endpoint & socket
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${assignmentId}/${encodeURIComponent(safeUsername)}`, {
      method: 'DELETE'
    }).catch(() => {});
    if (studentId && studentId !== safeUsername) {
      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${assignmentId}/${encodeURIComponent(studentId)}`, {
        method: 'DELETE'
      }).catch(() => {});
    }

    if (socket) {
      socket.emit('unsubmit_exam', {
        studentName: safeUsername,
        studentId: studentId,
        assignmentId: assignmentId,
        classroomId: classroomId
      });
    }

    try {
      window.dispatchEvent(new CustomEvent('verity:submission-updated', {
        detail: {
          assignmentId: assignmentId,
          classroomId: classroomId,
          submitted: false
        }
      }));
    } catch {}
  };

  const pointsText = assignment?.points ? `${assignment.points} points` : '100 points';
  const dueDateText = assignment?.dueDate ? `Due : ${assignment.dueDate}` : 'No due date';
  const title = assignment?.title || "Activity Details";
  const details = assignment?.details || assignment?.description || "No instructions provided for this activity.";
  const displayScore = gradeData?.grade != null ? gradeData.grade : null;
  const feedbackText = gradeData?.feedback || (gradeData?.grade != null ? "No written feedback provided." : "No feedback yet. Your submission is pending instructor review.");

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={styles.container}
    >
      {/* ═══ GLOBAL TOP HEADER ═══ */}
      <header 
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
        borderBottom: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: 0,
          right: 0,
          height: '30px',
          background: `linear-gradient(to bottom, ${isDark ? '#1a1a1a' : '#f8f9fa'}, transparent)`,
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }} onClick={() => {
          if (onBack) onBack();
          else if (onNavigateView) onNavigateView('classrooms');
        }}>
          <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
          <span style={{ color: isDark ? '#f5f5f5' : '#111827', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
          <span style={{ fontSize: '0.7rem', color: isDark ? '#a3a3a3' : '#6b7280', marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</span>
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
            { id: 'compiler', label: 'Compiler', Icon: Code2 },
            { id: 'settings', label: 'Settings', Icon: Settings }
          ].map(item => (
            <button
              key={item.id}
              ref={el => headerNavRefs.current[item.id] = el}
              onClick={() => {
                if (onNavigateView) onNavigateView(item.id);
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
                color: item.id === 'classrooms' ? '#10b981' : (isDark ? '#a3a3a3' : '#6b7280'),
                fontWeight: item.id === 'classrooms' ? '700' : '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <item.Icon size={18} />
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: '16px' }}>
          <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
        </div>
      </header>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ═══ MAIN CONTENT AREA ═══ */}
        <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', backgroundColor: isDark ? '#141414' : '#f8fafc', overflowY: 'auto' }}>
          {loading || !assignment ? (
            <Skeleton.ActivityDetail />
          ) : (
            <div style={{ maxWidth: '1100px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
              
              {/* Top Navigation Row (Outside the card) */}
              <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '24px' }}>
                <button
                  onClick={onBack}
                  style={styles.backBtn}
                >
                  <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Back to Activities
                </button>
              </div>

              {/* Main Dark Card */}
              <div style={{ 
                backgroundColor: isDark ? '#2E2E2E' : '#ffffff', 
                borderRadius: '16px', 
                border: isDark ? '1px solid #484848' : '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.4)' : '0 10px 30px rgba(0,0,0,0.04)'
              }}>
                
                {/* Banner Header */}
                <div style={{ 
                  background: isDark ? '#262626' : '#f8fafc',
                  padding: '40px 32px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  borderBottom: isDark ? '1px solid #484848' : '1px solid #e2e8f0'
                }}>
                  {/* Icon Block */}
                  <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                    <ClipboardList size={28} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      ACTIVITY DETAILS
                    </span>
                    <h1 style={{ fontSize: '2.2rem', fontWeight: 'bold', color: isDark ? 'white' : '#0f172a', margin: 0, lineHeight: 1.1, wordBreak: 'break-word' }}>
                      {title}
                    </h1>
                  </div>
                </div>

                {/* Meta Strip */}
                <div style={{ 
                  backgroundColor: isDark ? '#262626' : '#ffffff', 
                  borderBottom: isDark ? '1px solid #484848' : '1px solid #e2e8f0',
                  padding: '16px 32px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '32px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Award size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>Points</span>
                      <span style={{ fontSize: '0.9rem', color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: 'bold' }}>{pointsText}</span>
                    </div>
                  </div>
                  
                  <div style={{ width: '1px', height: '28px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5', padding: '6px', borderRadius: '8px', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>Due</span>
                      <span style={{ fontSize: '0.9rem', color: isDark ? '#e2e8f0' : '#1e293b', fontWeight: 'bold' }}>{dueDateText === 'No Due Date' ? 'No Due Date' : dueDateText}</span>
                    </div>
                  </div>
                </div>

                {/* Instructions Area */}
                <div style={{ padding: '32px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: isDark ? 'white' : '#1e293b', margin: '0 0 16px 0' }}>
                    Instructions
                  </h3>
                  
                  <div style={{ 
                    backgroundColor: isDark ? '#262626' : '#f8fafc', 
                    borderRadius: '12px', 
                    padding: '24px', 
                    minHeight: '180px',
                    border: isDark ? '1px solid #444444' : '1px solid #e2e8f0'
                  }}>
                    <div 
                      style={{ ...styles.instructionText, whiteSpace: 'normal', margin: 0, color: isDark ? '#d1d5db' : '#334155' }}
                      dangerouslySetInnerHTML={{ __html: details }}
                    />
                    
                    {/* Attachments if any */}
                    {assignment?.attachments?.length > 0 && (
                      <div style={styles.cardAttachments}>
                        {assignment.attachments.map((att, i) => (
                          <AttachmentCard
                            key={i}
                            att={att}
                            isDark={isDark}
                            onClick={(clickedAtt) => {
                              if (clickedAtt.type === 'image') setPreviewImage(clickedAtt);
                              else if (clickedAtt.type === 'video') setPreviewVideo(clickedAtt);
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
                  
                  {/* Action Buttons (Submit, Start) */}
                  {!isSubmitted ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '32px' }}>
                      <button
                        onClick={handleSubmit}
                        style={{
                          backgroundColor: 'transparent',
                          color: isDark ? 'white' : '#1e293b',
                          border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                          borderRadius: '50px',
                          padding: '9px 28px',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Submit
                      </button>

                      <button
                        onClick={onStartCoding}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50px',
                          padding: '9px 28px',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          boxShadow: '0 4px 6px rgba(16,185,129,0.2)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Start <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '32px' }}>
                      {/* Submitted state */}
                      <div style={{ ...styles.submissionBox, backgroundColor: isDark ? '#1a201e' : '#ecfdf5', border: isDark ? '1px solid #232a29' : '1px solid #d1fae5' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <CheckCircle2 size={22} color="#10b981" />
                          <div>
                            <span style={{ fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.95rem' }}>
                              Code Submitted
                            </span>
                            <span style={{ fontSize: '0.8rem', color: isDark ? '#9AA0A6' : '#64748b', marginLeft: '10px' }}>
                              {submission?.submittedAt ? `Turned in on ${submission.submittedAt}` : 'Turned in'}
                            </span>
                            {displayScore !== null && (
                              <span style={{ fontSize: '0.8rem', color: '#10b981', marginLeft: '10px', fontWeight: 'bold' }}>
                                Score: {displayScore} / {assignment?.points || 100} pts
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={onStartCoding}
                            style={{
                              ...styles.viewCodeBtn,
                              backgroundColor: isDark ? '#262626' : '#f1f5f9',
                              color: isDark ? '#E8EAED' : '#334155',
                              border: isDark ? '1px solid #404040' : '1px solid #cbd5e1'
                            }}
                            title="Open workspace in read-only mode"
                          >
                            <TerminalSquare size={15} style={{ marginRight: '5px' }} /> View Workspace
                          </button>
                          <button
                            onClick={() => setShowCodePreview(true)}
                            style={styles.viewCodeBtn}
                          >
                            <Code2 size={15} style={{ marginRight: '5px' }} /> View Code
                          </button>
                        </div>
                      </div>

                      {/* Instructor Feedback if available */}
                      {(gradeData?.grade != null || gradeData?.feedback) && (
                        <div style={{ marginTop: '16px' }}>
                          <div style={styles.feedbackHeading}>Instructor Feedback</div>
                          <div style={{ ...styles.feedbackBox, backgroundColor: isDark ? '#1a201e' : '#f8fafc', border: isDark ? '1px solid #232a29' : '1px solid #e2e8f0' }}>
                            <p style={{ margin: 0, color: isDark ? '#E8EAED' : '#334155', fontSize: '0.95rem', lineHeight: '1.5' }}>
                              {feedbackText}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Unsubmit Option */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
                        <button
                          onClick={handleUnsubmit}
                          style={{
                            backgroundColor: 'transparent',
                            color: isDark ? 'white' : '#1e293b',
                            border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '10px 24px',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Unsubmit
                        </button>
                      </div>
                    </div>
                  )}
                  
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Code Preview Modal */}
      {showCodePreview && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code2 size={20} color="#10b981" />
                <h3 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.1rem' }}>Submitted C# Code</h3>
              </div>
              <button
                onClick={() => setShowCodePreview(false)}
                style={styles.closeModalBtn}
              >
                <X size={20} />
              </button>
            </div>
            <pre style={styles.modalCodeBody}>
              {submission?.finalCode || "No code found."}
            </pre>
          </div>
        </div>
      )}

      {/* SUBMIT CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowSubmitModal(false)}
        >
          <div
            style={{
              backgroundColor: isDark ? '#242424' : '#ffffff',
              color: isDark ? '#E8EAED' : '#1e293b',
              borderRadius: '18px',
              padding: '24px 28px',
              width: '90%',
              maxWidth: '460px',
              boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: isDark ? '1px solid #3d3d3d' : '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle2 size={22} color="#10b981" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: isDark ? '#f3f4f6' : '#0f172a' }}>
                    Submit Activity
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#64748b', marginTop: '2px' }}>
                    {assignment?.title || 'Classroom Activity'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#9ca3af' : '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: isDark ? '#d1d5db' : '#334155' }}>
              Are you ready to submit your work for this activity? Once submitted, your solution will be handed in to your instructor for grading.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #4b5563' : '1px solid #cbd5e1',
                  backgroundColor: 'transparent',
                  color: isDark ? '#d1d5db' : '#475569',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Check size={16} />
                Submit Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNSUBMIT CONFIRMATION MODAL */}
      {showUnsubmitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowUnsubmitModal(false)}
        >
          <div
            style={{
              backgroundColor: isDark ? '#242424' : '#ffffff',
              color: isDark ? '#E8EAED' : '#1e293b',
              borderRadius: '18px',
              padding: '24px 28px',
              width: '90%',
              maxWidth: '460px',
              boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: isDark ? '1px solid #3d3d3d' : '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ArrowLeft size={20} color="#3b82f6" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: isDark ? '#f3f4f6' : '#0f172a' }}>
                    Unsubmit Activity
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#64748b', marginTop: '2px' }}>
                    {assignment?.title || 'Classroom Activity'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnsubmitModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#9ca3af' : '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: isDark ? '#d1d5db' : '#334155' }}>
              Are you sure you want to unsubmit? You will be able to edit and re-submit your code.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowUnsubmitModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #4b5563' : '1px solid #cbd5e1',
                  backgroundColor: 'transparent',
                  color: isDark ? '#d1d5db' : '#475569',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUnsubmit}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                Confirm Unsubmit
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
            { id: 'classrooms', Icon: Home, label: 'Home' },
            { id: 'calendar', Icon: Calendar, label: 'Calendar' },
            { id: 'workspace', Icon: TerminalSquare, label: 'Compiler' },
            { id: 'archived', Icon: Archive, label: 'Archived' },
            { id: 'settings', Icon: Settings, label: 'Settings' }
          ].map(({ id, Icon, label }) => {
            return (
              <button
                key={id}
                onClick={() => {
                  if (onNavigateView) onNavigateView(id);
                  else onBack();
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

const getStyles = (isDark, isMobile) => ({
  container: {
    height: '100vh',
    height: '100dvh', // for mobile browsers
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isDark ? '#3C3C3C' : '#EEF0F3',
    color: isDark ? '#E8EAED' : 'inherit',
    fontFamily: 'Arial, Helvetica, sans-serif',
    position: 'relative',
    overflow: 'hidden'
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
    position: 'sticky',
    top: 0
  },
  menuButton: {
    background: 'none',
    border: 'none',
    padding: '6px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: isDark ? '#ffffff' : '#64748b',
    flexShrink: 0,
    marginRight: '16px'
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'baseline',
    fontSize: isMobile ? '2rem' : '2.5rem',
    fontWeight: '900',
    fontStyle: 'italic',
    cursor: 'pointer'
  },
  badge: { 
    fontSize: '0.7rem', 
    backgroundColor: isDark ? '#2c2f38' : '#EEF0F3', 
    color: isDark ? '#E8EAED' : '#475569', 
    padding: '3px 8px', 
    borderRadius: '10px', 
    marginLeft: '6px', 
    fontStyle: 'normal', 
    transform: 'translateY(-5px)', 
    border: isDark ? '1px solid #3d424f' : '1px solid #cbd5e1' 
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
  navButton: (collapsed) => ({
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
  navLabel: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: isDark ? '#E8EAED' : '#334155',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  enrolledHeading: {
    padding: '0 18px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    color: isDark ? '#10b981' : '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px'
  },
  mainContent: {
    flex: 1,
    padding: isMobile ? '10px 16px 16px' : '16px 28px 24px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflowY: 'auto'
  },
  whiteCard: {
    backgroundColor: isDark ? '#323232' : 'white',
    flex: 1,
    borderRadius: '28px',
    padding: isMobile ? '20px 24px' : '32px 48px 40px',
    boxShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.25)' : '0 10px 30px rgba(0, 0, 0, 0.04)',
    border: isDark ? '1px solid #4A4A4A' : 'none',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box'
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: isDark ? '#E8EAED' : '#64748b',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '4px 0',
    transition: 'color 0.15s'
  },
  titlePill: {
    backgroundColor: isDark ? '#3E3E3E' : '#bcbfc5',
    color: isDark ? '#E8EAED' : '#334155',
    border: isDark ? '1px solid #4E4E4E' : 'none',
    fontWeight: '700',
    fontSize: '1rem',
    padding: '10px 28px',
    borderRadius: '50px',
    display: 'inline-block',
    alignSelf: 'flex-start',
    letterSpacing: '0.01em',
    maxWidth: '85%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  divider: {
    height: '1px',
    backgroundColor: isDark ? '#4A4A4A' : '#cbd5e1',
    margin: '18px 0',
    width: '100%'
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 4px'
  },
  pointsText: {
    fontSize: '0.92rem',
    color: isDark ? '#E8EAED' : '#1e293b',
    fontWeight: '700'
  },
  dueText: {
    fontSize: '0.88rem',
    color: isDark ? '#9AA0A6' : '#475569',
    fontWeight: '500'
  },
  scoreText: {
    fontSize: '0.95rem',
    color: isDark ? '#E8EAED' : '#1e293b',
    fontWeight: '700',
    letterSpacing: '0.01em'
  },
  detailsBox: {
    backgroundColor: isDark ? '#282828' : '#f3f4f6',
    border: isDark ? '1px solid #3E3E3E' : 'none',
    borderRadius: '24px',
    padding: '28px 32px',
    minHeight: '220px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start'
  },
  instructionText: {
    margin: 0,
    color: isDark ? '#E8EAED' : '#1f2937',
    fontSize: '1rem',
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap'
  },
  cardAttachments: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '12px',
    marginTop: '20px',
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
  buttonRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '24px',
    marginTop: '36px'
  },
  submitBtn: {
    backgroundColor: isDark ? '#2a2d36' : '#374151',
    color: '#ffffff',
    border: isDark ? '1px solid #3c404d' : 'none',
    borderRadius: '50px',
    padding: '12px 46px',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: isDark 
      ? '0 0 12px rgba(255, 255, 255, 0.06), 0 2px 6px rgba(0, 0, 0, 0.35)' 
      : '0 2px 8px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.04)',
    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease'
  },
  startBtn: {
    backgroundColor: '#15803d',
    color: '#ffffff',
    border: 'none',
    borderRadius: '50px',
    padding: '12px 46px',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: isDark 
      ? '0 0 18px rgba(21, 128, 61, 0.45), 0 2px 6px rgba(0, 0, 0, 0.35)' 
      : '0 4px 12px rgba(21, 128, 61, 0.28), 0 1px 2px rgba(0, 0, 0, 0.06)',
    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease'
  },
  submissionBox: {
    backgroundColor: isDark ? '#15171c' : '#c4c8cd',
    border: isDark ? '1px solid #262932' : 'none',
    borderRadius: '24px',
    padding: '18px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: '48px'
  },
  viewCodeBtn: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: isDark ? '#262932' : 'rgba(255,255,255,0.9)',
    color: isDark ? '#E8EAED' : '#1e293b',
    border: isDark ? '1px solid #3c404d' : '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: isDark 
      ? '0 0 10px rgba(255, 255, 255, 0.04), 0 1px 4px rgba(0, 0, 0, 0.3)' 
      : '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.03)',
    transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  feedbackHeading: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: isDark ? '#E8EAED' : '#1e293b',
    marginTop: '22px',
    marginBottom: '10px',
    paddingLeft: '4px'
  },
  feedbackBox: {
    backgroundColor: isDark ? '#282828' : '#c4c8cd',
    border: isDark ? '1px solid #3E3E3E' : 'none',
    borderRadius: '24px',
    padding: '22px 28px',
    minHeight: '60px',
    display: 'flex',
    alignItems: 'center'
  },
  unsubmitBtn: {
    backgroundColor: isDark ? '#4A4A4A' : '#374151',
    color: '#ffffff',
    border: isDark ? '1px solid #5A5A5A' : 'none',
    borderRadius: '50px',
    padding: '12px 52px',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: isDark 
      ? '0 0 12px rgba(255, 255, 255, 0.06), 0 2px 6px rgba(0, 0, 0, 0.35)' 
      : '0 2px 8px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.04)',
    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
  },
  modalCard: {
    backgroundColor: isDark ? '#323232' : '#ffffff',
    border: isDark ? '1px solid #4A4A4A' : 'none',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '750px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.4)' : '0 20px 40px rgba(0,0,0,0.2)',
    overflow: 'hidden'
  },
  modalHeader: {
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0'
  },
  closeModalBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: isDark ? '#a3a3a3' : '#64748b',
    display: 'flex',
    alignItems: 'center'
  },
  modalCodeBody: {
    margin: 0,
    padding: '20px',
    backgroundColor: isDark ? '#141414' : '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    overflowY: 'auto',
    flex: 1
  }
});
