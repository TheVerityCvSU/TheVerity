// Enrollment service: handles enrolling a student into a classroom via API and syncing local cache.
import { apiFetch } from './api';

export const enrollStudentInClassroom = async ({ classroomId, studentEmail, studentName }) => {
  const response = await apiFetch(
    `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/classrooms/${classroomId}/enroll`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentEmail,
        studentName
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to add student to classroom.');
  }

  // Also persist to local storage enrollment key for instant peer detection
  try {
    const localKey = `verity_classroom_enrollments_${classroomId}`;
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    const alreadyExists = existing.some(
      (s) => s.email?.toLowerCase() === studentEmail.toLowerCase()
    );
    if (!alreadyExists) {
      existing.push({
        name: studentName,
        email: studentEmail,
        avatar: null
      });
      localStorage.setItem(localKey, JSON.stringify(existing));
    }
  } catch {}

  return data;
};

