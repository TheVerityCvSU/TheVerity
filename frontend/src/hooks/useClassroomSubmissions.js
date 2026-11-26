import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, getConnectionStatus } from '../data/api';
import { getStudentIdentity } from '../utils/studentViewUtils';
import {
  clearAllSubmissionStorage,
  unsubmitStudentAssignment
} from '../data/studentSubmissionService';

function readLocalSubmissionsMap({ assignments, classroomId, currentUser, studentId, safeUsername, isMaterialItem, unsubmittedIds }) {
  const map = {};
  const timestamps = {};
  if (!Array.isArray(assignments) || assignments.length === 0) return { map, timestamps };

  const targetEmail = (currentUser?.email || '').toLowerCase().trim();
  const targetName = (currentUser?.name || safeUsername || '').toLowerCase().trim();
  const targetId = (currentUser?.id != null ? String(currentUser.id) : studentId).toLowerCase().trim();

  assignments.forEach(task => {
    if (isMaterialItem && isMaterialItem(task)) return;
    const aId = String(task.id);
    const cId = String(classroomId);

    if (unsubmittedIds && unsubmittedIds.has(aId)) {
      map[task.id] = false;
      map[aId] = false;
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

    const matchedKey = specificKeys.find(k => { try { return !!localStorage.getItem(k); } catch { return false; } });
    if (matchedKey) {
      map[task.id] = true;
      map[aId] = true;
      try {
        const parsed = JSON.parse(localStorage.getItem(matchedKey) || '{}');
        if (parsed?.submittedAt) {
          timestamps[task.id] = parsed.submittedAt;
          timestamps[aId] = parsed.submittedAt;
        }
      } catch {}
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
            key === `verity_sub_${cId}_${aId}` ||
            key === `verity_sub_default_${aId}` ||
            key === `verity_sub_${aId}`
          ) {
            map[task.id] = true;
            map[aId] = true;
            break;
          }
        }
      }
    } catch {}
  });

  return { map, timestamps };
}

export function useClassroomSubmissions({ assignments, classroom, currentUser, socket, isMaterialItem }) {
  const unsubmittedIdsRef = useRef(new Set());

  const identity = getStudentIdentity(currentUser, null, null, classroom);
  const safeUsername = identity.safeUsername;
  const studentId = identity.studentId;
  const classroomId = identity.classroomId;

  const [submittedTasks, setSubmittedTasks] = useState(() =>
    readLocalSubmissionsMap({
      assignments,
      classroomId,
      currentUser,
      studentId,
      safeUsername,
      isMaterialItem,
      unsubmittedIds: new Set()
    }).map
  );
  const [submissionTimestamps, setSubmissionTimestamps] = useState(() =>
    readLocalSubmissionsMap({
      assignments,
      classroomId,
      currentUser,
      studentId,
      safeUsername,
      isMaterialItem,
      unsubmittedIds: new Set()
    }).timestamps
  );
  const [checkedTasks, setCheckedTasks] = useState({});

  const checkAllSubs = useCallback(() => {
    const { map, timestamps } = readLocalSubmissionsMap({
      assignments,
      classroomId,
      currentUser,
      studentId,
      safeUsername,
      isMaterialItem,
      unsubmittedIds: unsubmittedIdsRef.current
    });

    if (Object.keys(timestamps).length > 0) {
      setSubmissionTimestamps(prev => ({ ...prev, ...timestamps }));
    }
    setSubmittedTasks(prev => ({ ...prev, ...map }));
  }, [assignments, classroomId, currentUser, studentId, safeUsername, isMaterialItem]);

  useEffect(() => {
    let cancelled = false;
    checkAllSubs();

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    const studentSubsPromise = apiFetch(`${baseUrl}/student/submissions`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        if (Array.isArray(data?.submissions) && data.submissions.length > 0) {
          setSubmittedTasks(prev => {
            const next = { ...prev };
            let changed = false;
            data.submissions.forEach(s => {
              const aId = String(s.assignment_id);
              if (s.assignment_id != null && !unsubmittedIdsRef.current.has(aId)) {
                if (!next[s.assignment_id] || !next[aId]) {
                  next[s.assignment_id] = true;
                  next[aId] = true;
                  changed = true;
                }
              }
            });
            return changed ? next : prev;
          });
          setSubmissionTimestamps(prev => {
            const next = { ...prev };
            let changed = false;
            data.submissions.forEach(s => {
              const ts = s.submittedAt || s.submittedat;
              if (s.assignment_id != null && ts && next[s.assignment_id] !== ts) {
                next[s.assignment_id] = ts;
                next[String(s.assignment_id)] = ts;
                changed = true;
              }
            });
            return changed ? next : prev;
          });
        }
      })
      .catch(() => {});

    const nonMaterialTasks = assignments.filter(task => !(isMaterialItem && isMaterialItem(task)));
    nonMaterialTasks.forEach(task => {
      const aId = String(task.id);
      const taskPromise = apiFetch(`${baseUrl}/submissions/${task.id}`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (cancelled || !data) return;
          if (Array.isArray(data?.submissions)) {
            const targetEmail = (currentUser?.email || '').toLowerCase().trim();
            const targetName = (currentUser?.name || safeUsername || '').toLowerCase().trim();
            const targetId = (currentUser?.id != null ? String(currentUser.id) : studentId).toLowerCase().trim();

            const hasSub = data.submissions.some(s => {
              const sName = String(s.student_name || s.studentName || '').toLowerCase().trim();
              const sId = String(s.student_id || s.studentId || '').toLowerCase().trim();

              if ((targetName && sName === targetName) || (targetEmail && sName === targetEmail) || (targetId && sId === targetId)) return true;
              if (currentUser?.role === 'Student' && data.submissions.length === 1) return true;
              return false;
            });

            if (hasSub && !unsubmittedIdsRef.current.has(aId)) {
              setSubmittedTasks(prev => (prev[task.id] && prev[aId] ? prev : { ...prev, [task.id]: true, [aId]: true }));
            } else if (data.submissions.length === 0 && !data.isOfflineFallback && getConnectionStatus().activeMode !== 'offline') {
              setSubmittedTasks(prev => (prev[task.id] || prev[aId] ? { ...prev, [task.id]: false, [aId]: false } : prev));
            }
          }
        })
        .catch(() => {});

      Promise.allSettled([studentSubsPromise, taskPromise]).then(() => {
        if (cancelled) return;
        setCheckedTasks(prev => (prev[task.id] && prev[aId] ? prev : { ...prev, [task.id]: true, [aId]: true }));
      });
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
      cancelled = true;
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
    if (task.disableBack || task.disable_back) {
      alert('Unsubmitting is disabled for this activity.');
      return;
    }
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

  return { submittedTasks, submissionTimestamps, checkedTasks, handleUnsubmitAssignment };
}
