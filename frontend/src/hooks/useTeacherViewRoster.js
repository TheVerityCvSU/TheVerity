import { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../data/api';
import { normalizeReplayStudentName } from '../utils/teacherViewUtils';
import { isStudentGraded } from '../utils/gradeUtils';
import { getInitialStudentRoster, findLongestLocalHistory, extractSubmissionsFromStorage } from '../utils/teacherRosterUtils';

export function useTeacherViewRoster({ assignment, classroom, initialStudent, mode, studentSearch }) {
  const [submittedStudentNames, setSubmittedStudentNames] = useState(() => new Set());
  const submittedStudentNamesRef = useRef(submittedStudentNames);
  useEffect(() => {
    submittedStudentNamesRef.current = submittedStudentNames;
  }, [submittedStudentNames]);

  const [students, setStudents] = useState(() => getInitialStudentRoster(initialStudent, mode));

  const [selectedStudentId, setSelectedStudentId] = useState(() => {
    if (!initialStudent || (!initialStudent.id && !initialStudent.name)) return null;
    return mode !== 'live'
      ? normalizeReplayStudentName(initialStudent.name || initialStudent.id, initialStudent.email)
      : initialStudent.id || initialStudent.name || null;
  });

  // Fetch submissions from backend and localStorage
  useEffect(() => {
    if (!assignment?.id) return;
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${assignment.id}`)
      .then((res) => res.json())
      .then((data) => {
        const subs = Array.isArray(data?.submissions) ? data.submissions : [];
        const newSubmittedSet = extractSubmissionsFromStorage(classroom, assignment);
        subs.forEach((s) => {
          const sName = String(s.student_name || s.studentName || '').trim().toLowerCase();
          const sId = String(s.student_id || s.studentId || '').trim().toLowerCase();
          if (sName) newSubmittedSet.add(sName);
          if (sId) newSubmittedSet.add(sId);
        });

        setSubmittedStudentNames(newSubmittedSet);

        if (mode === 'live') {
          setStudents((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const [k, s] of Object.entries(next)) {
              const curName = String(s.name || s.studentName || '').trim().toLowerCase();
              const curId = String(s.id || s.studentId || '').trim().toLowerCase();
              const kStr = String(k).trim().toLowerCase();
              if (newSubmittedSet.has(curName) || newSubmittedSet.has(curId) || newSubmittedSet.has(kStr) || s.status === 'Submitted') {
                delete next[k];
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        } else {
          setStudents((prev) => {
            const next = { ...prev };
            subs.forEach((s) => {
              const rawName = s.student_name || s.studentName || 'Unknown';
              const sName = normalizeReplayStudentName(rawName, s.student_email || s.studentEmail);
              if (rawName !== sName && next[rawName]) delete next[rawName];
              const hist = Array.isArray(s.history) ? s.history : [];
              const finalCode = s.finalCode || (hist.length > 0 ? hist[hist.length - 1]?.code : '') || '';
              const existing = next[sName] || {};
              const combinedHist = hist.length > (existing.codeHistory?.length || 0) ? hist : existing.codeHistory || [{ time: Date.now(), code: finalCode }];
              next[sName] = {
                ...existing, id: sName, name: sName, status: 'Submitted', isLive: false,
                code: finalCode || existing.code || '', codeHistory: combinedHist, logs: existing.logs || []
              };
            });
            return next;
          });
        }
      })
      .catch(() => {});
  }, [assignment, classroom, mode]);

  const initialStudentKey = initialStudent && (initialStudent.id || initialStudent.name)
    ? `${initialStudent.id || ''}|${initialStudent.name || ''}|${classroom?.id || ''}|${assignment?.id || ''}|${mode}`
    : '';
  const [prevInitialStudentKey, setPrevInitialStudentKey] = useState(initialStudentKey);

  if (initialStudentKey && initialStudentKey !== prevInitialStudentKey) {
    setPrevInitialStudentKey(initialStudentKey);
    const rawId = initialStudent.id || initialStudent.name;
    const sId = mode !== 'live' ? normalizeReplayStudentName(initialStudent.name || rawId, initialStudent.email) : rawId;
    setSelectedStudentId(sId);
    const hist = findLongestLocalHistory(classroom, assignment, sId, initialStudent.name,
      Array.isArray(initialStudent.history) && initialStudent.history.length > 0 ? initialStudent.history
        : Array.isArray(initialStudent.codeHistory) && initialStudent.codeHistory.length > 0 ? initialStudent.codeHistory
        : initialStudent.finalCode ? [{ time: 0, code: initialStudent.finalCode }] : []);

    setStudents((prev) => {
      const next = { ...prev };
      if (rawId !== sId && next[rawId]) delete next[rawId];
      const existing = next[sId] || {};
      const longerHist = Array.isArray(existing.codeHistory) && existing.codeHistory.length > hist.length ? existing.codeHistory
        : hist.length > 0 ? hist : [{ time: 0, code: initialStudent.finalCode || '' }];

      return {
        ...next,
        [sId]: {
          ...existing, id: sId, name: mode !== 'live' ? sId : initialStudent.name || sId,
          status: 'Submitted', code: initialStudent.finalCode || initialStudent.code || (longerHist.length > 0 ? longerHist[longerHist.length - 1]?.code : '') || '',
          codeHistory: longerHist, logs: initialStudent.logs || existing.logs || []
        }
      };
    });
  }

  // Keep selection valid as derived value instead of mutating inside useEffect
  const resolvedSelectedStudentId = useMemo(() => {
    if (mode === 'live') {
      const liveKeys = Object.keys(students).filter((k) => {
        const s = students[k];
        if (!s || s.isLive === false || s.status === 'Offline' || s.status === 'Submitted') return false;
        const sNameLower = String(s.name || s.studentName || '').trim().toLowerCase();
        const sIdLower = String(s.id || s.studentId || '').trim().toLowerCase();
        const kLower = String(k).trim().toLowerCase();
        return !submittedStudentNames.has(sNameLower) && !submittedStudentNames.has(sIdLower) && !submittedStudentNames.has(kLower);
      });
      if (liveKeys.length === 0) return null;
      const currentStudent = students[selectedStudentId];
      const curName = String(currentStudent?.name || currentStudent?.studentName || '').trim().toLowerCase();
      const curId = String(currentStudent?.id || currentStudent?.studentId || selectedStudentId || '').trim().toLowerCase();
      const isCurrentValid = currentStudent && currentStudent.status === 'Live' && !submittedStudentNames.has(curName) && !submittedStudentNames.has(curId);
      return isCurrentValid ? selectedStudentId : liveKeys[0];
    }
    const validKeys = Object.keys(students).filter(
      (k) => students[k] && (students[k].status === 'Submitted' || students[k].status === 'Graded' || (Array.isArray(students[k].codeHistory) && students[k].codeHistory.length > 0) || Boolean(students[k].code || students[k].finalCode))
    );
    if (validKeys.length > 0 && (!selectedStudentId || !students[selectedStudentId])) {
      return validKeys[0];
    }
    return selectedStudentId;
  }, [students, selectedStudentId, mode, submittedStudentNames]);

  // Load backend grades
  useEffect(() => {
    if (!assignment?.id) return;
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/grades/${assignment.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.grades) {
          const gradesKey = `verity_grades_${assignment.id}`;
          let merged = {};
          try {
            const current = JSON.parse(localStorage.getItem(gradesKey)) || {};
            merged = { ...current, ...data.grades };
            localStorage.setItem(gradesKey, JSON.stringify(merged));
          } catch {}

          setStudents((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((k) => {
              if (isStudentGraded(merged, next[k])) next[k] = { ...next[k], status: 'Graded' };
            });
            return next;
          });
        }
      })
      .catch(() => {});
  }, [assignment?.id]);

  const activeStudent = useMemo(() => {
    let s = students[resolvedSelectedStudentId] || Object.values(students).find((st) => st.id === resolvedSelectedStudentId || st.studentId === resolvedSelectedStudentId || st.name === resolvedSelectedStudentId);
    if (mode === 'live' && s) {
      const sNameLower = String(s.name || s.studentName || '').trim().toLowerCase();
      const sIdLower = String(s.id || s.studentId || '').trim().toLowerCase();
      if (submittedStudentNames.has(sNameLower) || submittedStudentNames.has(sIdLower) || s.status === 'Submitted') s = null;
    }
    return s || { name: mode === 'live' ? 'Waiting for students...' : 'Select a student submission', code: mode === 'live' ? '// No student currently live' : '// Select a student to replay their session', logs: [] };
  }, [students, resolvedSelectedStudentId, mode, submittedStudentNames]);

  const visibleStudents = useMemo(() => {
    let list = Object.values(students);
    if (mode === 'live') {
      list = list.filter((s) => {
        if (!s) return false;
        const sNameLower = String(s.name || s.studentName || '').trim().toLowerCase();
        const sIdLower = String(s.id || s.studentId || '').trim().toLowerCase();
        return !submittedStudentNames.has(sNameLower) && !submittedStudentNames.has(sIdLower) && s.isLive !== false && s.status === 'Live' && s.status !== 'Submitted' && s.status !== 'Offline';
      });
    } else {
      list = list.filter((s) => s && (s.status === 'Submitted' || s.status === 'Graded' || (Array.isArray(s.codeHistory) && s.codeHistory.length > 0) || Boolean(s.code || s.finalCode)));
    }
    if (!studentSearch.trim()) return list;
    const q = studentSearch.toLowerCase();
    return list.filter((s) => String(s.name || s.studentName || s.id || '').toLowerCase().includes(q));
  }, [students, studentSearch, mode, submittedStudentNames]);

  const liveStudentCount = useMemo(() => {
    return Object.values(students).filter((s) => {
      if (!s) return false;
      const sNameLower = String(s.name || s.studentName || '').trim().toLowerCase();
      const sIdLower = String(s.id || s.studentId || '').trim().toLowerCase();
      return !submittedStudentNames.has(sNameLower) && !submittedStudentNames.has(sIdLower) && s.isLive !== false && s.status === 'Live' && s.status !== 'Submitted' && s.status !== 'Offline';
    }).length;
  }, [students, submittedStudentNames]);

  return {
    students, setStudents, selectedStudentId: resolvedSelectedStudentId, setSelectedStudentId,
    submittedStudentNames, setSubmittedStudentNames, submittedStudentNamesRef,
    activeStudent, visibleStudents, liveStudentCount
  };
}
