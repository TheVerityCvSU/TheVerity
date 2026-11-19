import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../data/api';
import { sanitizeAction, getLogColor } from '../utils/teacherViewUtils';

const isCognitivePause = (item) => {
  if (!item) return false;
  const str = `${item.action || ''} ${item.message || ''} ${item.warning || ''}`.toLowerCase();
  return str.includes('cognitive pause') || str.includes('inactivity');
};

export function useTeacherViewWarnings({ assignment, classroom, students, mode, selectedStudentId, activeStudent }) {
  // Persistent warning logs for this activity session
  const [sessionWarnings, setSessionWarnings] = useState(() => {
    if (!assignment?.id) return [];
    try {
      const key = `verity_session_warnings_${classroom?.id || 'all'}_${assignment.id}`;
      const cached = localStorage.getItem(key);
      const list = cached ? JSON.parse(cached) : [];
      if (Array.isArray(list)) {
        return list.filter((l) => {
          if (isCognitivePause(l)) return false;
          const aId = l.assignmentId || l.assignment_id;
          return !aId || aId === 'none' || String(aId) === String(assignment.id);
        });
      }
      return [];
    } catch {
      return [];
    }
  });

  // Re-hydrate session warnings whenever assignment changes
  useEffect(() => {
    if (!assignment?.id) {
      setSessionWarnings([]);
      return;
    }
    try {
      const key = `verity_session_warnings_${classroom?.id || 'all'}_${assignment.id}`;
      const cached = localStorage.getItem(key);
      const list = cached ? JSON.parse(cached) : [];
      if (Array.isArray(list)) {
        setSessionWarnings(
          list.filter((l) => {
            if (isCognitivePause(l)) return false;
            const aId = l.assignmentId || l.assignment_id;
            return !aId || aId === 'none' || String(aId) === String(assignment.id);
          })
        );
      } else {
        setSessionWarnings([]);
      }
    } catch {
      setSessionWarnings([]);
    }
  }, [assignment?.id, classroom?.id]);

  const mergeWarningLogs = useCallback(
    (incomingList) => {
      if (!Array.isArray(incomingList) || incomingList.length === 0) return;
      const curAId = assignment?.id != null ? String(assignment.id) : null;
      const curCId = classroom?.id && classroom.id !== 'none' ? String(classroom.id) : null;

      setSessionWarnings((prev) => {
        const map = new Map();
        [...incomingList, ...prev].forEach((l) => {
          if (!l || isCognitivePause(l)) return;
          const logAId = l.assignmentId || l.assignment_id;
          if (curAId && logAId && logAId !== 'none' && logAId !== 'default' && String(logAId) !== curAId) {
            return;
          }
          const logCId = l.classroomId || l.classroom_id;
          if (curCId && logCId && logCId !== 'none' && logCId !== 'default' && String(logCId) !== curCId) {
            return;
          }
          const sName = String(l.studentName || l.student_name || l.studentId || l.student_id || 'Student').trim();
          const sId = String(l.studentId || l.student_id || sName).trim();
          const act = l.action || l.message || 'Violation';
          const key = `${l.id || ''}-${sId}-${act}-${l.time || ''}`;
          if (!map.has(key)) {
            map.set(key, {
              id: l.id || Date.now(),
              action: act,
              message: l.message || act,
              time: l.time || '',
              color: l.color || '#ef4444',
              studentName: sName,
              studentId: sId,
              classroomId: logCId || curCId,
              assignmentId: logAId || curAId
            });
          }
        });
        const merged = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
        try {
          if (assignment?.id) {
            localStorage.setItem(
              `verity_session_warnings_${classroom?.id || 'all'}_${assignment.id}`,
              JSON.stringify(merged)
            );
          }
        } catch {}
        return merged;
      });
    },
    [assignment?.id, classroom?.id]
  );

  // Load session proctor warning logs from backend
  useEffect(() => {
    if (!assignment?.id) return;
    const cId = classroom?.id && classroom.id !== 'none' ? `?classroomId=${classroom.id}` : '';
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/proctor-logs/${assignment.id}${cId}`)
      .then((res) => (res.ok ? res.json() : { logs: [] }))
      .then((data) => {
        if (Array.isArray(data?.logs) && data.logs.length > 0) {
          mergeWarningLogs(data.logs);
        }
      })
      .catch(() => {});
  }, [assignment?.id, classroom?.id, mergeWarningLogs]);

  // Aggregate and memoize all logs
  const allLogs = useMemo(() => {
    const logs = [];
    const seenMap = new Map();

    const addLog = (rawLog, fallbackName, fallbackId) => {
      if (!rawLog || isCognitivePause(rawLog)) return;
      const sName = String(rawLog.studentName || rawLog.student_name || fallbackName || 'Student').trim();
      const sId = String(rawLog.studentId || rawLog.student_id || fallbackId || sName).trim();
      const rawAction = rawLog.action || rawLog.message || 'Violation';
      const sanitizedAction = sanitizeAction(rawAction);
      const dedupeKey = `${rawLog.id || ''}-${sName}-${sanitizedAction}-${rawLog.time || ''}`;
      if (seenMap.has(dedupeKey)) return;

      const logItem = {
        ...rawLog,
        id: rawLog.id || Date.now(),
        studentName: sName,
        studentId: sId,
        action: sanitizedAction,
        message: sanitizeAction(rawLog.message || rawAction),
        color: rawLog.color || getLogColor(sanitizedAction),
        time: rawLog.time || ''
      };
      seenMap.set(dedupeKey, logItem);
      logs.push(logItem);
    };

    const curAId = assignment?.id != null ? String(assignment.id) : null;

    if (Array.isArray(sessionWarnings)) {
      sessionWarnings.forEach((w) => {
        const wAId = w?.assignmentId || w?.assignment_id;
        if (curAId && wAId && wAId !== 'none' && wAId !== 'default' && String(wAId) !== curAId) return;
        addLog(w);
      });
    }

    Object.values(students).forEach((student) => {
      if (mode === 'playback' && student.id !== selectedStudentId && student.name !== selectedStudentId) return;

      const sAId = student.assignmentId || student.assignment_id;
      if (curAId && sAId && sAId !== 'none' && sAId !== 'default' && String(sAId) !== curAId) return;

      if (Array.isArray(student.logs)) {
        student.logs.forEach((log) => {
          const lAId = log?.assignmentId || log?.assignment_id;
          if (curAId && lAId && lAId !== 'none' && lAId !== 'default' && String(lAId) !== curAId) return;
          addLog(log, student.name, student.id);
        });
      }

      const hist = student.codeHistory || student.history || [];
      if (Array.isArray(hist)) {
        hist.forEach((h) => {
          if (h && h.warning && !isCognitivePause(h)) {
            const hAId = h.assignmentId || h.assignment_id;
            if (curAId && hAId && hAId !== 'none' && hAId !== 'default' && String(hAId) !== curAId) return;
            const sanitizedWarning = sanitizeAction(h.warning);
            addLog(
              {
                id: h.time || Date.now(),
                message: sanitizedWarning,
                action: sanitizedWarning,
                time: new Date(h.time)
                  .toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })
                  .toLowerCase(),
                color: getLogColor(sanitizedWarning),
                studentName: student.name,
                studentId: student.id,
                assignmentId: curAId
              },
              student.name,
              student.id
            );
          }
        });
      }
    });

    return logs.sort((a, b) => (b.id || 0) - (a.id || 0));
  }, [students, sessionWarnings, mode, selectedStudentId, assignment?.id]);

  const activeStudentWarnings = useMemo(() => {
    if (!activeStudent || (!activeStudent.id && !activeStudent.name)) return [];
    const aId = String(activeStudent.id || '');
    const aName = String(activeStudent.name || activeStudent.studentName || '');
    return allLogs.filter(
      (l) =>
        (aId && l.studentId === aId) ||
        (aName && l.studentName === aName) ||
        (aName && l.studentId === aName) ||
        (aId && l.studentName === aId)
    );
  }, [allLogs, activeStudent]);

  return {
    sessionWarnings,
    setSessionWarnings,
    mergeWarningLogs,
    allLogs,
    activeStudentWarnings
  };
}
