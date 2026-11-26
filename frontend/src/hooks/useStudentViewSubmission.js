import { useState, useEffect } from 'react';
import { apiFetch } from '../data/api';
import { getSubKeys, checkLocalSubmitted } from '../utils/studentViewUtils';
import { clearAllSubmissionStorage } from '../data/studentSubmissionService';

export function useStudentViewSubmission({
  socket,
  currentUser,
  assignment,
  classroom,
  assignmentId,
  classroomId,
  studentId,
  safeUsername,
  isDesktopWeb,
  vmDetected,
  kioskRules,
  codeRef,
  codeHistoryRef,
  persistHistoryFn,
  emitToSockets,
  proctorLogs,
  editorRef,
  handleStopCode,
  isRunning
}) {
  const [submitted, setSubmitted] = useState(() =>
    checkLocalSubmitted(classroomId, assignmentId, studentId, safeUsername, currentUser)
  );
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showUnsubmitModal, setShowUnsubmitModal] = useState(false);

  // Sync with backend submissions
  useEffect(() => {
    if (!assignment?.id) return;
    const aId = assignment.id;
    let cancelled = false;

    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${aId}`)
      .then((res) => (res.ok ? res.json() : { submissions: [] }))
      .then((data) => {
        if (cancelled) return;
        const subs = data?.submissions || [];
        const mySub = subs.find((s) => {
          const sName = String(s.student_name || s.studentName || '').toLowerCase();
          const sId = String(s.student_id || s.studentId || '').toLowerCase();
          const targetName = String(safeUsername || '').toLowerCase();
          const targetId = String(studentId || '').toLowerCase();
          const targetEmail = String(currentUser?.email || '').toLowerCase();
          return (
            sName === targetName ||
            sName === targetId ||
            sName === targetEmail ||
            (sId && (sId === targetName || sId === targetId || sId === targetEmail))
          );
        });

        if (!mySub) {
          const localSub = checkLocalSubmitted(classroomId, assignmentId, studentId, safeUsername, currentUser);
          if (!localSub) {
            setSubmitted(false);
            getSubKeys(classroomId, assignmentId, studentId, safeUsername, currentUser).forEach((k) => {
              try {
                localStorage.removeItem(k);
              } catch {}
            });
          }
        } else {
          setSubmitted(true);
        }
      })
      .catch(() => {
        setSubmitted(checkLocalSubmitted(classroomId, assignmentId, studentId, safeUsername, currentUser));
      });

    return () => {
      cancelled = true;
    };
  }, [assignment?.id, safeUsername, studentId, classroomId, assignmentId, currentUser]);

  // Sync on storage event
  useEffect(() => {
    const handleStorage = () => {
      setSubmitted(checkLocalSubmitted(classroomId, assignmentId, studentId, safeUsername, currentUser));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [classroomId, assignmentId, studentId, safeUsername, currentUser]);

  // Real-time unsubmit via socket
  useEffect(() => {
    if (!socket) return;
    const handleSocketUnsubmit = (data) => {
      if (!data) return;
      const targetName = String(safeUsername || '').toLowerCase();
      const targetId = String(studentId || '').toLowerCase();
      const eventName = String(data.studentName || '').toLowerCase();
      const eventId = String(data.studentId || '').toLowerCase();

      if (eventName === targetName || eventName === targetId || eventId === targetName || eventId === targetId) {
        if (codeHistoryRef.current?.length > 0) {
          persistHistoryFn(codeHistoryRef.current, codeRef.current);
        }
        setSubmitted(false);
        clearAllSubmissionStorage(assignmentId, classroomId, currentUser, studentId, safeUsername);
      }
    };

    socket.on('student_unsubmitted', handleSocketUnsubmit);
    socket.on('teacher_student_unsubmitted', handleSocketUnsubmit);
    return () => {
      socket.off('student_unsubmitted', handleSocketUnsubmit);
      socket.off('teacher_student_unsubmitted', handleSocketUnsubmit);
    };
  }, [socket, safeUsername, studentId, classroomId, assignmentId, codeHistoryRef, codeRef, persistHistoryFn, currentUser]);

  const handleSubmit = () => {
    if (submitted) return;
    if (isDesktopWeb) {
      alert('Submission blocked: Desktop web browser cannot be used in the Computer Laboratory. Please launch The Verity.exe desktop application.');
      return;
    }
    if (vmDetected && kioskRules?.blockVirtualMachine !== false) {
      alert('Submission is blocked: Running The Verity inside a Virtual Machine is not permitted during exams.');
      return;
    }
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = () => {
    if (submitted) return;
    setShowSubmitModal(false);
    if (isRunning) handleStopCode();

    setSubmitted(true);
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: true, domReadOnly: true });
    }

    const aId = assignment?.id ?? 'default';
    const curCode = codeRef.current;
    const curHistory = codeHistoryRef.current?.length > 0 ? codeHistoryRef.current : [];
    const lastHistEntry = curHistory[curHistory.length - 1];
    const subHistory =
      curHistory.length === 0 || lastHistEntry?.code !== curCode
        ? [...curHistory, { time: Date.now(), code: curCode }]
        : curHistory;
    persistHistoryFn(subHistory, curCode);

    const subRecord = {
      studentName: safeUsername,
      studentId,
      assignmentId: assignment?.id ?? null,
      classroomId: classroom?.id ?? null,
      finalCode: curCode,
      codeHistory: subHistory,
      submittedAt: new Date().toISOString()
    };

    getSubKeys(classroomId, assignmentId, studentId, safeUsername, currentUser).forEach((k) => {
      try {
        localStorage.setItem(k, JSON.stringify(subRecord));
      } catch {}
    });

    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${aId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: safeUsername,
        studentId,
        studentEmail: currentUser?.email || '',
        finalCode: curCode,
        codeHistory: subHistory,
        classroomId: classroom?.id ?? null
      })
    }).catch(() => {});

    emitToSockets('student_leave_workspace', {
      assignmentId: assignment?.id ?? aId,
      classroomId: classroom?.id,
      studentId,
      studentEmail: currentUser?.email || '',
      name: safeUsername,
      reason: 'submitted'
    });
    emitToSockets('submit_exam', {
      studentName: safeUsername,
      studentId,
      studentEmail: currentUser?.email || '',
      assignmentId: assignment?.id ?? null,
      finalCode: curCode,
      logs: proctorLogs,
      codeHistory: subHistory,
      classroomId: classroom?.id,
      submitted: true
    });

    try {
      window.dispatchEvent(
        new CustomEvent('verity:submission-updated', {
          detail: { assignmentId: assignment?.id ?? aId, classroomId: classroom?.id ?? 'default', submitted: true }
        })
      );
    } catch {}
  };

  const handleUnsubmit = () => {
    if (assignment?.disableBack || assignment?.disable_back) {
      alert('Unsubmitting is disabled for this activity.');
      return;
    }
    setShowUnsubmitModal(true);
  };

  const handleConfirmUnsubmit = () => {
    setShowUnsubmitModal(false);
    if (assignment?.disableBack || assignment?.disable_back) {
      return;
    }
    const aId = assignment?.id ?? 'default';
    const curCode = codeRef.current;
    if (codeHistoryRef.current?.length > 0) {
      persistHistoryFn(codeHistoryRef.current, curCode);
    }

    setSubmitted(false);
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: false, domReadOnly: false });
    }

    clearAllSubmissionStorage(aId, classroomId, currentUser, studentId, safeUsername);
    apiFetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${aId}/${encodeURIComponent(safeUsername)}`,
      { method: 'DELETE' }
    ).catch(() => {});

    if (studentId && studentId !== safeUsername) {
      apiFetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${aId}/${encodeURIComponent(studentId)}`,
        { method: 'DELETE' }
      ).catch(() => {});
    }

    emitToSockets('unsubmit_exam', {
      studentName: safeUsername,
      studentId,
      assignmentId: aId,
      classroomId: classroom?.id ?? 'default'
    });

    try {
      window.dispatchEvent(
        new CustomEvent('verity:submission-updated', {
          detail: { assignmentId: aId, classroomId: classroom?.id ?? 'default', submitted: false }
        })
      );
    } catch {}
  };

  return {
    submitted,
    setSubmitted,
    showSubmitModal,
    setShowSubmitModal,
    showUnsubmitModal,
    setShowUnsubmitModal,
    handleSubmit,
    handleConfirmSubmit,
    handleUnsubmit,
    handleConfirmUnsubmit
  };
}
