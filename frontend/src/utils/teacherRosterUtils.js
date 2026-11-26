import { normalizeReplayStudentName } from './teacherViewUtils';

export function getInitialStudentRoster(initialStudent, mode) {
  const initialMap = {};
  if (initialStudent && (initialStudent.id || initialStudent.name) && mode !== 'live') {
    const sId = normalizeReplayStudentName(initialStudent.name || initialStudent.id, initialStudent.email);
    const hist =
      Array.isArray(initialStudent.history) && initialStudent.history.length > 0
        ? initialStudent.history
        : Array.isArray(initialStudent.codeHistory) && initialStudent.codeHistory.length > 0
        ? initialStudent.codeHistory
        : initialStudent.finalCode
        ? [{ time: Date.now(), code: initialStudent.finalCode }]
        : [];

    initialMap[sId] = {
      id: sId,
      name: sId,
      status: 'Submitted',
      code:
        initialStudent.finalCode ||
        initialStudent.code ||
        (hist.length > 0 ? hist[hist.length - 1]?.code : '') ||
        '',
      codeHistory: hist,
      logs: initialStudent.logs || []
    };
  }
  return initialMap;
}

export function findLongestLocalHistory(classroom, assignment, sId, studentName, initialHistory) {
  let hist = initialHistory || [];
  const cId = classroom?.id ?? 'default';
  const aId = assignment?.id ?? 'default';
  const possibleKeys = [
    `verity_history_${cId}_${aId}_${sId}`,
    `verity_history_${aId}_${sId}`,
    `verity_history_${cId}_${aId}_${studentName}`,
    `verity_history_${aId}_${studentName}`
  ];
  for (const pk of possibleKeys) {
    try {
      const raw = localStorage.getItem(pk);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > hist.length) {
          hist = parsed;
          break;
        }
      }
    } catch {}
  }
  return hist;
}

export function extractSubmissionsFromStorage(classroom, assignment) {
  const newSubmittedSet = new Set();
  try {
    const cId = classroom?.id ?? 'default';
    const aId = assignment?.id;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith(`verity_sub_${cId}_${aId}_`) ||
          key.startsWith(`verity_sub_default_${aId}_`))
      ) {
        const val = JSON.parse(localStorage.getItem(key));
        if (val && (val.studentName || val.studentId)) {
          const sName = String(val.studentName || '').trim().toLowerCase();
          const sId = String(val.studentId || '').trim().toLowerCase();
          if (sName) newSubmittedSet.add(sName);
          if (sId) newSubmittedSet.add(sId);
        }
      }
    }
  } catch {}
  return newSubmittedSet;
}
