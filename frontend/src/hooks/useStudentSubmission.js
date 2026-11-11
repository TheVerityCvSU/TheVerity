import { useState, useEffect } from 'react';
import { apiFetch } from '../data/api';
import { localStore } from '../data/localStore';
import { getStudentGrade } from '../utils/gradeUtils';
import {
  getSubmissionStorageKeys,
  getHistoryStorageKeys,
  getInitialSavedSubmission,
  getInitialSavedGrade,
  resolveSubmissionHistory,
  submitStudentAssignment,
  unsubmitStudentAssignment
} from '../data/studentSubmissionService';

export function useStudentSubmission({ classroom, assignment, currentUser, socket }) {
  const safeUsername = currentUser?.name || currentUser?.email || 'Student';
  const studentId = currentUser?.email || currentUser?.name || 'student';
  const assignmentId = assignment?.id ?? 'default';
  const classroomId = classroom?.id ?? 'default';

  const submissionKey = `verity_sub_${classroomId}_${assignmentId}_${studentId}`;
  const gradesKey = `verity_grades_${assignmentId}`;
  const draftCodeKey = `verity_code_${assignmentId}_${studentId}`;

  const allKeys = [
    submissionKey,
    ...getSubmissionStorageKeys(classroomId, assignmentId, currentUser, studentId, safeUsername)
  ];
  const hKeys = getHistoryStorageKeys(classroomId, assignmentId, currentUser, studentId, safeUsername);

  const [submission, setSubmission] = useState(() =>
    getInitialSavedSubmission(submissionKey, allKeys)
  );

  const [gradeData, setGradeData] = useState(() =>
    getInitialSavedGrade(gradesKey, currentUser, studentId, safeUsername)
  );

  const [showCodePreview, setShowCodePreview] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showUnsubmitModal, setShowUnsubmitModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Fetch submissions for this assignment
    apiFetch(`${import.meta.env.VITE_API_URL}/submissions/${assignmentId}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data?.submissions)) {
          const mySub = data.submissions.find(s => {
            const sName = String(s.student_name || s.studentName || '').toLowerCase();
            const sId = String(s.student_id || s.studentId || '').toLowerCase();
            const targetName = String(safeUsername || '').toLowerCase();
            const targetId = String(studentId || '').toLowerCase();
            const targetEmail = String(currentUser?.email || '').toLowerCase();
            return sName === targetName || sName === targetId || sName === targetEmail ||
                   (sId && (sId === targetName || sId === targetId || sId === targetEmail));
          });
          if (mySub) {
            setSubmission(mySub);
            localStorage.setItem(submissionKey, JSON.stringify(mySub));
          } else {
            setSubmission(null);
            allKeys.forEach(k => {
              try { localStorage.removeItem(k); } catch {}
            });
          }
        }
      })
      .catch(() => {});

    // Fetch grades
    apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignmentId}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data?.grades) {
          const myGrade = getStudentGrade(data.grades, { id: currentUser?.id, name: currentUser?.name, email: currentUser?.email }) ||
                          getStudentGrade(data.grades, studentId) ||
                          getStudentGrade(data.grades, safeUsername);
          if (myGrade) setGradeData(myGrade);
        }
      })
      .catch(() => {});

    // Local storage event listener
    const onStorageUpdate = () => {
      setSubmission(getInitialSavedSubmission(submissionKey, allKeys));
      const myGrade = getInitialSavedGrade(gradesKey, currentUser, studentId, safeUsername);
      if (myGrade) setGradeData(myGrade);
    };

    window.addEventListener('storage', onStorageUpdate);

    let handleSocketUnsub = null;
    if (socket) {
      handleSocketUnsub = (data) => {
        if (!data) return;
        const targetName = String(safeUsername || '').toLowerCase();
        const targetId = String(studentId || '').toLowerCase();
        const eventName = String(data.studentName || '').toLowerCase();
        const eventId = String(data.studentId || '').toLowerCase();

        if (eventName === targetName || eventName === targetId || eventId === targetName || eventId === targetId) {
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
            try { localStorage.removeItem(k); } catch {}
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
        if (myGrade) setGradeData(null);
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

  const handleSubmit = () => {
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowSubmitModal(false);
    let currentCode = "";
    try {
      currentCode = localStorage.getItem(draftCodeKey) || "";
    } catch {}

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
      socket
    });

    setSubmission(subData);
  };

  const handleUnsubmit = () => {
    setShowUnsubmitModal(true);
  };

  const handleConfirmUnsubmit = () => {
    setShowUnsubmitModal(false);
    unsubmitStudentAssignment({
      assignmentId,
      classroomId,
      studentId,
      safeUsername,
      priorSubmission: submission,
      allKeys,
      hKeys,
      socket
    });
    setSubmission(null);
  };

  return {
    submission,
    gradeData,
    isSubmitted: !!submission,
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
