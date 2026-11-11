import { apiFetch } from '../data/api';
import { localStore } from '../data/localStore';

export const getHistoryKeys = (classroomId, assignmentId, studentId, safeUsername, currentUser) => [
  `verity_history_${classroomId}_${assignmentId}_${studentId}`,
  `verity_history_${classroomId}_${assignmentId}_${safeUsername}`,
  currentUser?.name ? `verity_history_${classroomId}_${assignmentId}_${currentUser.name}` : null,
  currentUser?.email ? `verity_history_${classroomId}_${assignmentId}_${currentUser.email}` : null,
  `verity_history_${assignmentId}_${studentId}`,
  `verity_history_${assignmentId}_${safeUsername}`
].filter(Boolean);

export const getSubmissionKeys = (classroomId, assignmentId, studentId, safeUsername, currentUser) => [
  `verity_sub_${classroomId}_${assignmentId}_${studentId}`,
  `verity_sub_${classroomId}_${assignmentId}_${safeUsername}`,
  currentUser?.name ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.name}` : null,
  currentUser?.email ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.email}` : null,
  currentUser?.id ? `verity_sub_${classroomId}_${assignmentId}_id_${currentUser.id}` : null
].filter(Boolean);

export function resolveCodeHistory({ classroomId, assignmentId, studentId, safeUsername, currentUser, currentCode, priorSubmission }) {
  const hKeys = getHistoryKeys(classroomId, assignmentId, studentId, safeUsername, currentUser);
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
    if (lastEntry && Date.now() - (lastEntry.time || 0) > 1000) {
      resolvedHistory = [...resolvedHistory, { time: Date.now(), code: currentCode }];
    }
  }

  return { resolvedHistory, hKeys };
}

export function backupCodeHistory({ hKeys, assignmentId, studentId, currentCode, history }) {
  hKeys.forEach(hk => {
    try {
      const cur = localStorage.getItem(hk);
      if (!cur || JSON.parse(cur).length < history.length) {
        localStorage.setItem(hk, JSON.stringify(history));
      }
    } catch {}
  });
  try {
    localStore.saveDraft(assignmentId, studentId, currentCode, history);
  } catch {}
}

export function performSubmitActivity({
  safeUsername,
  studentId,
  assignmentId,
  classroomId,
  currentCode,
  resolvedHistory,
  allSubKeys,
  socket
}) {
  const subData = {
    studentName: safeUsername,
    studentId,
    assignmentId,
    classroomId,
    finalCode: currentCode,
    codeHistory: resolvedHistory,
    submittedAt: new Date().toISOString()
  };

  allSubKeys.forEach(k => {
    try { localStorage.setItem(k, JSON.stringify(subData)); } catch { }
  });

  const subPayload = {
    studentName: safeUsername,
    studentId,
    finalCode: currentCode,
    codeHistory: resolvedHistory,
    classroomId
  };

  apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${assignmentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subPayload)
  }).catch(async () => {
    try {
      await localStore.addToSyncQueue('submit_assignment', `/submissions/${assignmentId}`, 'POST', subPayload);
    } catch (_) {}
  });

  if (socket) {
    socket.emit('student_leave_workspace', { assignmentId, classroomId, studentId, name: safeUsername, reason: 'submitted' });
    socket.emit('submit_exam', { studentName: safeUsername, studentId, assignmentId, finalCode: currentCode, classroomId, codeHistory: resolvedHistory, submitted: true });
  }

  try {
    window.dispatchEvent(new CustomEvent('verity:submission-updated', { detail: { assignmentId, classroomId, submitted: true } }));
  } catch {}

  return subData;
}

export function performUnsubmitActivity({
  safeUsername,
  studentId,
  assignmentId,
  classroomId,
  keysToRemove,
  socket
}) {
  keysToRemove.forEach(k => {
    try { localStorage.removeItem(k); } catch { }
  });

  const deleteUrl = `/submissions/${assignmentId}/${encodeURIComponent(safeUsername)}`;
  apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${deleteUrl}`, { method: 'DELETE' })
    .catch(async () => {
      try { await localStore.addToSyncQueue('unsubmit_assignment', deleteUrl, 'DELETE', null); } catch (_) {}
    });

  if (studentId && studentId !== safeUsername) {
    const deleteIdUrl = `/submissions/${assignmentId}/${encodeURIComponent(studentId)}`;
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${deleteIdUrl}`, { method: 'DELETE' })
      .catch(async () => {
        try { await localStore.addToSyncQueue('unsubmit_assignment', deleteIdUrl, 'DELETE', null); } catch (_) {}
      });
  }

  if (socket) {
    socket.emit('unsubmit_exam', { studentName: safeUsername, studentId, assignmentId, classroomId });
  }

  try {
    window.dispatchEvent(new CustomEvent('verity:submission-updated', { detail: { assignmentId, classroomId, submitted: false } }));
  } catch {}
}
