import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../data/api';
import { getStudentIdentity } from '../utils/studentViewUtils';
import {
  clearAllSubmissionStorage,
  unsubmitStudentAssignment
} from '../data/studentSubmissionService';

export function useClassroomSubmissions({ assignments, classroom, currentUser, socket, isMaterialItem }) {
  const [submittedTasks, setSubmittedTasks] = useState({});
  const unsubmittedIdsRef = useRef(new Set());

  const identity = getStudentIdentity(currentUser, null, null, classroom);
  const safeUsername = identity.safeUsername;
  const studentId = identity.studentId;
  const classroomId = identity.classroomId;

  const checkAllSubs = useCallback(() => {
    const map = {};
    const targetEmail = (currentUser?.email || '').toLowerCase().trim();
    const targetName = (currentUser?.name || safeUsername || '').toLowerCase().trim();
    const targetId = (currentUser?.id != null ? String(currentUser.id) : studentId).toLowerCase().trim();
    const kimAliases = ['kim fabie', 'kimfabie', 'mikooooo', 'kimfabie123@gmail.com', 'kimfabie159@gmail.com'];

    assignments.forEach(task => {
      if (isMaterialItem && isMaterialItem(task)) return;
      const aId = String(task.id);
      const cId = String(classroomId);

      if (unsubmittedIdsRef.current.has(aId)) {
        map[task.id] = false;
        return;
      }

      const specificKeys = [
        `verity_sub_${cId}_${aId}`,
        `verity_sub_default_${aId}`,
        `verity_sub_${aId}`,
        `verity_sub_${cId}_${aId}_${studentId}`,
        `verity_sub_${cId}_${aId}_${safeUsername}`,
        currentUser?.name ? `verity_sub_${cId}_${aId}_${currentUser.name}` : null,
        currentUser?.email ? `verity_sub_${cId}_${aId}_${currentUser.email}` : null,
        currentUser?.id ? `verity_sub_${cId}_${aId}_id_${currentUser.id}` : null,
        `verity_sub_default_${aId}_${studentId}`,
        `verity_sub_default_${aId}_${safeUsername}`,
        currentUser?.id ? `verity_sub_default_${aId}_id_${currentUser.id}` : null
      ].filter(Boolean);

      if (specificKeys.some(k => { try { return !!localStorage.getItem(k); } catch { return false; } })) {
        map[task.id] = true;
        return;
      }

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith('verity_sub_')) continue;
          if (
            key.includes(`_${aId}_`) ||
            key.endsWith(`_${aId}`) ||
            key.includes(`_${aId}_id_`)
          ) {
            const kLower = key.toLowerCase();
            if (
              (targetId && (kLower.endsWith(`_${targetId}`) || kLower.includes(`_id_${targetId}`))) ||
              (targetEmail && kLower.includes(targetEmail)) ||
              (targetName && kLower.includes(targetName)) ||
              (kimAliases.some(a => kLower.includes(a))) ||
              key === `verity_sub_${cId}_${aId}` ||
              key === `verity_sub_default_${aId}` ||
              key === `verity_sub_${aId}`
            ) {
              map[task.id] = true;
              break;
            }
          }
        }
      } catch {}
    });

    setSubmittedTasks(prev => ({ ...prev, ...map }));
  }, [assignments, classroomId, currentUser, studentId, safeUsername, isMaterialItem]);

  useEffect(() => {
    checkAllSubs();

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    apiFetch(`${baseUrl}/student/submissions`)
      .then(res => (res.ok ? res.json() : { submissions: [] }))
      .then(data => {
        if (Array.isArray(data?.submissions) && data.submissions.length > 0) {
          setSubmittedTasks(prev => {
            const next = { ...prev };
            let changed = false;
            data.submissions.forEach(s => {
              const aId = String(s.assignment_id);
              if (s.assignment_id != null && !next[s.assignment_id] && !unsubmittedIdsRef.current.has(aId)) {
                next[s.assignment_id] = true;
                changed = true;
              }
            });
            return changed ? next : prev;
          });
        }
      })
      .catch(() => {});

    assignments.forEach(task => {
      if (isMaterialItem && isMaterialItem(task)) return;
      apiFetch(`${baseUrl}/submissions/${task.id}`)
        .then(res => (res.ok ? res.json() : { submissions: [] }))
        .then(data => {
          if (Array.isArray(data?.submissions)) {
            const targetEmail = (currentUser?.email || '').toLowerCase().trim();
            const targetName = (currentUser?.name || safeUsername || '').toLowerCase().trim();
            const targetId = (currentUser?.id != null ? String(currentUser.id) : studentId).toLowerCase().trim();
            const kimAliases = ['kim fabie', 'kimfabie', 'mikooooo', 'kimfabie123@gmail.com', 'kimfabie159@gmail.com'];

            const hasSub = data.submissions.some(s => {
              const sName = String(s.student_name || s.studentName || '').toLowerCase().trim();
              const sId = String(s.student_id || s.studentId || '').toLowerCase().trim();

              if ((targetName && sName === targetName) || (targetEmail && sName === targetEmail) || (targetId && sId === targetId)) return true;
              if ((kimAliases.includes(targetEmail) || kimAliases.includes(targetName)) && (kimAliases.includes(sName) || kimAliases.includes(sId))) return true;
              if (currentUser?.role === 'Student' && data.submissions.length === 1) return true;
              return false;
            });

            const aId = String(task.id);
            if (hasSub && !unsubmittedIdsRef.current.has(aId)) {
              setSubmittedTasks(prev => (prev[task.id] ? prev : { ...prev, [task.id]: true }));
            } else if (data.submissions.length === 0) {
              setSubmittedTasks(prev => (prev[task.id] ? { ...prev, [task.id]: false } : prev));
            }
          }
        })
        .catch(() => {});
    });

    const handleSubEvent = (e) => {
      if (e.detail?.assignmentId != null) {
        const aId = String(e.detail.assignmentId);
        if (e.detail.submitted) {
          unsubmittedIdsRef.current.delete(aId);
          setSubmittedTasks(prev => ({ ...prev, [e.detail.assignmentId]: true, [aId]: true }));
        } else {
          unsubmittedIdsRef.current.add(aId);
          clearAllSubmissionStorage(aId, classroomId, currentUser, studentId, safeUsername);
          setSubmittedTasks(prev => ({ ...prev, [e.detail.assignmentId]: false, [aId]: false }));
        }
      }
      checkAllSubs();
    };

    const onStorage = () => checkAllSubs();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkAllSubs();
    };

    window.addEventListener('verity:submission-updated', handleSubEvent);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onStorage);
    document.addEventListener('visibilitychange', onVisibility);

    const onRemoteUnsub = (data) => {
      if (!data) return;
      const targetName = String(safeUsername || '').toLowerCase();
      const targetId = String(studentId || '').toLowerCase();
      const eventName = String(data.studentName || '').toLowerCase();
      const eventId = String(data.studentId || '').toLowerCase();

      if (!eventName || eventName === targetName || eventName === targetId || eventId === targetName || eventId === targetId) {
        if (data.assignmentId) {
          const aId = String(data.assignmentId);
          unsubmittedIdsRef.current.add(aId);
          clearAllSubmissionStorage(aId, classroomId, currentUser, studentId, safeUsername);
          setSubmittedTasks(prev => ({ ...prev, [data.assignmentId]: false, [aId]: false }));
        }
      }
      checkAllSubs();
    };

    const onRemoteSubUpdated = (data) => {
      if (data?.assignmentId) {
        const aId = String(data.assignmentId);
        unsubmittedIdsRef.current.delete(aId);
        setSubmittedTasks(prev => ({ ...prev, [data.assignmentId]: true, [aId]: true }));
      }
      checkAllSubs();
    };

    if (socket) {
      socket.on('student_unsubmitted', onRemoteUnsub);
      socket.on('teacher_student_unsubmitted', onRemoteUnsub);
      socket.on('submission_deleted', onRemoteUnsub);
      socket.on('submission_updated', onRemoteSubUpdated);
      socket.on('teacher_receive_submission', onRemoteSubUpdated);
    }

    return () => {
      window.removeEventListener('verity:submission-updated', handleSubEvent);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      if (socket) {
        socket.off('student_unsubmitted', onRemoteUnsub);
        socket.off('teacher_student_unsubmitted', onRemoteUnsub);
        socket.off('submission_deleted', onRemoteUnsub);
        socket.off('submission_updated', onRemoteSubUpdated);
        socket.off('teacher_receive_submission', onRemoteSubUpdated);
      }
    };
  }, [assignments, classroomId, currentUser, socket, isMaterialItem, checkAllSubs, safeUsername, studentId]);

  const handleUnsubmitAssignment = useCallback((task) => {
    if (!task) return;
    const aId = String(task.id);
    const cId = classroom?.id ?? classroomId ?? 'default';

    unsubmittedIdsRef.current.add(aId);
    clearAllSubmissionStorage(aId, cId, currentUser, studentId, safeUsername);

    unsubmitStudentAssignment({
      assignmentId: aId,
      classroomId: cId,
      studentId,
      safeUsername,
      currentUser,
      socket
    });

    setSubmittedTasks(prev => ({
      ...prev,
      [task.id]: false,
      [aId]: false
    }));
  }, [classroom?.id, classroomId, currentUser, studentId, safeUsername, socket]);

  return { submittedTasks, handleUnsubmitAssignment };
}
