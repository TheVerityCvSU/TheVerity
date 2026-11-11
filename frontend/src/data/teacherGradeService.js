import { apiFetch } from './api';

export async function submitBulkGrades({ activityId, gradingStudents, bulkGradeVal, bulkFeedbackVal }) {
  if (!activityId || !gradingStudents?.length) return;

  const payload = gradingStudents.map(s => ({
    studentId: s.id,
    grade: bulkGradeVal,
    feedback: bulkFeedbackVal
  }));

  try {
    await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/grades/${activityId}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grades: payload })
    });
  } catch {
    payload.forEach(p => {
      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/grades/${activityId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      }).catch(() => {});
    });
  }
}

export async function saveSingleGrade({ activityId, studentId, grade, feedback }) {
  if (!activityId || !studentId) return;

  return apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/grades/${activityId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, grade, feedback })
  });
}
