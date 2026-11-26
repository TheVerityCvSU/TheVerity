import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../data/api';
import {
  sanitizeAction,
  getLogColor,
  computeCumulativeTimes,
  resolveWarningPlaybackInfo,
  formatExactClockTime
} from '../utils/teacherViewUtils';

const isCognitivePause = (item) => {
  if (!item) return false;
  const str = `${item.action || ''} ${item.message || ''} ${item.warning || ''}`.toLowerCase();
  return str.includes('cognitive pause') || str.includes('inactivity');
};

export function useTeacherViewWarnings({ assignment, classroom, students, activeStudent }) {
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

  const warnCacheKey = `${classroom?.id || 'all'}|${assignment?.id || ''}`;
  const [prevWarnCacheKey, setPrevWarnCacheKey] = useState(warnCacheKey);

  // Re-hydrate session warnings whenever assignment changes
  if (warnCacheKey !== prevWarnCacheKey) {
    setPrevWarnCacheKey(warnCacheKey);
    if (!assignment?.id) {
      setSessionWarnings([]);
    } else {
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
    }
  }

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
    [assignment, classroom]
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
  const curAId = assignment?.id != null ? String(assignment.id) : null;
  const allLogs = useMemo(() => {
    const logs = [];
    const seenMap = new Map();

    // Precompute student histories & cumulative times by student key
    const studentTimelines = new Map();
    Object.values(students).forEach((st) => {
      if (!st) return;
      const hist = Array.isArray(st.codeHistory) && st.codeHistory.length > 0
        ? st.codeHistory
        : Array.isArray(st.history) && st.history.length > 0
        ? st.history
        : [];
      if (hist.length > 0) {
        const cumTimes = computeCumulativeTimes(hist);
        const entry = { history: hist, cumulativeTimes: cumTimes };
        if (st.id) studentTimelines.set(String(st.id).trim().toLowerCase(), entry);
        if (st.name) studentTimelines.set(String(st.name).trim().toLowerCase(), entry);
      }
    });

    const getStudentTimeline = (sId, sName) => {
      return (
        studentTimelines.get(String(sId || '').trim().toLowerCase()) ||
        studentTimelines.get(String(sName || '').trim().toLowerCase()) ||
        null
      );
    };

    const addLog = (rawLog, fallbackName, fallbackId) => {
      if (!rawLog || isCognitivePause(rawLog)) return;
      const sName = String(rawLog.studentName || rawLog.student_name || fallbackName || 'Student').trim();
      const sId = String(rawLog.studentId || rawLog.student_id || fallbackId || sName).trim();
      const rawAction = rawLog.action || rawLog.message || 'Violation';
      const sanitizedAction = sanitizeAction(rawAction);

      const timeline = getStudentTimeline(sId, sName);
      const playbackInfo = resolveWarningPlaybackInfo(
        rawLog,
        sanitizedAction,
        timeline?.history || null,
        timeline?.cumulativeTimes || null
      );

      // Deduplicate by student + action + historyIndex (when matched to a history step) or id+time
      const studentKey = sName.toLowerCase();
      const histDedupeKey =
        playbackInfo.historyIndex != null
          ? `hist-${studentKey}-${sanitizedAction}-${playbackInfo.historyIndex}`
          : null;
      const fallbackDedupeKey = `${rawLog.id || ''}-${studentKey}-${sanitizedAction}-${rawLog.time || ''}`;

      if ((histDedupeKey && seenMap.has(histDedupeKey)) || seenMap.has(fallbackDedupeKey)) {
        const existing = (histDedupeKey && seenMap.get(histDedupeKey)) || seenMap.get(fallbackDedupeKey);
        if (existing) {
          if (!existing.epochMs && playbackInfo.epochMs) existing.epochMs = playbackInfo.epochMs;
          if ((!existing.exactTime || existing.exactTime.length < (playbackInfo.exactTime || '').length) && playbackInfo.exactTime) {
            existing.exactTime = playbackInfo.exactTime;
          }
          if (existing.playbackTimeMs == null && playbackInfo.playbackTimeMs != null) {
            existing.playbackTimeMs = playbackInfo.playbackTimeMs;
            existing.playbackTimeFormatted = playbackInfo.playbackTimeFormatted;
            existing.historyIndex = playbackInfo.historyIndex;
          }
        }
        return;
      }

      const exactClock = playbackInfo.exactTime || formatExactClockTime(rawLog.timestamp || rawLog.id, rawLog.time);

      const logItem = {
        ...rawLog,
        id: rawLog.id || playbackInfo.epochMs || `${sId}-${fallbackDedupeKey}`,
        epochMs: playbackInfo.epochMs || null,
        studentName: sName,
        studentId: sId,
        action: sanitizedAction,
        message: sanitizeAction(rawLog.message || rawAction),
        color: rawLog.color || getLogColor(sanitizedAction),
        time: exactClock || rawLog.time || '',
        exactTime: exactClock || rawLog.time || '',
        historyIndex: playbackInfo.historyIndex,
        playbackTimeMs: playbackInfo.playbackTimeMs,
        playbackTimeFormatted: playbackInfo.playbackTimeFormatted
      };

      if (histDedupeKey) seenMap.set(histDedupeKey, logItem);
      seenMap.set(fallbackDedupeKey, logItem);
      logs.push(logItem);
    };

    // 1. Process history warnings first (they have exact epoch ms and keystroke index)
    Object.values(students).forEach((student) => {
      const sAId = student.assignmentId || student.assignment_id;
      if (curAId && sAId && sAId !== 'none' && sAId !== 'default' && String(sAId) !== curAId) return;

      const hist = student.codeHistory || student.history || [];
      if (Array.isArray(hist)) {
        hist.forEach((h, hIdx) => {
          if (h && h.warning && !isCognitivePause(h)) {
            const hAId = h.assignmentId || h.assignment_id;
            if (curAId && hAId && hAId !== 'none' && hAId !== 'default' && String(hAId) !== curAId) return;
            const sanitizedWarning = sanitizeAction(h.warning);
            addLog(
              {
                id: h.time || `${student.id || student.name}-hist-${hIdx}`,
                timestamp: h.time,
                historyIndex: hIdx,
                message: sanitizedWarning,
                action: sanitizedWarning,
                time: formatExactClockTime(h.time),
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

      if (Array.isArray(student.logs)) {
        student.logs.forEach((log) => {
          const lAId = log?.assignmentId || log?.assignment_id;
          if (curAId && lAId && lAId !== 'none' && lAId !== 'default' && String(lAId) !== curAId) return;
          addLog(log, student.name, student.id);
        });
      }
    });

    // 2. Process session warnings
    if (Array.isArray(sessionWarnings)) {
      sessionWarnings.forEach((w) => {
        const wAId = w?.assignmentId || w?.assignment_id;
        if (curAId && wAId && wAId !== 'none' && wAId !== 'default' && String(wAId) !== curAId) return;
        addLog(w);
      });
    }

    return logs.sort((a, b) => {
      const tA = a.epochMs || a.playbackTimeMs || (typeof a.id === 'number' ? a.id : 0);
      const tB = b.epochMs || b.playbackTimeMs || (typeof b.id === 'number' ? b.id : 0);
      return tB - tA;
    });
  }, [students, sessionWarnings, curAId]);

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
