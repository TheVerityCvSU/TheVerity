import { useEffect } from 'react';
import { apiFetch } from '../data/api';

export function useGradingSocketEvents({
  assignmentId,
  socket,
  loadData,
  setStudents,
  setSelectedId,
  setGrades
}) {
  useEffect(() => {
    if (!socket) return;

    const onNewSubmission = () => loadData();

    const onUnsubmit = (data) => {
      if (data?.studentName || data?.studentId) {
        const removedName = String(data.studentName || data.studentId || '').toLowerCase();
        setStudents(prev => prev.filter(s => String(s.name || '').toLowerCase() !== removedName && String(s.id || '').toLowerCase() !== removedName));
        setSelectedId(prev => (prev && String(prev).toLowerCase() === removedName ? null : prev));

        setGrades(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(k => {
            if (k.toLowerCase() === removedName) delete next[k];
          });
          return next;
        });

        if (assignmentId && assignmentId !== 'default') {
          apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignmentId}/${encodeURIComponent(data.studentName || data.studentId)}`, {
            method: 'DELETE'
          }).catch(() => {});
        }
      }
      setTimeout(loadData, 500);
    };

    const onGradeUpdated = (data) => {
      if (!data || String(data.assignmentId) !== String(assignmentId) || !data.studentId) return;
      setGrades(prev => ({
        ...prev,
        [data.studentId]: { grade: data.grade, feedback: data.feedback, gradedAt: data.gradedAt || new Date().toISOString() }
      }));
    };

    const onBulkGradesUpdated = (data) => {
      if (!data || String(data.assignmentId) !== String(assignmentId) || !Array.isArray(data.grades)) return;
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
      if (!data || String(data.assignmentId) !== String(assignmentId) || !data.studentId) return;
      const target = String(data.studentId).toLowerCase();
      setGrades(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          if (k.toLowerCase() === target) delete next[k];
        });
        return next;
      });
    };

    socket.on('teacher_receive_submission', onNewSubmission);
    socket.on('teacher_student_unsubmitted', onUnsubmit);
    socket.on('student_unsubmitted', onUnsubmit);
    socket.on('grade_updated', onGradeUpdated);
    socket.on('bulk_grades_updated', onBulkGradesUpdated);
    socket.on('grade_deleted', onGradeDeleted);

    return () => {
      socket.off('teacher_receive_submission', onNewSubmission);
      socket.off('teacher_student_unsubmitted', onUnsubmit);
      socket.off('student_unsubmitted', onUnsubmit);
      socket.off('grade_updated', onGradeUpdated);
      socket.off('bulk_grades_updated', onBulkGradesUpdated);
      socket.off('grade_deleted', onGradeDeleted);
    };
  }, [assignmentId, socket, loadData, setStudents, setSelectedId, setGrades]);
}

