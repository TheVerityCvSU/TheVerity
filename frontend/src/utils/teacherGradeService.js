import { apiFetch } from '../data/api';

export async function saveTeacherGrade({
  assignmentId,
  selectedStudentId,
  studentName,
  gradeInput,
  feedbackInput,
  setStudents,
  setToast,
  onCloseModal
}) {
  if (!assignmentId || !selectedStudentId) return;
  try {
    const now = new Date().toISOString();
    const gradesKey = `verity_grades_${assignmentId}`;
    const savedGrades = JSON.parse(localStorage.getItem(gradesKey)) || {};
    const updated = {
      ...savedGrades,
      [selectedStudentId]: { grade: gradeInput, feedback: feedbackInput, gradedAt: now }
    };
    try {
      localStorage.setItem(gradesKey, JSON.stringify(updated));
    } catch {}

    const res = await apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignmentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: selectedStudentId,
        grade: gradeInput,
        feedback: feedbackInput
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to save grade');
    }

    setStudents((prev) => {
      const next = { ...prev };
      if (next[selectedStudentId]) {
        next[selectedStudentId] = { ...next[selectedStudentId], status: 'Graded' };
      }
      return next;
    });

    setToast({
      message: `Successfully graded ${studentName}!`,
      type: 'success'
    });
    setTimeout(() => setToast(null), 3500);
    onCloseModal();
  } catch (e) {
    console.error(e);
    setToast({ message: 'Failed to save grade', type: 'warning' });
    setTimeout(() => setToast(null), 3500);
  }
}
