import { apiFetch } from './api';
import { localStore } from './localStore';
import { getStudentGrade } from '../utils/gradeUtils';

export function getSubmissionStorageKeys(classroomId, assignmentId, currentUser, studentId, safeUsername) {
  const cId = classroomId ?? 'default';
  const aId = assignmentId ?? 'default';
  const uid = currentUser?.id != null ? String(currentUser.id) : null;
  const email = currentUser?.email || null;
  const name = currentUser?.name || null;

  return [
    `verity_sub_${cId}_${aId}_${studentId}`,
    `verity_sub_${cId}_${aId}_${safeUsername}`,
    `verity_sub_${cId}_${aId}`,
    `verity_sub_default_${aId}`,
    `verity_sub_${aId}`,
    `verity_sub_none_${aId}`,
    `verity_sub_default_${aId}_${studentId}`,
    `verity_sub_default_${aId}_${safeUsername}`,
    `verity_sub_${aId}_${studentId}`,
    `verity_sub_${aId}_${safeUsername}`,
    name ? `verity_sub_${cId}_${aId}_${name}` : null,
    email ? `verity_sub_${cId}_${aId}_${email}` : null,
    uid ? `verity_sub_${cId}_${aId}_id_${uid}` : null,
    name ? `verity_sub_default_${aId}_${name}` : null,
    email ? `verity_sub_default_${aId}_${email}` : null,
    uid ? `verity_sub_default_${aId}_id_${uid}` : null,
    name ? `verity_sub_${aId}_${name}` : null,
    email ? `verity_sub_${aId}_${email}` : null,
    uid ? `verity_sub_${aId}_id_${uid}` : null
  ].filter(Boolean);
}

export function getHistoryStorageKeys(classroomId, assignmentId, currentUser, studentId, safeUsername) {
  const cId = classroomId ?? 'default';
  const aId = assignmentId ?? 'default';
  const uid = currentUser?.id != null ? String(currentUser.id) : null;
  const email = currentUser?.email || null;
  const name = currentUser?.name || null;

  return [
    `verity_history_${cId}_${aId}_${studentId}`,
    `verity_history_${cId}_${aId}_${safeUsername}`,
    `verity_history_${aId}_${studentId}`,
    `verity_history_${aId}_${safeUsername}`,
    name ? `verity_history_${cId}_${aId}_${name}` : null,
    email ? `verity_history_${cId}_${aId}_${email}` : null,
    uid ? `verity_history_${cId}_${aId}_id_${uid}` : null,
    name ? `verity_history_${aId}_${name}` : null,
    email ? `verity_history_${aId}_${email}` : null,
    uid ? `verity_history_${aId}_id_${uid}` : null
  ].filter(Boolean);
}

export function clearAllSubmissionStorage(assignmentId, classroomId, currentUser, studentId, safeUsername) {
  const cId = classroomId ?? 'default';
  const aId = assignmentId ?? 'default';
  const keys = getSubmissionStorageKeys(cId, aId, currentUser, studentId, safeUsername);
  keys.forEach(k => {
    try { localStorage.removeItem(k); } catch {}
  });

  const aIdStr = String(aId);
  const targetId = String(studentId || '').toLowerCase();
  const targetName = String(safeUsername || '').toLowerCase();
  const targetEmail = String(currentUser?.email || '').toLowerCase();
  const targetUid = currentUser?.id != null ? String(currentUser.id).toLowerCase() : '';

  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('verity_sub_')) continue;
      if (
        key.includes(`_${aIdStr}_`) ||
        key.endsWith(`_${aIdStr}`) ||
        key === `verity_sub_${aIdStr}` ||
        key.startsWith(`verity_sub_${cId}_${aIdStr}`) ||
        key.startsWith(`verity_sub_default_${aIdStr}`)
      ) {
        const kLower = key.toLowerCase();
        if (
          (!targetId && !targetEmail && !targetName) ||
          (targetId && kLower.includes(targetId)) ||
          (targetUid && kLower.includes(targetUid)) ||
          (targetEmail && kLower.includes(targetEmail)) ||
          (targetName && kLower.includes(targetName)) ||
          key === `verity_sub_${cId}_${aIdStr}` ||
          key === `verity_sub_default_${aIdStr}` ||
          key === `verity_sub_${aIdStr}`
        ) {
          toRemove.push(key);
        }
      }
    }
    toRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
  } catch {}
}

export function getInitialSavedSubmission(primaryKey, fallbackKeys) {
  try {
    const saved = localStorage.getItem(primaryKey);
    if (saved) return JSON.parse(saved);
    for (const key of fallbackKeys) {
      const val = localStorage.getItem(key);
      if (val) return JSON.parse(val);
    }
  } catch {}
  return null;
}

export function getInitialSavedGrade(gradesKey, currentUser, studentId, safeUsername) {
  try {
    const saved = localStorage.getItem(gradesKey);
    const allGrades = saved ? JSON.parse(saved) : {};
    return getStudentGrade(allGrades, { id: currentUser?.id, name: currentUser?.name, email: currentUser?.email }) ||
           getStudentGrade(allGrades, studentId) ||
           getStudentGrade(allGrades, safeUsername) ||
           null;
  } catch {
    return null;
  }
}

