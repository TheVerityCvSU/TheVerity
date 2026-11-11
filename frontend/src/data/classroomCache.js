// Classroom cache: saves and loads the user's classroom list in localStorage.
import { sortClassroomsAlphabetically } from '../utils/classroomList';

/**
 * Returns a primary localStorage key for user classrooms.
 * Prioritizes user?.id so the key stays constant even when email changes.
 */
export const getClassroomStorageKey = (user, role = 'student') => {
  const isTeacher = role === 'teacher' || role === 'Teacher' || role === 'instructor' || role === 'Instructor';
  const prefix = isTeacher ? 'verity_teacher_classrooms' : 'verity_student_classrooms';
  const identifier = user?.id || user?.email || (user?.name ? user.name.toLowerCase().replace(/\s+/g, '_') : null);
  return identifier ? `${prefix}_${identifier}` : `${prefix}_anon`;
};

/**
 * Safely retrieves cached classrooms from localStorage.
 * Checks user.id key, then user.email key, then username key, then default key.
 */
export const getCachedClassrooms = (user, role = 'student') => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const isTeacher = role === 'teacher' || role === 'Teacher' || role === 'instructor' || role === 'Instructor';
  const prefix = isTeacher ? 'verity_teacher_classrooms' : 'verity_student_classrooms';

  // 1. Try stable user.id key
  if (user?.id) {
    try {
      const raw = localStorage.getItem(`${prefix}_${user.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return sortClassroomsAlphabetically(parsed);
      }
    } catch {}
  }

  // 2. Try email key (legacy or previous email)
  if (user?.email) {
    try {
      const raw = localStorage.getItem(`${prefix}_${user.email}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Self-heal: copy to id-based key
          if (user?.id) {
            try { localStorage.setItem(`${prefix}_${user.id}`, raw); } catch {}
          }
          return sortClassroomsAlphabetically(parsed);
        }
      }
    } catch {}
  }

  // 3. Try name key
  if (user?.name) {
    try {
      const cleanName = user.name.toLowerCase().replace(/\s+/g, '_');
      const raw = localStorage.getItem(`${prefix}_${cleanName}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return sortClassroomsAlphabetically(parsed);
      }
    } catch {}
  }

  // 4. Try generic/default fallbacks ONLY for unauthenticated / demo users without user id or email
  if (!user?.id && !user?.email) {
    for (const fallbackKey of [`${prefix}_default`, `${prefix}_anon`, 'verity_cached_classrooms']) {
      try {
        const raw = localStorage.getItem(fallbackKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return sortClassroomsAlphabetically(parsed);
        }
      } catch {}
    }
  }

  return [];
};

/**
 * Persists classrooms to localStorage under both stable id and email keys.
 */
export const saveCachedClassrooms = (classrooms, user, role = 'student', allowEmpty = false) => {
  if (typeof window === 'undefined' || !window.localStorage || !Array.isArray(classrooms)) return;
  // If classrooms is empty and not explicitly allowed, do not wipe existing valid cache (e.g. offline fallback)
  if (classrooms.length === 0 && !allowEmpty) {
    const existing = getCachedClassrooms(user, role);
    if (existing.length > 0) {
      return; // Preserve existing cached classrooms!
    }
  }
  const isTeacher = role === 'teacher' || role === 'Teacher' || role === 'instructor' || role === 'Instructor';
  const prefix = isTeacher ? 'verity_teacher_classrooms' : 'verity_student_classrooms';
  const sorted = sortClassroomsAlphabetically(classrooms);
  const json = JSON.stringify(sorted);

  if (user?.id) {
    try { localStorage.setItem(`${prefix}_${user.id}`, json); } catch {}
  }
  if (user?.email) {
    try { localStorage.setItem(`${prefix}_${user.email}`, json); } catch {}
  }
  // Only write to default if anonymous / demo user
  if (!user?.id && !user?.email) {
    try { localStorage.setItem(`${prefix}_default`, json); } catch {}
  }
};

/**
 * Migrates cached classrooms when a user verifies and switches to a new email address.
 */
export const migrateUserClassroomsOnEmailChange = (oldEmail, newEmail, userId) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const prefixes = ['verity_teacher_classrooms', 'verity_student_classrooms'];
  prefixes.forEach(prefix => {
    let existingData = null;
    if (userId) {
      existingData = localStorage.getItem(`${prefix}_${userId}`);
    }
    if (!existingData && oldEmail) {
      existingData = localStorage.getItem(`${prefix}_${oldEmail}`);
    }
    if (existingData) {
      if (newEmail) {
        try { localStorage.setItem(`${prefix}_${newEmail}`, existingData); } catch {}
      }
      if (userId) {
        try { localStorage.setItem(`${prefix}_${userId}`, existingData); } catch {}
      }
    }
  });
};
