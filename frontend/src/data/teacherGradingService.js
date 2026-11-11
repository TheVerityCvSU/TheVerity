import { apiFetch } from './api';

export function normalizeReplayStudentName(rawName, rawEmail = '') {
  const trimmed = String(rawName || '').trim();
  const lower = trimmed.toLowerCase();
  const emailLower = String(rawEmail || '').trim().toLowerCase();
  if (
    emailLower === 'kimfabie123@gmail.com' ||
    lower === 'kimfabie123@gmail.com' ||
    lower === 'kimfabie' ||
    lower === 'kim fabie'
  ) {
    return 'MIKOOOOO';
  }
  return trimmed || 'Student';
}

export function mergeIntoSubmissionsMap(submissionsMap, rawName, rawEmail, submittedAt, finalCode, history) {
  const name = normalizeReplayStudentName(rawName, rawEmail);
  const low = name.toLowerCase();
  const histArr = Array.isArray(history) ? history : [];
  const resolvedCode = finalCode || (histArr.length > 0 ? histArr[histArr.length - 1]?.code : null) || null;
  const existing = submissionsMap[low];

  if (!existing) {
    submissionsMap[low] = {
      id: name,
      name,
      email: rawEmail || `${name.toLowerCase().replace(/\s+/g, '.')}@student.verity.edu`,
      submittedAt: submittedAt || null,
      finalCode: resolvedCode,
      history: histArr
    };
  } else {
    const newTime = new Date(submittedAt || 0).getTime();
    const oldTime = new Date(existing.submittedAt || 0).getTime();
    const preferNew = newTime > oldTime || (newTime === oldTime && histArr.length >= (existing.history?.length || 0));
    if (preferNew) {
      if (submittedAt) existing.submittedAt = submittedAt;
      if (resolvedCode) existing.finalCode = resolvedCode;
      if (histArr.length >= (existing.history?.length || 0)) existing.history = histArr;
    } else {
      if (!existing.finalCode && resolvedCode) existing.finalCode = resolvedCode;
      if (histArr.length > (existing.history?.length || 0)) existing.history = histArr;
    }
  }
}

export async function fetchSubmissionsAndEnrollment(assignment, classroom) {
  const submissionsMap = {};
  const cId = classroom?.id ?? 'default';
  const aId = assignment?.id ?? 'default';

  // 1. API submissions
  if (assignment?.id) {
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL}/submissions/${assignment.id}`);
      if (res.ok) {
        const data = await res.json();
        const subs = Array.isArray(data?.submissions) ? data.submissions : [];
        subs.forEach(s => {
          mergeIntoSubmissionsMap(
            submissionsMap,
            s.student_name || s.studentName || 'Student',
            s.student_email || s.studentEmail || '',
            s.submittedAt || s.submittedat || null,
            s.finalCode || null,
            s.history || []
          );
        });
      }
    } catch {}
  }

  // 2. Local storage client submissions
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(`verity_sub_${cId}_${aId}_`) || key.startsWith(`verity_sub_default_${aId}_`))) {
        const val = JSON.parse(localStorage.getItem(key));
        if (val && (val.studentName || val.studentId)) {
          const rawName = val.studentName || val.studentId;
          const normName = normalizeReplayStudentName(rawName, val.studentEmail || '');
          if (normName !== rawName) {
            try {
              localStorage.setItem(key, JSON.stringify({ ...val, studentName: normName }));
            } catch {}
          }
          mergeIntoSubmissionsMap(
            submissionsMap,
            normName,
            val.studentEmail || '',
            val.submittedAt || null,
            val.finalCode || null,
            val.codeHistory || val.history || []
          );
        }
      }
    }
  } catch {}

  // 3. Persistent playback history
  Object.keys(submissionsMap).forEach(key => {
    const s = submissionsMap[key];
    const hKeys = [
      `verity_history_${cId}_${aId}_${s.name}`,
      `verity_history_${aId}_${s.name}`
    ];
    for (const hk of hKeys) {
      try {
        const raw = localStorage.getItem(hk);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > (s.history?.length || 0)) {
            s.history = parsed;
          }
        }
      } catch {}
    }
  });

  // 4. Enrolled students count
  let enrolledCount = 0;
  if (classroom?.id) {
    const uniqueEnrolled = new Set();
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL}/classroom-students/${classroom.id}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.students)) {
          data.students.forEach(st => {
            if (st && st.name) uniqueEnrolled.add(st.name.toLowerCase());
          });
        }
      }
    } catch {}

    try {
      const localKey = `verity_classroom_enrollments_${classroom.id}`;
      const raw = localStorage.getItem(localKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach(st => {
            if (st && st.name) uniqueEnrolled.add(st.name.toLowerCase());
          });
        }
      }
    } catch {}

    enrolledCount = uniqueEnrolled.size;
  }

  const submissionList = Object.values(submissionsMap).sort((a, b) => {
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true });
  });

  return {
    submissionList,
    students: submissionList,
    enrolledCount
  };
}

export async function saveSingleStudentGrade(assignmentId, studentIdentifier, grade, feedback) {
  if (!assignmentId) return;
  const res = await apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignmentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: studentIdentifier, grade, feedback })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to save grade');
  }
}

export const saveGradeApi = saveSingleStudentGrade;

export async function deleteSingleStudentGrade(assignmentId, studentIdentifier) {
  if (!assignmentId) return;
  await apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignmentId}/${encodeURIComponent(studentIdentifier)}`, {
    method: 'DELETE'
  });
}

export const deleteGradeApi = deleteSingleStudentGrade;

export async function bulkSaveStudentGrades(assignmentId, payload) {
  if (!assignmentId || payload.length === 0) return;
  try {
    await apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignmentId}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grades: payload })
    });
  } catch {
    payload.forEach(p => {
      apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      }).catch(() => {});
    });
  }
}

export const bulkGradeApi = bulkSaveStudentGrades;
