import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, CheckCircle2, ClipboardList, Code2, PlayCircle, Award, 
  Calendar, Clock, Users, Sparkles, Check, X, Search, ChevronDown, 
  ChevronUp, Copy, Eye, FileText, Filter, AlertCircle, RefreshCw, Send,
  Home, Archive, Settings, CheckCheck
} from 'lucide-react';
import ProfileMenu from './ProfileMenu';
import { apiFetch } from '../utils/api';
import Skeleton from '../components/Skeleton';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import AttachmentCard from '../components/AttachmentCard';
import ImagePreviewModal from '../components/ImagePreviewModal';
import VideoPreviewModal from '../components/VideoPreviewModal';
import IframePreviewModal from '../components/IframePreviewModal';
import VideoAttachment from '../components/VideoAttachment';
import { getStudentGrade, isStudentGraded, formatGradeScore } from '../utils/gradeUtils';
import { formatShortDate, formatFullDate } from '../utils/dateUtils';

export default function TeacherGrading({
  classroom,
  assignment,
  onBack,
  onLogout,
  onStartMonitoring,
  onOpenPlayback,
  onEnterClassroom,
  onNavigateView,
  socket,
  currentUser: propCurrentUser
}) {
  const { isDark } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const currentUser = propCurrentUser || (() => {
    try { return JSON.parse(localStorage.getItem('verity_user')); } catch { return null; }
  })();

  const maxPoints = parseInt(assignment?.points, 10) || 100;
  const assignmentId = assignment?.id ?? 'default';
  const classroomId = classroom?.id ?? 'default';
  const gradesKey = `verity_grades_${assignmentId}`;

  // State
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [totalEnrolledCount, setTotalEnrolledCount] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'ungraded' | 'graded'
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

  // Per-student grade & feedback
  const [grades, setGrades] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(gradesKey)) || {};
    } catch {
      return {};
    }
  });

  const [gradeInput, setGradeInput] = useState(String(maxPoints));
  const [feedbackInput, setFeedbackInput] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [saveError, setSaveError] = useState('');

  // Bulk Grading Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkGrade, setBulkGrade] = useState(String(maxPoints));
  const [bulkFeedback, setBulkFeedback] = useState('Great work on this assignment!');
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState('');

  // Code View & Modals
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [previewIframe, setPreviewIframe] = useState(null);

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

  // Top header indicator state
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [headerIndicatorStyle, setHeaderIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const headerNavRefs = useRef({});

  // 1. Load submissions + enrolled students
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);

      const submissionsMap = {};

      const normalizeReplayStudentName = (rawName, rawEmail = '') => {
        const trimmed = String(rawName || '').trim();
        const lower = trimmed.toLowerCase();
        const emailLower = String(rawEmail || '').trim().toLowerCase();
        if (
          emailLower === 'kimfabie123@gmail.com' ||
          lower === 'kimfabie123@gmail.com' ||
          lower === 'kimfabie' ||
          lower === 'kim fabie'
        ) {
          return 'MIKOOOOO';
        }
        return trimmed || 'Student';
      };

      const mergeIntoSubmissionsMap = (rawName, rawEmail, submittedAt, finalCode, history) => {
        const name = normalizeReplayStudentName(rawName, rawEmail);
        const low = name.toLowerCase();
        const histArr = Array.isArray(history) ? history : [];
        const resolvedCode = finalCode || (histArr.length > 0 ? histArr[histArr.length - 1]?.code : null) || null;
        const existing = submissionsMap[low];
        if (!existing) {
          submissionsMap[low] = {
            id: name,
            name: name,
            email: rawEmail || `${name.toLowerCase().replace(/\s+/g, '.')}@student.verity.edu`,
            submittedAt: submittedAt || null,
            finalCode: resolvedCode,
            history: histArr
          };
        } else {
          const newTime = new Date(submittedAt || 0).getTime();
          const oldTime = new Date(existing.submittedAt || 0).getTime();
          const preferNew = newTime > oldTime || (newTime === oldTime && histArr.length >= (existing.history?.length || 0));
          if (preferNew) {
            if (submittedAt) existing.submittedAt = submittedAt;
            if (resolvedCode) existing.finalCode = resolvedCode;
            if (histArr.length >= (existing.history?.length || 0)) existing.history = histArr;
          } else {
            if (!existing.finalCode && resolvedCode) existing.finalCode = resolvedCode;
            if (histArr.length > (existing.history?.length || 0)) existing.history = histArr;
          }
        }
      };

      // A. Load submissions from API
      if (assignment?.id) {
        try {
          const res = await apiFetch(`${import.meta.env.VITE_API_URL}/submissions/${assignment.id}`);
          if (res.ok) {
            const data = await res.json();
            const subs = Array.isArray(data?.submissions) ? data.submissions : [];
            subs.forEach(s => {
              mergeIntoSubmissionsMap(
                s.student_name || s.studentName || 'Student',
                s.student_email || s.studentEmail || '',
                s.submittedAt || s.submittedat || null,
                s.finalCode || null,
                s.history || []
              );
            });
          }
        } catch {}
      }

      // B. Also scan local storage for client submissions
      try {
        const cId = classroom?.id ?? 'default';
        const aId = assignment?.id ?? 'default';
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith(`verity_sub_${cId}_${aId}_`) || key.startsWith(`verity_sub_default_${aId}_`))) {
            const val = JSON.parse(localStorage.getItem(key));
            if (val && (val.studentName || val.studentId)) {
              const rawName = val.studentName || val.studentId;
              const normName = normalizeReplayStudentName(rawName, val.studentEmail || '');
              if (normName !== rawName) {
                try {
                  localStorage.setItem(key, JSON.stringify({ ...val, studentName: normName }));
                } catch {}
              }
              mergeIntoSubmissionsMap(
                normName,
                val.studentEmail || '',
                val.submittedAt || null,
                val.finalCode || null,
                val.codeHistory || val.history || []
              );
            }
          }
        }
      } catch {}

      // C. Check persistent playback history
      const cId = classroom?.id ?? 'default';
      const aId = assignment?.id ?? 'default';
      Object.keys(submissionsMap).forEach(key => {
        const s = submissionsMap[key];
        const hKeys = [
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

      // D. Count enrolled students for the "Assigned" stat in hero banner
      let enrolledCount = 0;
      if (classroom?.id) {
        const uniqueEnrolled = new Set();
        try {
          const res = await apiFetch(`${import.meta.env.VITE_API_URL}/classroom-students/${classroom.id}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.students)) {
              data.students.forEach(st => {
                if (st && st.name) uniqueEnrolled.add(st.name.toLowerCase());
              });
            }
          }
        } catch {}

        // Check local storage enrollments
        try {
          const localKey = `verity_classroom_enrollments_${classroom.id}`;
          const raw = localStorage.getItem(localKey);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              arr.forEach(st => {
                if (st && st.name) uniqueEnrolled.add(st.name.toLowerCase());
              });
            }
          }
        } catch {}

        enrolledCount = uniqueEnrolled.size;
        setTotalEnrolledCount(enrolledCount);
      }

      if (cancelled) return;

      const submissionList = Object.values(submissionsMap).sort((a, b) => {
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true });
      });

      setStudents(submissionList);

      // Select first student with submission if none selected
      setSelectedId(prev => {
        if (prev && submissionsMap[prev.toLowerCase()]) return prev;
        return submissionList[0]?.id || null;
      });

      setLoading(false);
    };

    loadData();

    // E. Load existing grades
    if (assignment?.id) {
      apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignment.id}`)
        .then(res => res.json())
        .then(data => {
          if (cancelled) return;
          if (data?.grades && Object.keys(data.grades).length > 0) {
            setGrades(prev => ({ ...prev, ...data.grades }));
          }
        })
        .catch(() => {});
    }

    // Socket & storage listeners
    const onStorage = () => loadData();
    window.addEventListener('storage', onStorage);

    const onNewSubmission = () => loadData();

    const onUnsubmit = (data) => {
      if (data?.studentName || data?.studentId) {
        const removedName = String(data.studentName || data.studentId || '').toLowerCase();
        setStudents(prev => prev.filter(s => String(s.name || '').toLowerCase() !== removedName && String(s.id || '').toLowerCase() !== removedName));
        setSelectedId(prev => {
          if (prev && String(prev).toLowerCase() === removedName) return null;
          return prev;
        });

        setGrades(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(k => {
            if (k.toLowerCase() === removedName) delete next[k];
          });
          return next;
        });

        // Delete from backend
        if (assignment?.id) {
          apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignment.id}/${encodeURIComponent(data.studentName || data.studentId)}`, {
            method: 'DELETE'
          }).catch(() => {});
        }
      }
      setTimeout(loadData, 500);
    };

    const onGradeUpdated = (data) => {
      if (!data || String(data.assignmentId) !== String(assignment?.id) || !data.studentId) return;
      setGrades(prev => ({
        ...prev,
        [data.studentId]: { grade: data.grade, feedback: data.feedback, gradedAt: data.gradedAt || new Date().toISOString() }
      }));
    };

    const onBulkGradesUpdated = (data) => {
      if (!data || String(data.assignmentId) !== String(assignment?.id) || !Array.isArray(data.grades)) return;
      setGrades(prev => {
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
      if (!data || String(data.assignmentId) !== String(assignment?.id) || !data.studentId) return;
      const target = String(data.studentId).toLowerCase();
      setGrades(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          if (k.toLowerCase() === target) delete next[k];
        });
        return next;
      });
    };

    if (socket) {
      socket.on('teacher_receive_submission', onNewSubmission);
      socket.on('teacher_student_unsubmitted', onUnsubmit);
      socket.on('student_unsubmitted', onUnsubmit);
      socket.on('grade_updated', onGradeUpdated);
      socket.on('bulk_grades_updated', onBulkGradesUpdated);
      socket.on('grade_deleted', onGradeDeleted);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      if (socket) {
        socket.off('teacher_receive_submission', onNewSubmission);
        socket.off('teacher_student_unsubmitted', onUnsubmit);
        socket.off('student_unsubmitted', onUnsubmit);
        socket.off('grade_updated', onGradeUpdated);
        socket.off('bulk_grades_updated', onBulkGradesUpdated);
        socket.off('grade_deleted', onGradeDeleted);
      }
    };
  }, [assignment?.id, classroom?.id, socket]);

  // Sync grades to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(gradesKey, JSON.stringify(grades));
    } catch {}
  }, [grades, gradesKey]);

  // Sync inputs when selected student changes
  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedId) || null;
  }, [students, selectedId]);

  useEffect(() => {
    if (selectedStudent) {
      const saved = getStudentGrade(grades, selectedStudent);
      setGradeInput(saved?.grade != null ? String(saved.grade) : String(maxPoints));
      setFeedbackInput(saved?.feedback || '');
      setSaveStatus('idle');
      setSaveError('');
    } else {
      setGradeInput(String(maxPoints));
      setFeedbackInput('');
      setSaveStatus('idle');
      setSaveError('');
    }
  }, [selectedStudent, grades, maxPoints]);

  // Evaluate single student
  const handleEvaluate = async () => {
    if (!selectedStudent) return;
    setSaveStatus('saving');
    setSaveError('');
    const now = new Date().toISOString();
    const studentIdentifier = selectedStudent.id || selectedStudent.name;

    const updated = {
      ...grades,
      [studentIdentifier]: { grade: gradeInput, feedback: feedbackInput, gradedAt: now }
    };
    setGrades(updated);
    try {
      localStorage.setItem(gradesKey, JSON.stringify(updated));
    } catch {}

    if (assignment?.id) {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignment.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: studentIdentifier, grade: gradeInput, feedback: feedbackInput })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to save grade');
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (err) {
        console.error('Error evaluating student:', err);
        setSaveStatus('error');
        setSaveError(err.message || 'Failed to save');
        setTimeout(() => setSaveStatus('idle'), 3500);
      }
    } else {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  // Clear single student grade
  const handleClearGrade = async () => {
    if (!selectedStudent) return;
    const studentIdentifier = selectedStudent.id || selectedStudent.name;
    const target = studentIdentifier.toLowerCase();

    setGrades(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (k.toLowerCase() === target) delete next[k];
      });
      return next;
    });

    if (assignment?.id) {
      try {
        await apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignment.id}/${encodeURIComponent(studentIdentifier)}`, {
          method: 'DELETE'
        });
      } catch {}
    }
  };

  // Bulk grade all turned in students
  const turnedInStudents = useMemo(() => {
    return students.filter(s => Boolean(s.submittedAt || s.finalCode));
  }, [students]);

  const gradedStudents = useMemo(() => {
    return students.filter(s => isStudentGraded(grades, s));
  }, [students, grades]);

  const ungradedStudents = useMemo(() => {
    return students.filter(s => !isStudentGraded(grades, s));
  }, [students, grades]);

  const handleBulkGrade = async () => {
    if (turnedInStudents.length === 0) return;
    const now = new Date().toISOString();
    const updated = { ...grades };
    const payload = [];

    turnedInStudents.forEach(s => {
      const sId = s.id || s.name;
      updated[sId] = { grade: bulkGrade, feedback: bulkFeedback, gradedAt: now };
      payload.push({ studentId: sId, grade: bulkGrade, feedback: bulkFeedback });
    });

    setGrades(updated);
    try {
      localStorage.setItem(gradesKey, JSON.stringify(updated));
    } catch {}

    if (assignment?.id) {
      try {
        await apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignment.id}/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grades: payload })
        });
      } catch {
        payload.forEach(p => {
          apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignment.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p)
          }).catch(() => {});
        });
      }
    }

    setBulkSuccessMsg(`Successfully graded all ${turnedInStudents.length} turned-in student(s)!`);
    setTimeout(() => setBulkSuccessMsg(''), 3500);
    setShowBulkModal(false);
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // Search match
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesEmail = s.email && s.email.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }
      // Tab filter
      const isGrad = isStudentGraded(grades, s);
      if (filterTab === 'ungraded' || filterTab === 'turned_in') return !isGrad;
      if (filterTab === 'graded') return isGrad;
      return true; // 'all'
    });
  }, [students, searchTerm, filterTab, grades]);

  // Copy code helper
  const handleCopyCode = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };


  // Quick grade presets
  const scorePresets = useMemo(() => {
    const list = [
      maxPoints,
      Math.round(maxPoints * 0.95),
      Math.round(maxPoints * 0.9),
      Math.round(maxPoints * 0.85),
      Math.round(maxPoints * 0.8),
      Math.round(maxPoints * 0.75),
      Math.round(maxPoints * 0.7),
      0
    ];
    return Array.from(new Set(list));
  }, [maxPoints]);

  const quickFeedbacks = [
    'Great job! Clean and well structured code.',
    'Good implementation, all requirements met.',
    'Solid attempt! Make sure to test edge cases.',
    'Check variable naming and indentation style.',
    'Needs better error handling and comments.'
  ];

  const styles = getStyles(isDark, isMobile);

  return (
    <div style={styles.container}>
      {/* ═══ STICKY GLASSMORPHIC TOP HEADER ═══ */}
      <header
        style={styles.header}
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => {
          setIsHeaderHovered(false);
          setHeaderIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }}
          onClick={() => {
            if (onBack) onBack();
            else if (onNavigateView) onNavigateView('classrooms');
          }}
        >
          <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
          <span style={{ color: isDark ? '#f5f5f5' : '#111827', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
          <span style={styles.instructorTag}>Instructor</span>
        </div>

        {/* Center Navigation */}
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
            left: headerIndicatorStyle.left,
            width: headerIndicatorStyle.width,
            top: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '50px',
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(16,185,129,0.15)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.35)',
            transition: headerIndicatorStyle.transition || 'none',
            opacity: headerIndicatorStyle.opacity,
            pointerEvents: 'none',
            zIndex: 0
          }} />

          {[
            { id: 'classrooms', label: 'Home', Icon: Home },
            { id: 'calendar', label: 'Calendar', Icon: Calendar },
            { id: 'archived', label: 'Archived', Icon: Archive },
            { id: 'settings', label: 'Settings', Icon: Settings }
          ].map(item => (
            <button
              key={item.id}
              ref={el => headerNavRefs.current[item.id] = el}
              onClick={() => {
                if (onNavigateView) onNavigateView(item.id);
                else onBack();
              }}
              onMouseEnter={(e) => {
                setHeaderIndicatorStyle({
                  left: e.currentTarget.offsetLeft,
                  width: e.currentTarget.offsetWidth,
                  opacity: 1,
                  transition: 'all 0.28s cubic-bezier(0.25, 1, 0.5, 1)'
                });
              }}
              style={styles.headerNavBtn(item.id === 'classrooms')}
            >
              <item.Icon size={17} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Profile Menu */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: '16px', marginRight: '24px' }}>
          <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
        </div>
      </header>

      {/* ═══ MAIN SCROLLABLE VIEWPORT ═══ */}
      <div style={styles.scrollArea}>
        <div style={styles.contentWrapper}>

          {/* ═══ SUBHEADER / BREADCRUMB BAR ═══ */}
          <div style={styles.breadcrumbBar}>
            <button
              onClick={onBack}
              style={styles.backBtn}
              className="btn-anim"
              title="Return to Classwork"
            >
              <ArrowLeft size={16} /> Back to Classwork
            </button>
          </div>

          {/* ═══ ACTIVITY HERO BANNER ═══ */}
          <div style={styles.heroCard}>
            <div style={styles.heroTopRow}>
              <div style={styles.heroLeft}>
                <div style={styles.heroIconBox}>
                  <ClipboardList size={26} color="#10b981" strokeWidth={2.2} />
                </div>
                <div>
                  <div style={styles.heroPreTitle}>Evaluation & Grading</div>
                  <h1 style={styles.heroTitle}>
                    {assignment?.title || 'Class Activity'}
                  </h1>

                  <div style={styles.heroMetaRow}>
                    <span style={styles.metaBadgeGray}>
                      <Award size={13} /> {maxPoints} Points
                    </span>
                    <span style={styles.metaBadgeGray}>
                      <Clock size={13} />
                      {assignment?.noDueDate ? 'No Due Date' : (assignment?.dueDate ? `Due ${formatShortDate(assignment.dueDate)}` : 'No Due Date')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Quick Stats & Toggle Instructions */}
              <div style={styles.heroRight}>
                <div style={styles.statsPillRow}>
                  <div style={styles.statPillItem}>
                    <span style={styles.statPillNum}>{turnedInStudents.length}</span>
                    <span style={styles.statPillLabel}>Turned In</span>
                  </div>
                  <div style={styles.statPillDivider} />
                  <div style={styles.statPillItem}>
                    <span style={styles.statPillNum}>{gradedStudents.length}</span>
                    <span style={styles.statPillLabel}>Graded</span>
                  </div>
                  <div style={styles.statPillDivider} />
                  <div style={styles.statPillItem}>
                    <span style={styles.statPillNum}>{totalEnrolledCount || students.length}</span>
                    <span style={styles.statPillLabel}>Assigned</span>
                  </div>
                </div>

                {(assignment?.details || assignment?.instruction || assignment?.attachments?.length > 0) && (
                  <button
                    onClick={() => setIsInstructionsOpen(prev => !prev)}
                    style={styles.toggleInstructionsBtn}
                    className="btn-anim"
                  >
                    {isInstructionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <span>{isInstructionsOpen ? 'Hide Activity Details' : 'View Activity Details'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Expandable Activity Details Drawer */}
            {isInstructionsOpen && (
              <div style={styles.instructionsDrawer}>
                <div style={styles.instructionsDivider} />
                <h4 style={styles.instructionsHeading}>Activity Instructions & Resources</h4>

                {assignment?.details || assignment?.instruction ? (
                  <div
                    style={styles.instructionsContent}
                    dangerouslySetInnerHTML={{
                      __html: assignment.details || assignment.instruction
                    }}
                    onClick={handleInstructionClick}
                  />
                ) : (
                  <p style={{ margin: 0, color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.9rem' }}>
                    No instructions specified for this activity.
                  </p>
                )}

                {/* Attachments */}
                {Array.isArray(assignment?.attachments) && assignment.attachments.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
                      Attachments & Materials ({assignment.attachments.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                      {assignment.attachments.map((att, i) => (
                        <AttachmentCard
                          key={i}
                          att={att}
                          isDark={isDark}
                          onClick={(clickedAtt) => {
                            if (clickedAtt.type === 'image') setPreviewImage(clickedAtt);
                            else if (clickedAtt.type === 'video') setPreviewVideo(clickedAtt);
                            else if (clickedAtt.url) setPreviewIframe(clickedAtt);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══ MAIN TWO-COLUMN WORKSPACE ═══ */}
          {loading ? (
            <div style={{ marginTop: '24px' }}>
              <Skeleton.Grading />
            </div>
          ) : (
            <div style={styles.workspaceGrid}>

              {/* ═══ LEFT COLUMN: STUDENT ROSTER ═══ */}
              <div style={styles.rosterCard}>
                <div style={styles.rosterHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={18} color="#10b981" />
                      <h3 style={styles.rosterTitle}>Class Roster</h3>
                      <span style={styles.rosterCountBadge}>{filteredStudents.length}</span>
                    </div>

                    {turnedInStudents.length > 0 && (
                      <button
                        onClick={() => setShowBulkModal(true)}
                        style={styles.bulkGradeBtn}
                        className="btn-anim"
                        title="Grade all turned in students in one click"
                      >
                        <Sparkles size={14} /> Grade All
                      </button>
                    )}
                  </div>

                  {bulkSuccessMsg && (
                    <div style={styles.bulkToast}>
                      <Check size={14} /> {bulkSuccessMsg}
                    </div>
                  )}

                  {/* Filter Pills */}
                  <div style={styles.filterPillsRow}>
                    {[
                      { id: 'all', label: `All (${students.length})` },
                      { id: 'ungraded', label: `Ungraded (${ungradedStudents.length})` },
                      { id: 'graded', label: `Graded (${gradedStudents.length})` }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setFilterTab(tab.id)}
                        style={styles.filterPillBtn(filterTab === tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div style={styles.searchWrapper}>
                    <Search size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                    <input
                      type="text"
                      placeholder="Search student name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={styles.searchInput}
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} style={styles.clearSearchBtn}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Scrollable Student List */}
                <div style={styles.studentList}>
                  {filteredStudents.length === 0 ? (
                    <div style={styles.emptyRoster}>
                      <AlertCircle size={32} color={isDark ? '#4b5563' : '#cbd5e1'} style={{ margin: '0 auto 8px auto' }} />
                      <p style={{ margin: 0, fontWeight: '600', color: isDark ? '#e2e8f0' : '#334155' }}>
                        {searchTerm ? 'No matching students' : 'No Submissions Yet'}
                      </p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                        {searchTerm ? 'Try adjusting your search filter' : 'Students will appear in this roster once they submit their work.'}
                      </p>
                    </div>
                  ) : (
                    filteredStudents.map(student => {
                      const isSelected = selectedId === student.id;
                      const isGrad = isStudentGraded(grades, student);
                      const curGrade = getStudentGrade(grades, student);

                      return (
                        <div
                          key={student.id}
                          onClick={() => setSelectedId(student.id)}
                          style={styles.studentRow(isSelected)}
                          className="btn-anim"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            <div style={styles.studentAvatar(isGrad ? 'graded' : 'turned_in')}>
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={styles.studentRowName(isSelected)}>
                                {student.name}
                              </div>
                              <div style={styles.studentRowSub}>
                                {student.submittedAt ? `Turned in ${formatShortDate(student.submittedAt)}` : 'Turned In'}
                              </div>
                            </div>
                          </div>

                          <div style={{ flexShrink: 0 }}>
                            {isGrad ? (
                              <span style={styles.statusBadgeGraded}>
                                <Check size={11} strokeWidth={3} /> {curGrade?.grade ?? maxPoints}/{maxPoints}
                              </span>
                            ) : (
                              <span style={styles.statusBadgeTurnedIn}>
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

              {/* ═══ RIGHT COLUMN: EVALUATION DESK ═══ */}
              <div style={styles.evalCard}>
                {!selectedStudent ? (
                  <div style={styles.emptyEval}>
                    <ClipboardList size={52} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
                    <h3 style={{ margin: 0, color: isDark ? '#f1f5f9' : '#0f172a', fontSize: '1.2rem', fontWeight: '700' }}>
                      Select a Student
                    </h3>
                    <p style={{ margin: '6px 0 0 0', color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.9rem', maxWidth: '360px', lineHeight: 1.5 }}>
                      Choose a student from the roster on the left to inspect their submitted code, review VCR proctoring playback, and assign their score and feedback.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Selected Student Banner */}
                    <div style={styles.evalStudentHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                        <div style={styles.evalLargeAvatar}>
                          {selectedStudent.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h2 style={styles.evalStudentName}>
                            {selectedStudent.name}
                          </h2>
                          <div style={styles.evalStudentSub}>
                            {selectedStudent.submittedAt ? (
                              <span style={{ color: isDark ? '#34d399' : '#059669', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                                <CheckCircle2 size={14} /> Turned in on {formatFullDate(selectedStudent.submittedAt)}
                              </span>
                            ) : selectedStudent.finalCode ? (
                              <span style={{ color: isDark ? '#34d399' : '#059669', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                                <CheckCircle2 size={14} /> Code Submitted
                              </span>
                            ) : (
                              <span style={{ color: isDark ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={14} /> Activity Assigned (No submission yet)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => {
                            const handler = onOpenPlayback || onStartMonitoring;
                            if (handler) handler(assignment, selectedStudent);
                          }}
                          style={styles.playbackActionBtn}
                          className="btn-anim"
                          title="Open Proctoring Playback timeline for this student"
                        >
                          <PlayCircle size={16} /> Proctoring Playback
                        </button>

                        {selectedStudent.finalCode && (
                          <button
                            onClick={() => setShowCodeModal(true)}
                            style={styles.fullscreenCodeBtn}
                            className="btn-anim"
                            title="Expand code in fullscreen modal"
                          >
                            <Code2 size={16} /> Fullscreen
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Submitted Code Preview */}
                    <div style={styles.codeSnippetSection}>
                      <div style={styles.codeSnippetHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Code2 size={16} color="#10b981" />
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                            Submitted Code
                          </span>
                          {selectedStudent.finalCode && (
                            <span style={styles.codeLengthBadge}>
                              {selectedStudent.finalCode.split('\n').length} lines
                            </span>
                          )}
                        </div>

                        {selectedStudent.finalCode && (
                          <button
                            onClick={() => handleCopyCode(selectedStudent.finalCode)}
                            style={styles.copyCodeBtn}
                            className="btn-anim"
                          >
                            {copiedCode ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                          </button>
                        )}
                      </div>

                      <div style={styles.codeBlockWrapper}>
                        {selectedStudent.finalCode ? (
                          <pre style={styles.codePre}>
                            <code>{selectedStudent.finalCode}</code>
                          </pre>
                        ) : (
                          <div style={styles.emptyCodeNotice}>
                            <AlertCircle size={24} color={isDark ? '#64748b' : '#94a3b8'} style={{ margin: '0 auto 6px auto' }} />
                            <span>No code has been submitted or saved yet for this student.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ═══ GRADING DESK: SCORE & FEEDBACK ═══ */}
                    <div style={styles.gradingFormCard}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Award size={18} color="#10b981" />
                          <span style={{ fontSize: '0.98rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#0f172a' }}>
                            Evaluation & Scoring
                          </span>
                        </div>

                        {isStudentGraded(grades, selectedStudent) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.78rem', color: isDark ? '#34d399' : '#059669', fontWeight: '600' }}>
                              ✓ Graded {getStudentGrade(grades, selectedStudent)?.gradedAt ? formatShortDate(getStudentGrade(grades, selectedStudent).gradedAt) : ''}
                            </span>
                            <button
                              onClick={handleClearGrade}
                              style={styles.clearGradeBtn}
                              title="Clear grade from this student"
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Score Input + Presets */}
                      <div style={{ marginBottom: '18px' }}>
                        <label style={styles.inputLabel}>
                          Score (out of {maxPoints} pts):
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="number"
                              min="0"
                              max={maxPoints}
                              value={gradeInput}
                              onChange={(e) => setGradeInput(e.target.value)}
                              style={styles.scoreInput}
                            />
                            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>
                              / {maxPoints}
                            </span>
                          </div>

                          {/* Preset Score Pills */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {scorePresets.map(preset => {
                              const isActive = String(gradeInput) === String(preset);
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setGradeInput(String(preset))}
                                  style={styles.scorePresetBtn(isActive)}
                                  className="btn-anim"
                                >
                                  {preset}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Feedback Textarea */}
                      <div style={{ marginBottom: '18px' }}>
                        <label style={styles.inputLabel}>
                          Private Feedback & Notes:
                        </label>
                        <textarea
                          rows={3}
                          value={feedbackInput}
                          onChange={(e) => setFeedbackInput(e.target.value)}
                          placeholder={`Leave constructive feedback or review comments for ${selectedStudent.name}...`}
                          style={styles.feedbackTextarea}
                        />

                        {/* Quick feedback suggestions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                          <span style={{ fontSize: '0.72rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '600' }}>
                            Suggestions:
                          </span>
                          {quickFeedbacks.map((q, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setFeedbackInput(prev => prev ? `${prev} ${q}` : q);
                              }}
                              style={styles.quickFeedbackPill}
                              className="btn-anim"
                            >
                              + {q}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Evaluate CTA Row */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '14px', paddingTop: '10px', borderTop: isDark ? '1px solid #3d3d3d' : '1px solid #f1f5f9' }}>
                        {saveStatus === 'error' && (
                          <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '600' }}>
                            {saveError || 'Failed to save grade'}
                          </span>
                        )}

                        <button
                          onClick={handleEvaluate}
                          disabled={saveStatus === 'saving'}
                          style={styles.evaluateSubmitBtn(saveStatus)}
                          className="btn-anim"
                        >
                          {saveStatus === 'saving' ? (
                            <>
                              <RefreshCw size={16} className="spin" />
                              <span>Saving...</span>
                            </>
                          ) : saveStatus === 'saved' ? (
                            <>
                              <CheckCheck size={16} />
                              <span>Grade Saved!</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={16} />
                              <span>{isStudentGraded(grades, selectedStudent) ? 'Update Grade' : 'Save Grade'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ═══ FULLSCREEN CODE MODAL ═══ */}
      {showCodeModal && selectedStudent && (
        <div style={styles.modalOverlay} onClick={() => setShowCodeModal(false)}>
          <div style={styles.codeModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Code2 size={20} color="#10b981" />
                <div>
                  <h3 style={styles.modalTitle}>
                    {selectedStudent.name}'s Submitted Code
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                    {assignment?.title} • {selectedStudent.finalCode?.split('\n').length || 0} lines
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedStudent.finalCode && (
                  <button
                    onClick={() => handleCopyCode(selectedStudent.finalCode)}
                    style={styles.modalCopyBtn}
                    className="btn-anim"
                  >
                    {copiedCode ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>
                )}
                <button
                  onClick={() => setShowCodeModal(false)}
                  style={styles.closeModalBtn}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <pre style={styles.modalCodeBody}>
              <code>{selectedStudent.finalCode || '// No code found for this submission.'}</code>
            </pre>
          </div>
        </div>
      )}

      {/* ═══ BULK GRADING MODAL ═══ */}
      {showBulkModal && (
        <div style={styles.modalOverlay} onClick={() => setShowBulkModal(false)}>
          <div style={styles.bulkModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Bulk Grade Submissions</h3>
                <p style={{ margin: '4px 0 0 0', color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.84rem' }}>
                  Assign grades to all {turnedInStudents.length} students who have turned in this activity.
                </p>
              </div>
              <button onClick={() => setShowBulkModal(false)} style={styles.closeModalBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={styles.inputLabel}>Grade (out of {maxPoints}):</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  <input
                    type="number"
                    min="0"
                    max={maxPoints}
                    value={bulkGrade}
                    onChange={(e) => setBulkGrade(e.target.value)}
                    style={{ ...styles.scoreInput, width: '100px' }}
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {scorePresets.slice(0, 5).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setBulkGrade(String(p))}
                        style={styles.scorePresetBtn(String(bulkGrade) === String(p))}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label style={styles.inputLabel}>Feedback for all submitted students:</label>
                <textarea
                  rows={3}
                  value={bulkFeedback}
                  onChange={(e) => setBulkFeedback(e.target.value)}
                  style={{ ...styles.feedbackTextarea, marginTop: '6px' }}
                  placeholder="e.g. Great work completing this assignment!"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  style={styles.cancelModalBtn}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkGrade}
                  style={styles.applyBulkBtn}
                  className="btn-anim"
                >
                  Apply to All ({turnedInStudents.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreviewModal
          image={previewImage}
          onClose={() => setPreviewImage(null)}
          isDark={isDark}
        />
      )}

      {/* Video Preview Modal */}
      {previewVideo && (
        <VideoPreviewModal
          video={previewVideo}
          onClose={() => setPreviewVideo(null)}
          isDark={isDark}
        />
      )}

      {/* Iframe Link Preview Modal */}
      {previewIframe && (
        <IframePreviewModal
          url={previewIframe.url}
          title={previewIframe.name}
          type={previewIframe.type}
          onClose={() => setPreviewIframe(null)}
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
                  } else if (onBack) {
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
    </div>
  );
}

const getStyles = (isDark, isMobile) => ({
  container: {
    height: '100vh',
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isDark ? '#141414' : '#f8fafc',
    color: isDark ? '#f8fafc' : '#0f172a',
    position: 'relative',
    overflow: 'hidden',
    transition: 'background-color 0.25s ease'
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: '64px',
    background: isDark ? 'rgba(20, 20, 20, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: isDark ? '1px solid #2e2e2e' : '1px solid #e2e8f0',
    flexShrink: 0,
    transition: 'background 0.25s ease'
  },
  instructorTag: {
    fontSize: '0.68rem',
    fontWeight: '700',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    color: isDark ? '#e2e8f0' : '#475569',
    padding: '3px 8px',
    borderRadius: '8px',
    marginLeft: '8px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  headerNavBtn: (isActive) => ({
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '50px',
    background: 'transparent',
    border: 'none',
    color: isActive ? '#10b981' : (isDark ? '#a3a3a3' : '#64748b'),
    fontWeight: isActive ? '700' : '600',
    fontSize: '0.88rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }),
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: isMobile ? '16px 14px 40px' : '20px clamp(16px, 3vw, 40px) 48px',
    boxSizing: 'border-box'
  },
  contentWrapper: {
    maxWidth: '1240px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  breadcrumbBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px'
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '10px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#262626' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontSize: '0.88rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    boxShadow: isDark ? '0 2px 6px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.04)'
  },
  classroomBadge: {
    fontSize: '0.88rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  classCodeChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 12px',
    borderRadius: '8px',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.08)',
    border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(16, 185, 129, 0.3)',
    cursor: 'pointer',
    fontSize: '0.82rem'
  },
  liveSyncBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.78rem',
    color: isDark ? '#34d399' : '#059669',
    fontWeight: '600',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
    padding: '4px 10px',
    borderRadius: '50px'
  },
  livePulseDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 8px #10b981'
  },
  heroCard: {
    backgroundColor: isDark ? '#242424' : '#ffffff',
    borderRadius: '16px',
    border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    padding: isMobile ? '18px' : '24px 28px',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.03)',
    transition: 'all 0.25s ease'
  },
  heroTopRow: {
    display: 'flex',
    alignItems: isMobile ? 'flex-start' : 'center',
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    gap: '20px'
  },
  heroLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    minWidth: 0,
    flex: 1
  },
  heroIconBox: {
    width: '54px',
    height: '54px',
    borderRadius: '12px',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ecfdf5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  heroPreTitle: {
    fontSize: '0.72rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#10b981',
    marginBottom: '2px'
  },
  heroTitle: {
    fontSize: isMobile ? '1.25rem' : '1.5rem',
    fontWeight: '800',
    color: isDark ? '#f8fafc' : '#0f172a',
    margin: 0,
    lineHeight: 1.25,
    wordBreak: 'break-word'
  },
  heroMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '8px'
  },
  metaBadgeEmerald: {
    fontSize: '0.74rem',
    fontWeight: '700',
    padding: '3px 9px',
    borderRadius: '6px',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : '#d1fae5',
    color: isDark ? '#34d399' : '#065f46'
  },
  metaBadgeGray: {
    fontSize: '0.74rem',
    fontWeight: '600',
    padding: '3px 9px',
    borderRadius: '6px',
    backgroundColor: isDark ? '#323232' : '#f1f5f9',
    color: isDark ? '#94a3b8' : '#475569',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  heroRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: isMobile ? 'flex-start' : 'flex-end',
    gap: '12px',
    flexShrink: 0
  },
  statsPillRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 14px',
    borderRadius: '10px',
    backgroundColor: isDark ? '#1a1a1a' : '#f8fafc',
    border: isDark ? '1px solid #333333' : '1px solid #e2e8f0',
    gap: '12px'
  },
  statPillItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '50px'
  },
  statPillNum: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: isDark ? '#f8fafc' : '#0f172a'
  },
  statPillLabel: {
    fontSize: '0.68rem',
    color: isDark ? '#94a3b8' : '#64748b',
    fontWeight: '600'
  },
  statPillDivider: {
    width: '1px',
    height: '24px',
    backgroundColor: isDark ? '#333333' : '#e2e8f0'
  },
  toggleInstructionsBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    border: isDark ? '1px solid #383838' : '1px solid #cbd5e1',
    color: isDark ? '#94a3b8' : '#475569',
    fontSize: '0.8rem',
    fontWeight: '700',
    cursor: 'pointer'
  },
  instructionsDrawer: {
    marginTop: '16px'
  },
  instructionsDivider: {
    height: '1px',
    backgroundColor: isDark ? '#383838' : '#e2e8f0',
    marginBottom: '16px'
  },
  instructionsHeading: {
    margin: '0 0 10px 0',
    fontSize: '0.92rem',
    fontWeight: '700',
    color: isDark ? '#f8fafc' : '#0f172a'
  },
  instructionsContent: {
    fontSize: '0.92rem',
    lineHeight: 1.6,
    color: isDark ? '#cbd5e1' : '#334155'
  },
  workspaceGrid: {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: '20px',
    alignItems: 'flex-start'
  },
  rosterCard: {
    width: isMobile ? '100%' : '340px',
    flexShrink: 0,
    backgroundColor: isDark ? '#242424' : '#ffffff',
    borderRadius: '16px',
    border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.03)'
  },
  rosterHeader: {
    padding: '16px 16px 12px',
    borderBottom: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#202020' : '#ffffff'
  },
  rosterTitle: {
    margin: 0,
    fontSize: '0.98rem',
    fontWeight: '700',
    color: isDark ? '#f8fafc' : '#0f172a'
  },
  rosterCountBadge: {
    fontSize: '0.72rem',
    fontWeight: '800',
    padding: '2px 7px',
    borderRadius: '50px',
    backgroundColor: isDark ? '#333333' : '#f1f5f9',
    color: isDark ? '#94a3b8' : '#475569'
  },
  bulkGradeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 11px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
  },
  bulkToast: {
    marginTop: '10px',
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
    color: isDark ? '#34d399' : '#059669',
    fontSize: '0.75rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  filterPillsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '12px'
  },
  filterPillBtn: (isActive) => ({
    flex: 1,
    padding: '5px 8px',
    borderRadius: '7px',
    border: 'none',
    fontSize: '0.74rem',
    fontWeight: isActive ? '700' : '500',
    cursor: 'pointer',
    backgroundColor: isActive ? (isDark ? '#34d399' : '#10b981') : 'transparent',
    color: isActive ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
    transition: 'all 0.15s ease',
    textAlign: 'center'
  }),
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '10px',
    padding: '6px 10px',
    borderRadius: '8px',
    backgroundColor: isDark ? '#1a1a1a' : '#f1f5f9',
    border: isDark ? '1px solid #333333' : '1px solid #e2e8f0'
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '0.82rem'
  },
  clearSearchBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: isDark ? '#94a3b8' : '#64748b',
    display: 'flex',
    alignItems: 'center'
  },
  studentList: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '560px',
    overflowY: 'auto'
  },
  studentRow: (isSelected) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: isDark ? '1px solid #2e2e2e' : '1px solid #f1f5f9',
    borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent',
    backgroundColor: isSelected
      ? (isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5')
      : 'transparent',
    transition: 'all 0.15s ease'
  }),
  studentAvatar: (status) => ({
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    backgroundColor: status === 'graded' ? '#10b981' : (status === 'turned_in' ? '#3b82f6' : (isDark ? '#4b5563' : '#cbd5e1')),
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: '800',
    flexShrink: 0
  }),
  studentRowName: (isSelected) => ({
    fontSize: '0.88rem',
    fontWeight: isSelected ? '700' : '600',
    color: isSelected ? '#10b981' : (isDark ? '#f8fafc' : '#0f172a'),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }),
  studentRowSub: {
    fontSize: '0.74rem',
    color: isDark ? '#94a3b8' : '#64748b',
    marginTop: '2px'
  },
  statusBadgeGraded: {
    fontSize: '0.75rem',
    fontWeight: '800',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#d1fae5',
    color: isDark ? '#34d399' : '#065f46',
    display: 'flex',
    alignItems: 'center',
    gap: '3px'
  },
  statusBadgeTurnedIn: {
    fontSize: '0.72rem',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.18)' : '#dbeafe',
    color: isDark ? '#60a5fa' : '#1e40af'
  },
  statusBadgeAssigned: {
    fontSize: '0.72rem',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: isDark ? '#333333' : '#f1f5f9',
    color: isDark ? '#94a3b8' : '#64748b'
  },
  emptyRoster: {
    padding: '36px 16px',
    textAlign: 'center'
  },
  evalCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: isDark ? '#242424' : '#ffffff',
    borderRadius: '16px',
    border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    padding: isMobile ? '18px' : '28px',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  emptyEval: {
    padding: '60px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  evalStudentHeader: {
    display: 'flex',
    alignItems: isMobile ? 'flex-start' : 'center',
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    gap: '16px',
    paddingBottom: '18px',
    borderBottom: isDark ? '1px solid #383838' : '1px solid #e2e8f0'
  },
  evalLargeAvatar: {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    fontWeight: '800',
    flexShrink: 0
  },
  evalStudentName: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '800',
    color: isDark ? '#f8fafc' : '#0f172a'
  },
  evalStudentSub: {
    fontSize: '0.84rem',
    marginTop: '4px'
  },
  playbackActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '8px 16px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: '0.86rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
  },
  fullscreenCodeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '10px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#2e2e2e' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontSize: '0.84rem',
    fontWeight: '700',
    cursor: 'pointer'
  },
  codeSnippetSection: {
    borderRadius: '12px',
    border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    overflow: 'hidden',
    backgroundColor: isDark ? '#1a1a1a' : '#f8fafc'
  },
  codeSnippetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: isDark ? '1px solid #2e2e2e' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#202020' : '#ffffff'
  },
  codeLengthBadge: {
    fontSize: '0.72rem',
    color: isDark ? '#94a3b8' : '#64748b',
    backgroundColor: isDark ? '#2d2d2d' : '#f1f5f9',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  copyCodeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    borderRadius: '6px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: 'transparent',
    color: isDark ? '#cbd5e1' : '#475569',
    fontSize: '0.76rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  codeBlockWrapper: {
    maxHeight: '300px',
    overflowY: 'auto'
  },
  codePre: {
    margin: 0,
    padding: '16px',
    fontFamily: '"Fira Code", Menlo, Monaco, Consolas, monospace',
    fontSize: '0.86rem',
    lineHeight: 1.55,
    color: isDark ? '#e2e8f0' : '#1e293b',
    backgroundColor: isDark ? '#141414' : '#ffffff',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  emptyCodeNotice: {
    padding: '30px 16px',
    textAlign: 'center',
    color: isDark ? '#94a3b8' : '#64748b',
    fontSize: '0.86rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  gradingFormCard: {
    backgroundColor: isDark ? '#1e1e1e' : '#f8fafc',
    borderRadius: '14px',
    border: isDark ? '1px solid #333333' : '1px solid #e2e8f0',
    padding: '20px'
  },
  inputLabel: {
    display: 'block',
    fontSize: '0.84rem',
    fontWeight: '700',
    color: isDark ? '#e2e8f0' : '#334155',
    marginBottom: '4px'
  },
  scoreInput: {
    width: '84px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#262626' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '1rem',
    fontWeight: '800',
    textAlign: 'center',
    outline: 'none'
  },
  scorePresetBtn: (isActive) => ({
    padding: '6px 10px',
    borderRadius: '6px',
    border: isDark ? '1px solid #383838' : '1px solid #cbd5e1',
    backgroundColor: isActive ? '#10b981' : (isDark ? '#2a2a2a' : '#ffffff'),
    color: isActive ? '#ffffff' : (isDark ? '#e2e8f0' : '#475569'),
    fontSize: '0.78rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  }),
  feedbackTextarea: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#262626' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  quickFeedbackPill: {
    fontSize: '0.72rem',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '50px',
    border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
    color: isDark ? '#94a3b8' : '#475569',
    cursor: 'pointer'
  },
  clearGradeBtn: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: '0.76rem',
    fontWeight: '700',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  evaluateSubmitBtn: (status) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 24px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: status === 'saved' ? '#10b981' : (status === 'error' ? '#ef4444' : '#10b981'),
    color: '#ffffff',
    fontSize: '0.92rem',
    fontWeight: '800',
    cursor: status === 'saving' ? 'wait' : 'pointer',
    opacity: status === 'saving' ? 0.75 : 1,
    boxShadow: '0 2px 10px rgba(16,185,129,0.3)',
    transition: 'all 0.2s ease'
  }),
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  codeModalCard: {
    backgroundColor: isDark ? '#202020' : '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '850px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
    border: isDark ? '1px solid #3d3d3d' : 'none',
    overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 22px',
    borderBottom: isDark ? '1px solid #333333' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#262626' : '#ffffff'
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: '800',
    color: isDark ? '#f8fafc' : '#0f172a'
  },
  modalCopyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#2e2e2e' : '#f8fafc',
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontSize: '0.8rem',
    fontWeight: '700',
    cursor: 'pointer'
  },
  closeModalBtn: {
    background: 'none',
    border: 'none',
    color: isDark ? '#94a3b8' : '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '4px'
  },
  modalCodeBody: {
    flex: 1,
    margin: 0,
    padding: '24px',
    backgroundColor: isDark ? '#141414' : '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: '"Fira Code", Menlo, Monaco, Consolas, monospace',
    fontSize: '0.88rem',
    lineHeight: 1.6,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  bulkModalCard: {
    backgroundColor: isDark ? '#242424' : '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
    border: isDark ? '1px solid #3d3d3d' : 'none',
    overflow: 'hidden'
  },
  cancelModalBtn: {
    padding: '9px 18px',
    borderRadius: '8px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#2e2e2e' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#475569',
    fontSize: '0.86rem',
    fontWeight: '700',
    cursor: 'pointer'
  },
  applyBulkBtn: {
    padding: '9px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: '0.86rem',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
  }
});
