import localStore from '../data/localStore';

export const normalize = (text) => (text || '').replace(/\s+/g, '');

export const parseTimeoutMs = (str) => {
  if (!str) return 30 * 60 * 1000;
  const match = String(str).match(/^(\d+)\s*([smh])?$/i);
  if (!match) return 30 * 60 * 1000;
  const val = parseInt(match[1], 10);
  const unit = (match[2] || 'm').toLowerCase();
  if (unit === 's') return val * 1000;
  if (unit === 'h') return val * 3600 * 1000;
  return val * 60 * 1000;
};

export function getStudentIdentity(currentUser, username, assignment, classroom) {
  const rawStudentDisplayName =
    (currentUser?.name && currentUser.name.trim()) ||
    (typeof username === 'string' && username.trim()) ||
    (currentUser?.displayName && currentUser.displayName.trim()) ||
    (currentUser?.fullName && currentUser.fullName.trim()) ||
    (currentUser?.full_name && currentUser.full_name.trim()) ||
    (currentUser?.email ? currentUser.email.split('@')[0] : '') ||
    `Student_${Math.floor(Math.random() * 1000)}`;

  const studentDisplayName = rawStudentDisplayName;
  const safeUsername = studentDisplayName;
  const studentActualId =
    currentUser?.id != null
      ? String(currentUser.id)
      : currentUser?.email || studentDisplayName;
  const studentId = studentActualId;

  const assignmentId = assignment?.id != null ? String(assignment.id) : 'none';
  const rawClassroomId =
    classroom?.id ??
    classroom?.classroom_id ??
    classroom?.code ??
    assignment?.classroom_id ??
    assignment?.classroomId ??
    assignment?.classId ??
    assignment?.classroom?.id ??
    null;
  const classroomId =
    rawClassroomId != null && rawClassroomId !== '' && rawClassroomId !== 'none'
      ? String(rawClassroomId)
      : 'none';

  return {
    studentDisplayName,
    safeUsername,
    studentActualId,
    studentId,
    assignmentId,
    classroomId
  };
}

export function getSubKeys(classroomId, assignmentId, studentId, safeUsername, currentUser) {
  return [
    `verity_sub_${classroomId}_${assignmentId}_${studentId}`,
    `verity_sub_${classroomId}_${assignmentId}_${safeUsername}`,
    currentUser?.name ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.name}` : null,
    currentUser?.email ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.email}` : null,
    currentUser?.id ? `verity_sub_${classroomId}_${assignmentId}_id_${currentUser.id}` : null,
    `verity_sub_${classroomId}_${assignmentId}`
  ].filter(Boolean);
}

export function checkLocalSubmitted(classroomId, assignmentId, studentId, safeUsername, currentUser) {
  const keys = getSubKeys(classroomId, assignmentId, studentId, safeUsername, currentUser);
  for (const k of keys) {
    try {
      if (localStorage.getItem(k)) return true;
    } catch {}
  }
  return false;
}

export function getHistoryKeys(classroomId, assignmentId, studentId, safeUsername, currentUser) {
  return [
    `verity_history_${classroomId}_${assignmentId}_${studentId}`,
    `verity_history_${classroomId}_${assignmentId}_${safeUsername}`,
    currentUser?.name ? `verity_history_${classroomId}_${assignmentId}_${currentUser.name}` : null,
    currentUser?.email ? `verity_history_${classroomId}_${assignmentId}_${currentUser.email}` : null,
    `verity_history_${assignmentId}_${studentId}`,
    `verity_history_${assignmentId}_${safeUsername}`
  ].filter(Boolean);
}

export function loadInitialHistory(classroomId, assignmentId, studentId, safeUsername, currentUser, currentCode) {
  const hKeys = getHistoryKeys(classroomId, assignmentId, studentId, safeUsername, currentUser);
  for (const k of hKeys) {
    try {
      const item = localStorage.getItem(k);
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }

  const dKeys = [
    `verity_draft_${assignmentId}_${studentId}`,
    `verity_draft_${assignmentId}_${safeUsername}`
  ];
  for (const k of dKeys) {
    try {
      const item = localStorage.getItem(k);
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed?.history) && parsed.history.length > 0) return parsed.history;
      }
    } catch {}
  }

  const sKeys = getSubKeys(classroomId, assignmentId, studentId, safeUsername, currentUser);
  for (const k of sKeys) {
    try {
      const item = localStorage.getItem(k);
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed?.codeHistory) && parsed.codeHistory.length > 0) return parsed.codeHistory;
        if (Array.isArray(parsed?.history) && parsed.history.length > 0) return parsed.history;
      }
    } catch {}
  }

  return [{ time: Date.now(), code: currentCode }];
}

export function persistHistory(hist, currentCodeVal, classroomId, assignmentId, studentId, safeUsername, currentUser) {
  if (!Array.isArray(hist) || hist.length === 0) return;
  const curCode = currentCodeVal !== undefined ? currentCodeVal : '';

  getHistoryKeys(classroomId, assignmentId, studentId, safeUsername, currentUser).forEach((k) => {
    try {
      localStorage.setItem(k, JSON.stringify(hist));
    } catch {}
  });

  try {
    localStore.saveDraft(assignmentId, studentId, curCode, hist);
    if (studentId !== safeUsername) {
      localStore.saveDraft(assignmentId, safeUsername, curCode, hist);
    }
  } catch {}
}
