import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, getConnectionStatus } from '../data/api';
import { localStore } from '../data/localStore';
import { getStudentGrade } from '../utils/gradeUtils';
import { getStudentIdentity } from '../utils/studentViewUtils';
import {
  getSubmissionStorageKeys,
  getHistoryStorageKeys,
  getInitialSavedSubmission,
  getInitialSavedGrade,
  resolveSubmissionHistory,
  clearAllSubmissionStorage,
  submitStudentAssignment,
  unsubmitStudentAssignment
} from '../data/studentSubmissionService';

export function useStudentSubmission({ classroom, assignment, currentUser, socket }) {
  const identity = getStudentIdentity(currentUser, null, assignment, classroom);
  const safeUsername = identity.safeUsername;
  const studentId = identity.studentId;
  const assignmentId = identity.assignmentId;
  const classroomId = identity.classroomId;

  const submissionKey = `verity_sub_${classroomId}_${assignmentId}_${studentId}`;
  const gradesKey = `verity_grades_${assignmentId}`;
  const draftCodeKey = `verity_code_${assignmentId}_${studentId}`;

  const allKeys = useMemo(
    () => getSubmissionStorageKeys(classroomId, assignmentId, currentUser, studentId, safeUsername),
    [classroomId, assignmentId, currentUser, studentId, safeUsername]
  );
  const hKeys = useMemo(
    () => getHistoryStorageKeys(classroomId, assignmentId, currentUser, studentId, safeUsername),
    [classroomId, assignmentId, currentUser, studentId, safeUsername]
  );

  const [submission, setSubmission] = useState(() =>
    getInitialSavedSubmission(submissionKey, allKeys)
  );
  const [checkedAssignmentId, setCheckedAssignmentId] = useState(null);

  const [gradeData, setGradeData] = useState(() =>
    getInitialSavedGrade(gradesKey, currentUser, studentId, safeUsername)
  );

  const [showCodePreview, setShowCodePreview] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showUnsubmitModal, setShowUnsubmitModal] = useState(false);

  const hasValidAssignmentId = Boolean(assignmentId && assignmentId !== 'none' && assignmentId !== 'default');
  const isCheckingSubmission = !submission && hasValidAssignmentId && checkedAssignmentId !== String(assignmentId);

  const fetchAssignmentData = useCallback(() => {
    if (!assignmentId || assignmentId === 'none' || assignmentId === 'default') return;

    const currentAId = String(assignmentId);

    // Fetch submissions for this assignment
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${assignmentId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && Array.isArray(data.submissions)) {
          const targetName = String(safeUsername || '').toLowerCase().trim();
          const targetId = String(studentId || '').toLowerCase().trim();
          const targetEmail = String(currentUser?.email || '').toLowerCase().trim();
          const targetUserName = String(currentUser?.name || '').toLowerCase().trim();

          const mySub = data.submissions.find(s => {
            const sName = String(s.student_name || s.studentName || '').toLowerCase().trim();
            const sId = String(s.student_id || s.studentId || '').toLowerCase().trim();

            if (sName && (sName === targetName || sName === targetId || sName === targetEmail || sName === targetUserName)) return true;
            if (sId && (sId === targetName || sId === targetId || sId === targetEmail || sId === targetUserName)) return true;

            if (currentUser?.role === 'Student' && data.submissions.length === 1) {
              return true;
            }
            return false;
          });

          if (mySub) {
            setSubmission(mySub);
            try { localStorage.setItem(submissionKey, JSON.stringify(mySub)); } catch {}
          } else if (data.submissions.length === 0 && !data.isOfflineFallback && getConnectionStatus().activeMode !== 'offline') {
            setSubmission(null);
            clearAllSubmissionStorage(assignmentId, classroomId, currentUser, studentId, safeUsername);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        setCheckedAssignmentId(currentAId);
      });

    // Fetch grades
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/grades/${assignmentId}`)
      .then(res => (res.ok ? res.json() : {}))
      .then(data => {
        if (data?.grades) {
          const myGrade = getStudentGrade(data.grades, { id: currentUser?.id, name: currentUser?.name, email: currentUser?.email }) ||
                          getStudentGrade(data.grades, studentId) ||
                          getStudentGrade(data.grades, safeUsername);
          if (myGrade) setGradeData(myGrade);
        }
      })
      .catch(() => {});
  }, [assignmentId, classroomId, studentId, safeUsername, currentUser, submissionKey]);

  useEffect(() => {
    fetchAssignmentData();

    const onStorageUpdate = () => {
      setSubmission(getInitialSavedSubmission(submissionKey, allKeys));
      const myGrade = getInitialSavedGrade(gradesKey, currentUser, studentId, safeUsername);
      if (myGrade) setGradeData(myGrade);
    };

    const onCustomSubEvent = (e) => {
      if (e.detail?.assignmentId != null && String(e.detail.assignmentId) === String(assignmentId)) {
        if (e.detail.submitted) {
          const saved = getInitialSavedSubmission(submissionKey, allKeys);
          if (saved) setSubmission(saved);
          else fetchAssignmentData();
        } else {
          setSubmission(null);
        }
      }
    };

    window.addEventListener('storage', onStorageUpdate);
    window.addEventListener('verity:submission-updated', onCustomSubEvent);

    const handleSocketUnsub = (data) => {
      if (!data) return;
      const targetName = String(safeUsername || '').toLowerCase();
      const targetId = String(studentId || '').toLowerCase();
      const eventName = String(data.studentName || '').toLowerCase();
      const eventId = String(data.studentId || '').toLowerCase();

      if (!eventName || eventName === targetName || eventName === targetId || eventId === targetName || eventId === targetId) {
        if (data.assignmentId && String(data.assignmentId) !== String(assignmentId)) return;
        setSubmission(null);
        clearAllSubmissionStorage(assignmentId, classroomId, currentUser, studentId, safeUsername);
      }
    };

    const handleServerSubDeleted = (data) => {
      if (!data?.assignmentId || String(data.assignmentId) !== String(assignmentId)) return;
      const targetName = String(safeUsername || '').toLowerCase().trim();
      const targetId = String(studentId || '').toLowerCase().trim();
      const targetEmail = String(currentUser?.email || '').toLowerCase().trim();
      const targetUserName = String(currentUser?.name || '').toLowerCase().trim();
      const eventName = String(data.studentName || '').toLowerCase().trim();
      const eventId = String(data.studentId || '').toLowerCase().trim();

      const matchesSelf =
        (eventName && (eventName === targetName || eventName === targetId || eventName === targetEmail || eventName === targetUserName)) ||
        (eventId && (eventId === targetName || eventId === targetId || eventId === targetEmail || eventId === targetUserName));

      if (matchesSelf) {
        setSubmission(null);
        clearAllSubmissionStorage(assignmentId, classroomId, currentUser, studentId, safeUsername);
      }
    };

    const handleServerSubUpdated = (data) => {
      if (data?.assignmentId && String(data.assignmentId) === String(assignmentId)) {
        fetchAssignmentData();
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
      if (myGrade) setGradeData(null);
    };

    if (socket) {
      socket.on('student_unsubmitted', handleSocketUnsub);
      socket.on('teacher_student_unsubmitted', handleSocketUnsub);
      socket.on('submission_deleted', handleServerSubDeleted);
      socket.on('submission_updated', handleServerSubUpdated);
      socket.on('grade_updated', handleLiveGradeUpdate);
      socket.on('bulk_grades_updated', handleLiveBulkGradesUpdate);
      socket.on('grade_deleted', handleLiveGradeDelete);
    }

    return () => {
      window.removeEventListener('storage', onStorageUpdate);
      window.removeEventListener('verity:submission-updated', onCustomSubEvent);
      if (socket) {
        socket.off('student_unsubmitted', handleSocketUnsub);
        socket.off('teacher_student_unsubmitted', handleSocketUnsub);
        socket.off('submission_deleted', handleServerSubDeleted);
        socket.off('submission_updated', handleServerSubUpdated);
        socket.off('grade_updated', handleLiveGradeUpdate);
        socket.off('bulk_grades_updated', handleLiveBulkGradesUpdate);
        socket.off('grade_deleted', handleLiveGradeDelete);
      }
    };
  }, [assignmentId, classroomId, studentId, safeUsername, submissionKey, gradesKey, socket, currentUser, allKeys, fetchAssignmentData]);

  const handleSubmit = () => {
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowSubmitModal(false);
    let currentCode = "";

    const candidateCodeKeys = [
      draftCodeKey,
      `verity_code_${assignmentId}_${studentId}`,
      `verity_code_${assignmentId}_${safeUsername}`,
      currentUser?.id ? `verity_code_${assignmentId}_${currentUser.id}` : null,
      currentUser?.email ? `verity_code_${assignmentId}_${currentUser.email}` : null,
      `verity_code_${assignmentId}`
    ].filter(Boolean);

    for (const ck of candidateCodeKeys) {
      try {
        const val = localStorage.getItem(ck);
        if (val && typeof val === 'string' && val.trim().length > 0) {
          currentCode = val;
          break;
        }
      } catch {}
    }

    if (!currentCode) {
      try {
        const draft = localStore.getDraft(assignmentId, studentId) || localStore.getDraft(assignmentId, safeUsername);
        if (draft?.code) currentCode = draft.code;
      } catch {}
    }

    if (!currentCode && submission?.finalCode) {
      currentCode = submission.finalCode;
    }

    if (!currentCode) {
      currentCode = assignment?.starterCode || "";
    }

    const resolvedHistory = resolveSubmissionHistory(hKeys, currentCode, submission);

    const subData = await submitStudentAssignment({
      assignmentId,
      classroomId,
      studentId,
      safeUsername,
      currentCode,
      resolvedHistory,
      allKeys,
      hKeys,
      socket,
      currentUser
    });

    setSubmission(subData);
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
    unsubmitStudentAssignment({
      assignmentId,
      classroomId,
      studentId,
      safeUsername,
      priorSubmission: submission,
      allKeys,
      hKeys,
      socket,
      currentUser
    });
    setSubmission(null);
  };

  return {
    submission,
    gradeData,
    isSubmitted: !!submission,
    isCheckingSubmission,
    showCodePreview,
    setShowCodePreview,
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
