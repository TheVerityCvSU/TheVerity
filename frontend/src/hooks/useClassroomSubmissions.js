import { useState, useEffect } from 'react';
import { apiFetch } from '../data/api';

export function useClassroomSubmissions({ assignments, classroom, currentUser, socket, isMaterialItem }) {
  const [submittedTasks, setSubmittedTasks] = useState({});

  useEffect(() => {
    const safeUsername = currentUser?.name || currentUser?.email || 'Student';
    const studentActualId = currentUser?.id != null ? String(currentUser.id) : (currentUser?.email || safeUsername);
    const studentId = studentActualId;
    const classroomId = classroom?.id ?? 'default';

    const checkAllSubs = () => {
      const map = {};
      const targetEmail = (currentUser?.email || '').toLowerCase();
      const targetName = (currentUser?.name || safeUsername || '').toLowerCase();
      const targetId = (currentUser?.id != null ? String(currentUser.id) : studentId).toLowerCase();

      assignments.forEach(task => {
        if (isMaterialItem(task)) return;
        const aId = String(task.id);
        const cId = String(classroomId);

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
      setSubmittedTasks(map);
    };

    checkAllSubs();

    apiFetch(`${import.meta.env.VITE_API_URL}/student/submissions`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data?.submissions) && data.submissions.length > 0) {
          setSubmittedTasks(prev => {
            const next = { ...prev };
            let changed = false;
            data.submissions.forEach(s => {
              if (s.assignment_id != null && !next[s.assignment_id]) {
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
      if (isMaterialItem(task)) return;
      apiFetch(`${import.meta.env.VITE_API_URL}/submissions/${task.id}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data?.submissions)) {
            const targetEmail = (currentUser?.email || '').toLowerCase();
            const targetName = (currentUser?.name || safeUsername || '').toLowerCase();
            const targetId = (currentUser?.id != null ? String(currentUser.id) : studentId).toLowerCase();
            const hasSub = data.submissions.some(s => {
              const sName = String(s.student_name || s.studentName || '').toLowerCase();
              const sId = String(s.student_id || s.studentId || '').toLowerCase();
              return (targetName && sName === targetName) ||
                     (targetEmail && sName === targetEmail) ||
                     (targetId && sId === targetId) ||
                     (targetName && sId === targetName) ||
                     (targetEmail && sId === targetEmail);
            });
            if (hasSub) {
              setSubmittedTasks(prev => prev[task.id] ? prev : ({ ...prev, [task.id]: true }));
            }
          }
        })
        .catch(() => {});
    });

    const handleSubEvent = (e) => {
      if (e.detail?.assignmentId != null) {
        setSubmittedTasks(prev => ({
          ...prev,
          [e.detail.assignmentId]: !!e.detail.submitted
        }));
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

    const onSubChange = () => checkAllSubs();
    if (socket) {
      socket.on('student_unsubmitted', onSubChange);
      socket.on('teacher_receive_submission', onSubChange);
    }

    return () => {
      window.removeEventListener('verity:submission-updated', handleSubEvent);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      if (socket) {
        socket.off('student_unsubmitted', onSubChange);
        socket.off('teacher_receive_submission', onSubChange);
      }
    };
  }, [assignments, classroom?.id, currentUser, socket, isMaterialItem]);

  return { submittedTasks };
}
