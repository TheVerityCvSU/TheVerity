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

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to add student to classroom.');
  }

  // Persist verified canonical student returned by server to local storage cache
  try {
    const enrolled = Array.isArray(data?.students) && data.students[0] ? data.students[0] : null;
    if (enrolled && enrolled.email) {
      const localKey = `verity_classroom_enrollments_${classroomId}`;
      const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
      const alreadyExists = existing.some(
        (s) => s.email?.toLowerCase() === enrolled.email.toLowerCase()
      );
      if (!alreadyExists) {
        existing.push({
          id: enrolled.id || null,
          name: enrolled.name || studentName,
          email: enrolled.email,
          avatar: null
        });
        localStorage.setItem(localKey, JSON.stringify(existing));
      }
    }
  } catch {}

  return data;
};

