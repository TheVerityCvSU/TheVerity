import { apiFetch } from './api';

export const STORAGE_KEY = 'verity_teacher_classrooms';
export const GLOBAL_STORAGE_KEY = 'verity_global_classrooms';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Loads all registered users and splits them into instructors and students.
 */
export async function fetchUsersAndRoles() {
  try {
    const res = await apiFetch(`${API_BASE}/users`);
    const data = await res.json();
    const uList = Array.isArray(data) ? data : (data.users || []);

    const teachers = uList
      .filter(u => u.role === 'Teacher' || u.role === 'Instructor' || u.isTeacher)
      .map(u => u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim())
      .filter(Boolean);

    const students = uList
      .filter(u => u.role === 'Student' || !u.role || u.role === 'User')
      .map(u => ({
        id: u.id,
        name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Student',
        email: u.email || '',
        avatar: u.avatar || null,
        status: u.status || 'Active'
      }))
      .filter(u => u.email);

    return { teachers, students };
  } catch (_) {
    return { teachers: [], students: [] };
  }
}

/**
 * Loads classrooms from local storage fallback and remote API, merging results.
 */
export async function loadClassrooms() {
  let savedLocal = [];
  try {
    const rawG = localStorage.getItem(GLOBAL_STORAGE_KEY);
    const rawT = localStorage.getItem(STORAGE_KEY);
    if (rawG) savedLocal = JSON.parse(rawG);
    else if (rawT) savedLocal = JSON.parse(rawT);
  } catch (_) {}

  try {
    const r = await apiFetch(`${API_BASE}/classrooms`);
    if (r.status === 401 || r.status === 403) {
      return { classes: savedLocal, authError: true };
    }
    const d = await r.json();
    const serverList = Array.isArray(d) ? d : (d.classrooms || []);
    const mergedMap = new Map();
    savedLocal.forEach(c => {
      const key = (c.id || c.name || c.className || '').toString();
      if (key) mergedMap.set(key, c);
    });
    serverList.forEach(c => {
      const key = (c.id || c.name || c.className || '').toString();
      if (key) mergedMap.set(key, c);
    });
    const finalClasses = Array.from(mergedMap.values());
    if (finalClasses.length > 0) {
      try {
        localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(finalClasses));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalClasses));
      } catch (_) {}
      return { classes: finalClasses, authError: false };
    }
    return { classes: savedLocal, authError: false };
  } catch (_) {
    return { classes: savedLocal, authError: false };
  }
}

/**
 * Saves classroom list locally and syncs to backend.
 */
export async function persistClassrooms(updatedClasses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedClasses));
    localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(updatedClasses));
  } catch (_) {}

  try {
    await apiFetch(`${API_BASE}/classrooms`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classrooms: updatedClasses })
    });
  } catch (_) {}
}

/**
 * Archives or unarchives a classroom on the backend and updates local fallback storage.
 */
export async function toggleClassroomArchive(classroomId, archived, classes = []) {
  const nextArchived = Boolean(archived);
  const updatedClasses = classes.map(c =>
    String(c.id) === String(classroomId)
      ? { ...c, archived: nextArchived, status: nextArchived ? 'Archived' : 'Active', isActive: !nextArchived }
      : c
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedClasses));
    localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(updatedClasses));
  } catch (_) {}

  try {
    await apiFetch(`${API_BASE}/classrooms/${classroomId}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: nextArchived })
    });
  } catch (_) {}

  return updatedClasses;
}

/**
 * Deletes a classroom by ID locally and on backend.
 */
export async function deleteClassroom(classroomId, classes) {
  const updatedClasses = classes.filter(c => c.id !== classroomId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedClasses));
    localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(updatedClasses));
  } catch (_) {}

  try {
    await apiFetch(`${API_BASE}/classrooms/${classroomId}`, {
      method: 'DELETE'
    });
  } catch (_) {}

  return updatedClasses;
}

/**
 * Enrolls students in a classroom.
 */
export async function enrollStudents(classroomId, students) {
  return apiFetch(`${API_BASE}/classrooms/${classroomId}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ students })
  });
}

/**
 * Fetches the enrolled students roster for a classroom.
 */
export async function fetchClassroomRoster(classroomId, fallbackStudents = []) {
  try {
    const res = await apiFetch(`${API_BASE}/classroom-students/${classroomId}`);
    const data = await res.json();
    if (Array.isArray(data.students)) return data.students;
    if (Array.isArray(fallbackStudents)) return fallbackStudents;
    return [];
  } catch (_) {
    return Array.isArray(fallbackStudents) ? fallbackStudents : [];
  }
}

/**
 * Dispatches a background sync request.
 */
export async function triggerSync() {
  return apiFetch('/api/sync', { method: 'POST' }).catch(() => {});
}