export function resolveSubmissionHistory(hKeys, currentCode, priorSubmission) {
  let resolvedHistory = [];
  for (const hk of hKeys) {
    try {
      const item = localStorage.getItem(hk);
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed) && parsed.length > resolvedHistory.length) {
          resolvedHistory = parsed;
        }
      }
    } catch {}
  }

  if (resolvedHistory.length === 0) {
    const priorH = priorSubmission?.codeHistory || priorSubmission?.history;
    if (Array.isArray(priorH) && priorH.length > 0) {
      resolvedHistory = priorH;
    }
  }

  if (resolvedHistory.length === 0) {
    resolvedHistory = [{ time: Date.now(), code: currentCode }];
  } else {
    const lastEntry = resolvedHistory[resolvedHistory.length - 1];
    if (lastEntry?.code !== currentCode) {
      resolvedHistory = [...resolvedHistory, { time: Date.now(), code: currentCode }];
    }
  }

  return resolvedHistory;
}

export async function submitStudentAssignment({
  assignmentId,
  classroomId,
  studentId,
  safeUsername,
  currentCode,
  resolvedHistory,
  allKeys,
  hKeys,
  socket,
  currentUser
}) {
  const cId = classroomId ?? 'default';
  const aId = assignmentId ?? 'default';
  const storageKeys = allKeys || getSubmissionStorageKeys(cId, aId, currentUser, studentId, safeUsername);
  const historyKeys = hKeys || getHistoryStorageKeys(cId, aId, currentUser, studentId, safeUsername);

  historyKeys.forEach(hk => {
    try { localStorage.setItem(hk, JSON.stringify(resolvedHistory)); } catch {}
  });
  try {
    localStore.saveDraft(aId, studentId, currentCode, resolvedHistory);
  } catch {}

  const subData = {
    studentName: safeUsername,
    studentId,
    assignmentId: aId,
    classroomId: cId,
    finalCode: currentCode,
    codeHistory: resolvedHistory,
    submittedAt: new Date().toISOString()
  };

  storageKeys.forEach(k => {
    try { localStorage.setItem(k, JSON.stringify(subData)); } catch {}
  });

  const subPayload = {
    studentName: safeUsername,
    studentId,
    studentEmail: currentUser?.email || '',
    finalCode: currentCode,
    codeHistory: resolvedHistory,
    classroomId: cId
  };

  const submitEndpoint = `/submissions/${aId}`;
  apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${submitEndpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subPayload)
  }).catch(async () => {
    try {
      await localStore.addToSyncQueue('submit_assignment', submitEndpoint, 'POST', subPayload);
    } catch (_) {}
  });

  if (socket) {
    socket.emit('student_leave_workspace', {
      assignmentId: aId,
      classroomId: cId,
      studentId,
      name: safeUsername,
      reason: 'submitted'
    });
    socket.emit('submit_exam', {
      studentName: safeUsername,
      studentId,
      studentEmail: currentUser?.email || '',
      assignmentId: aId,
      finalCode: currentCode,
      classroomId: cId,
      codeHistory: resolvedHistory,
      submitted: true
    });
  }

  try {
    window.dispatchEvent(new CustomEvent('verity:submission-updated', {
      detail: { assignmentId: aId, classroomId: cId, submitted: true }
    }));
  } catch {}

  return subData;
}

export function unsubmitStudentAssignment({
  assignmentId,
  classroomId,
  studentId,
  safeUsername,
  priorSubmission,
  hKeys,
  socket,
  currentUser
}) {
  const cId = classroomId ?? 'default';
  const aId = assignmentId ?? 'default';
  const historyKeys = hKeys || getHistoryStorageKeys(cId, aId, currentUser, studentId, safeUsername);

  const existingHist = priorSubmission?.codeHistory || priorSubmission?.history;
  if (Array.isArray(existingHist) && existingHist.length > 0) {
    historyKeys.forEach(hk => {
      try {
        const cur = localStorage.getItem(hk);
        if (!cur || JSON.parse(cur).length < existingHist.length) {
          localStorage.setItem(hk, JSON.stringify(existingHist));
        }
      } catch {}
    });
    try {
      localStore.saveDraft(aId, studentId, priorSubmission?.finalCode || '', existingHist);
    } catch {}
  }

  clearAllSubmissionStorage(aId, cId, currentUser, studentId, safeUsername);

  const deleteTargets = Array.from(new Set([
    safeUsername,
    studentId,
    currentUser?.email,
    currentUser?.name,
    currentUser?.id != null ? String(currentUser.id) : null
  ].filter(Boolean)));

  deleteTargets.forEach(tgt => {
    const deleteUrl = `/submissions/${aId}/${encodeURIComponent(tgt)}`;
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${deleteUrl}`, {
      method: 'DELETE'
    }).catch(async () => {
      try {
        await localStore.addToSyncQueue('unsubmit_assignment', deleteUrl, 'DELETE', null);
      } catch (_) {}
    });
  });

  if (socket) {
    socket.emit('unsubmit_exam', {
      studentName: safeUsername,
      studentId,
      studentEmail: currentUser?.email || '',
      assignmentId: aId,
      classroomId: cId
    });
  }

  try {
    window.dispatchEvent(new CustomEvent('verity:submission-updated', {
      detail: { assignmentId: aId, classroomId: cId, submitted: false }
    }));
  } catch {}
}
