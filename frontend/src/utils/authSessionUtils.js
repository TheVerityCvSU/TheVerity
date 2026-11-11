export const normalizeSavedUser = (u) => {
  if (!u || typeof u !== 'object') return u;
  const emailLower = String(u.email || '').trim().toLowerCase();
  const nameLower = String(u.name || '').trim().toLowerCase();
  if (emailLower === 'kimfabie123@gmail.com' && (nameLower === 'kim fabie' || nameLower === 'kimfabie' || nameLower === 'kimfabie123@gmail.com')) {
    return { ...u, name: 'MIKOOOOO' };
  }
  return u;
};

export const clearAuthStorage = () => {
  const keys = [
    'currentScreen', 'currentUser', 'activeClassroom', 'activeAssignment',
    'verity_token', 'token', 'verity_user', 'verity_teacher_classrooms',
    'verity_classrooms', 'verity_student_classrooms_default',
    'verity_student_classrooms_anon', 'verity_teacher_classrooms_anon',
    'verity_teacher_classrooms_default', 'verity_cached_classrooms'
  ];
  keys.forEach(k => {
    try { localStorage.removeItem(k); } catch (_) {}
  });
  try { sessionStorage.clear(); } catch (_) {}
};
