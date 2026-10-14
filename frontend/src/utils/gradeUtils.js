/**
 * Utility helpers for robust student grade matching, lookup, and formatting.
 * Handles case-insensitivity, email vs name vs id asymmetry, and edge cases.
 */

export const getStudentGrade = (gradesMap, studentOrId) => {
  if (!gradesMap || typeof gradesMap !== 'object' || !studentOrId) return null;

  // Direct key lookup
  if (typeof studentOrId === 'string' && gradesMap[studentOrId]) {
    return gradesMap[studentOrId];
  }

  // Collect candidate strings
  const candidates = new Set();

  if (typeof studentOrId === 'string') {
    candidates.add(studentOrId.trim().toLowerCase());
  } else if (typeof studentOrId === 'object' && studentOrId !== null) {
    const rawKeys = [
      studentOrId.id,
      studentOrId.name,
      studentOrId.student_name,
      studentOrId.studentName,
      studentOrId.student_id,
      studentOrId.studentId,
      studentOrId.email,
      studentOrId.student_email,
      studentOrId.studentEmail
    ];
    rawKeys.forEach(k => {
      if (k != null && String(k).trim()) {
        candidates.add(String(k).trim().toLowerCase());
      }
    });
  }

  if (candidates.size === 0) return null;

  // 1. Direct match with candidate variations
  for (const candidate of candidates) {
    if (gradesMap[candidate]) return gradesMap[candidate];
  }

  // 2. Iterate keys of gradesMap with case-insensitive check
  for (const [key, val] of Object.entries(gradesMap)) {
    if (!key) continue;
    const keyLower = String(key).trim().toLowerCase();
    if (candidates.has(keyLower)) {
      return val;
    }
  }

  return null;
};

export const isStudentGraded = (gradesMap, studentOrId) => {
  const g = getStudentGrade(gradesMap, studentOrId);
  return !!(g && (g.gradedAt || g.graded_at || (g.grade !== undefined && g.grade !== null && g.grade !== '')));
};

export const formatGradeScore = (gradeObj, maxPoints = 100) => {
  if (!gradeObj || gradeObj.grade == null) return null;
  return `${gradeObj.grade}/${maxPoints}`;
};
