import { useState, useRef, useCallback, useEffect } from 'react';
import { apiFetch } from '../data/api';

export function useStudentViewProctorLogs({
  assignment,
  classroom,
  assignmentId,
  classroomId,
  studentActualId,
  safeUsername,
  submitted,
  currentUser,
  codeRef,
  codeHistoryRef,
  persistHistoryFn,
  emitToSockets
}) {
  const [proctorLogs, setProctorLogs] = useState(() => {
    try {
      const aId = assignment?.id != null ? String(assignment.id) : assignmentId && assignmentId !== 'none' ? String(assignmentId) : null;
      if (!aId || aId === 'none' || aId === 'default' || aId === 'undefined') return [];
      const cId = classroom?.id != null ? String(classroom.id) : classroomId || 'none';
      const sId = studentActualId || 'student';
      const keys = [
        `verity_proctor_logs_${cId}_${aId}_${sId}`,
        sId !== safeUsername ? `verity_proctor_logs_${cId}_${aId}_${safeUsername}` : null,
        cId !== 'none' ? `verity_proctor_logs_none_${aId}_${sId}` : null
      ].filter(Boolean);
      for (const k of keys) {
        const saved = localStorage.getItem(k);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((l) => {
              const matchAssignment = !l.assignmentId || String(l.assignmentId) === aId;
              const act = `${l?.action || ''} ${l?.message || ''}`.toLowerCase();
              return matchAssignment && !act.includes('cognitive pause') && !act.includes('inactivity');
            });
          }
        }
      }
    } catch {}
    return [];
  });
  const proctorLogsRef = useRef(proctorLogs);
  useEffect(() => {
    proctorLogsRef.current = proctorLogs;
  }, [proctorLogs]);

  const addProctorLog = useCallback(
    (message, color = '#ef4444', customDesc = null, isCrash = false) => {
      if (submitted) return;
      const actionStr = (message || '').toLowerCase();
      if (actionStr.includes('cognitive pause') || actionStr.includes('inactivity')) return;
      const nowMs = Date.now();
      const timeString = new Date(nowMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
      const detectedCrash = isCrash || actionStr.includes('crash');
      const logColor = detectedCrash ? '#dc2626' : color;
      const actionLabel = detectedCrash ? 'System Crash' : message;

      const cId = classroom?.id != null ? String(classroom.id) : classroomId || 'none';
      const aId = assignment?.id != null ? String(assignment.id) : assignmentId && assignmentId !== 'none' ? String(assignmentId) : 'none';
      const sId = studentActualId || 'student';

      const newLogItem = {
        id: nowMs,
        timestamp: nowMs,
        message: actionLabel,
        action: actionLabel,
        time: timeString,
        color: logColor,
        isCrash: detectedCrash,
        assignmentId: aId,
        classroomId: cId
      };

      setProctorLogs((prevLogs) => {
        const filteredPrev = prevLogs.filter((l) => !l.assignmentId || String(l.assignmentId) === aId);
        const updated = [newLogItem, ...filteredPrev];
        try {
          if (aId && aId !== 'none' && aId !== 'default' && aId !== 'undefined') {
            localStorage.setItem(`verity_proctor_logs_${cId}_${aId}_${sId}`, JSON.stringify(updated));
            if (sId !== safeUsername) localStorage.setItem(`verity_proctor_logs_${cId}_${aId}_${safeUsername}`, JSON.stringify(updated));
            if (cId && cId !== 'none') localStorage.setItem(`verity_proctor_logs_none_${aId}_${sId}`, JSON.stringify(updated));
          }
        } catch {}
        return updated;
      });

      const updatedHistory = [...(codeHistoryRef.current || []), { time: nowMs, warning: actionLabel, code: codeRef.current }];
      persistHistoryFn(updatedHistory, codeRef.current);

      emitToSockets('proctor_alert', {
        id: newLogItem.id,
        timestamp: nowMs,
        studentId: sId,
        name: safeUsername,
        studentName: safeUsername,
        email: currentUser?.email || '',
        action: actionLabel,
        message: actionLabel,
        desc: customDesc || `${actionLabel} in ${assignment?.title || 'workspace'} (classroom ${cId})`,
        time: timeString,
        color: logColor,
        isCrash: detectedCrash,
        classroomId: cId,
        assignmentId: aId
      });

      const isCopyPaste = !detectedCrash && (actionStr.includes('paste') || actionStr.includes('clipboard') || actionStr.includes('copy'));
      const logType = detectedCrash ? 'System Crash Violation' : isCopyPaste ? 'Copy/Paste Violation' : 'Exit Tab Violation';
      const logSeverity = detectedCrash || isCopyPaste ? 'High' : 'Warning';

      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser?.name || currentUser?.email || safeUsername,
          type: logType,
          severity: logSeverity,
          desc: customDesc || `${actionLabel} in ${assignment?.title || 'workspace'} (classroom ${cId})`
        })
      }).catch(() => {});
    },
    [submitted, classroom, classroomId, assignment, assignmentId, studentActualId, safeUsername, currentUser, codeRef, codeHistoryRef, persistHistoryFn, emitToSockets]
  );

  return {
    proctorLogs,
    setProctorLogs,
    proctorLogsRef,
    addProctorLog
  };
}
