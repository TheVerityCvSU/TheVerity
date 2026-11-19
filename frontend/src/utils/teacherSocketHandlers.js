import { formatStudentName, toSentenceCase, normalizeReplayStudentName } from './teacherViewUtils';

export function createTeacherSocketHandlers({
  assignment,
  classroom,
  mode,
  setStudents,
  setSelectedStudentId,
  setSubmittedStudentNames,
  submittedStudentNamesRef,
  mergeWarningLogs,
  notifSettingsRef,
  setToast
}) {
  const checkSelection = (id) => id && setSelectedStudentId((prev) => (prev ? prev : id));

  const handleUpdateCode = (data) => {
    if (!data) return;
    if (data.assignmentId && assignment?.id && data.assignmentId !== 'none' && String(data.assignmentId) !== String(assignment.id)) return;
    if (data.classroomId && data.classroomId !== 'none' && classroom?.id && String(data.classroomId) !== String(classroom.id)) return;

    const studentId = String(data.studentId || data.id || data.name || '');
    const studentName = String(data.name || data.studentName || studentId || 'Student').trim();
    const studentIdLower = studentId.toLowerCase();
    const studentNameLower = studentName.toLowerCase();

    const incomingLogs = Array.isArray(data.logs) ? data.logs : [];
    if (incomingLogs.length > 0) mergeWarningLogs(incomingLogs);

    if (mode === 'live') {
      const isSub = data.status === 'Submitted' || Boolean(data.submitted) ||
        submittedStudentNamesRef.current.has(studentNameLower) || submittedStudentNamesRef.current.has(studentIdLower);

      if (isSub) {
        setStudents((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const [k, s] of Object.entries(next)) {
            const curId = String(s.id || s.studentId || '').trim().toLowerCase();
            const curName = String(s.name || s.studentName || '').trim().toLowerCase();
            const kStr = String(k).trim().toLowerCase();
            if (curId === studentIdLower || curName === studentNameLower || kStr === studentIdLower || kStr === studentNameLower) {
              delete next[k];
              changed = true;
            }
          }
          return changed ? next : prev;
        });
        return;
      }
    }

    setStudents((prev) => {
      const sKey = Object.keys(prev).find(
        (k) => prev[k].id === studentId || prev[k].studentId === studentId || prev[k].name === studentName || prev[k].name === studentId || (data.email && prev[k].email === data.email)
      ) || studentId || studentName;

      const existing = prev[sKey] || { id: studentId || studentName, studentId: studentId || studentName, name: studentName, code: '', logs: [], status: 'Live', isLive: true };
      const next = { ...prev };
      if (sKey !== studentId && sKey !== studentName && next[studentId]) delete next[studentId];

      const newHist = Array.isArray(existing.codeHistory) && existing.codeHistory.length > 0
        ? data.code !== undefined && existing.code !== data.code ? [...existing.codeHistory, { time: Date.now(), code: data.code }] : existing.codeHistory
        : [{ time: Date.now(), code: data.code || '' }];

      const map = new Map();
      [...incomingLogs, ...(Array.isArray(existing.logs) ? existing.logs : [])].forEach((l) => {
        if (!l) return;
        const k = `${l.id || ''}-${l.action || l.message || ''}-${l.time || ''}`;
        if (!map.has(k)) {
          map.set(k, {
            id: l.id || Date.now(), action: l.action || l.message || 'Violation', message: l.message || l.action || 'Violation',
            time: l.time || '', color: l.color || '#ef4444', studentName: l.studentName || studentName, studentId: l.studentId || studentId
          });
        }
      });

      next[sKey] = {
        ...existing, id: studentId || existing.id || studentName, studentId: studentId || existing.studentId || studentName,
        name: studentName, studentName, email: data.email || existing.email || '', avatar: data.avatar || existing.avatar || '',
        code: data.code !== undefined ? data.code : existing.code || '', codeHistory: newHist,
        logs: Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0)),
        status: data.status || (data.isLive === false ? 'Offline' : mode === 'live' ? 'Live' : existing.status || 'Live'),
        isLive: data.isLive !== undefined ? data.isLive : data.status === 'Offline' ? false : true, lastActive: Date.now()
      };
      return next;
    });
    checkSelection(studentId || studentName);
  };

  const handleReceiveAlert = (data) => {
    if (!data) return;
    const incomingAId = data.assignmentId || data.assignment_id;
    if (assignment?.id && incomingAId && incomingAId !== 'none' && incomingAId !== 'default' && String(incomingAId) !== String(assignment.id)) return;
    const incomingCId = data.classroomId || data.classroom_id;
    if (classroom?.id && incomingCId && incomingCId !== 'none' && incomingCId !== 'default' && String(incomingCId) !== String(classroom.id)) return;

    const studentId = String(data.studentId || data.id || data.name || '');
    const studentName = String(data.name || data.studentName || studentId || 'Student').trim();
    const actionText = data.action || data.message || 'Violation';
    const newLog = {
      id: data.id || Date.now(), action: actionText, message: data.message || actionText,
      time: data.time || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(),
      color: data.color || '#ef4444', studentName, studentId,
      assignmentId: incomingAId || assignment?.id, classroomId: incomingCId || classroom?.id
    };

    mergeWarningLogs([newLog]);

    if (mode === 'live') {
      const isSub = data.status === 'Submitted' || Boolean(data.submitted) ||
        submittedStudentNamesRef.current.has(studentName.toLowerCase()) || submittedStudentNamesRef.current.has(studentId.toLowerCase());
      if (isSub) return;
    }

    setStudents((prev) => {
      const sKey = Object.keys(prev).find(
        (k) => prev[k].id === studentId || prev[k].studentId === studentId || prev[k].name === studentName || prev[k].name === studentId || (data.email && prev[k].email === data.email)
      ) || studentId || studentName;

      const existing = prev[sKey] || { id: studentId || studentName, studentId: studentId || studentName, name: studentName, code: '', logs: [], status: 'Live', isLive: true };
      const next = { ...prev };
      if (sKey !== studentId && sKey !== studentName && next[studentId]) delete next[studentId];

      const existingLogs = Array.isArray(existing.logs) ? existing.logs : [];
      const isDup = existingLogs.some((l) => l.action === newLog.action && (l.time === newLog.time || Math.abs((l.id || 0) - newLog.id) < 1000));
      next[sKey] = {
        ...existing, id: studentId || existing.id || studentName, studentId: studentId || existing.studentId || studentName,
        name: studentName, studentName, logs: isDup ? existingLogs : [newLog, ...existingLogs],
        status: existing.status || 'Live', lastActive: Date.now()
      };
      return next;
    });
    checkSelection(studentId || studentName);

    const isCrash = Boolean(data.isCrash || (actionText && actionText.toLowerCase().includes('crash')) || (data.message && data.message.toLowerCase().includes('crash')));
    const actionLower = actionText.toLowerCase();
    const isExitTab = !isCrash && (actionLower.includes('alt') || actionLower.includes('tab') || actionLower.includes('blur') || actionLower.includes('exit'));
    const cleanAction = isCrash ? 'System crash' : isExitTab ? 'Alt tab' : toSentenceCase(actionText);

    setToast({ message: `Alert: ${formatStudentName(studentName)} - ${cleanAction}`, type: isCrash ? 'error' : 'warning', isAlert: true });
    setTimeout(() => setToast(null), 5000);

    // Sound alerts silenced to avoid disruptive beeps

  };

  const handleTerminalUpdate = (data) => {
    if (!data) return;
    const studentId = String(data.studentId || data.name || '');
    const studentName = String(data.name || data.studentName || studentId || 'Student').trim();
    setStudents((prev) => {
      const sKey = Object.keys(prev).find((k) => prev[k].id === studentId || prev[k].studentId === studentId || prev[k].name === studentName || prev[k].name === studentId) || studentId || studentName;
      const existing = prev[sKey] || { id: studentId || studentName, name: studentName, code: '', logs: [], status: 'Live', isLive: true };
      const next = { ...prev };
      if (sKey !== studentId && sKey !== studentName && next[studentId]) delete next[studentId];
      next[sKey] = { ...existing, terminal: data.output };
      return next;
    });
    checkSelection(studentId || studentName);
  };

  const handleStudentLeft = ({ studentId, studentName, assignmentId: leftAId, classroomId: leftCId }) => {
    if (leftAId && assignment?.id && leftAId !== 'none' && String(leftAId) !== String(assignment.id)) return;
    if (leftCId && leftCId !== 'none' && classroom?.id && String(leftCId) !== String(classroom.id)) return;
    const targetId = String(studentId || '');
    const targetName = String(studentName || '').trim().toLowerCase();

    setStudents((prev) => {
      const next = { ...prev };
      for (const [k, s] of Object.entries(next)) {
        const sId = String(s.id || s.studentId || '');
        const sName = String(s.name || s.studentName || '').trim().toLowerCase();
        const kStr = String(k).trim().toLowerCase();
        if ((targetId && (sId === targetId || k === targetId)) || (targetName && (sName === targetName || kStr === targetName))) delete next[k];
      }
      return next;
    });

    setSelectedStudentId((prev) => {
      const prevStr = String(prev || '').trim().toLowerCase();
      return prev === targetId || prevStr === targetName ? null : prev;
    });
  };

  const handleReceiveSubmission = (data) => {
    const rawName = String(data.studentName || data.studentId || '').trim();
    const sName = mode !== 'live' ? normalizeReplayStudentName(rawName, data.studentEmail || data.email) : rawName;
    const sId = String(data.studentId || data.studentName || '').trim();
    const sNameLower = sName.toLowerCase();
    const rawNameLower = rawName.toLowerCase();
    const targetId = sId.toLowerCase();

    setSubmittedStudentNames((prev) => {
      const next = new Set(prev);
      if (sNameLower) next.add(sNameLower);
      if (rawNameLower) next.add(rawNameLower);
      if (targetId) next.add(targetId);
      return next;
    });

    if (mode === 'live') {
      setStudents((prev) => {
        const next = { ...prev };
        for (const [k, s] of Object.entries(next)) {
          const curId = String(s.id || s.studentId || '').trim().toLowerCase();
          const curName = String(s.name || s.studentName || '').trim().toLowerCase();
          const kStr = String(k).trim().toLowerCase();
          if ((targetId && (curId === targetId || kStr === targetId)) || (sNameLower && (curName === sNameLower || kStr === sNameLower)) || (rawNameLower && (curName === rawNameLower || kStr === rawNameLower))) {
            delete next[k];
          }
        }
        return next;
      });
      setSelectedStudentId((prev) => {
        const prevStr = String(prev || '').trim().toLowerCase();
        return prevStr === targetId || prevStr === sNameLower || prevStr === rawNameLower ? null : prev;
      });
    } else {
      setStudents((prev) => {
        const next = { ...prev };
        if (rawName !== sName && next[rawName]) delete next[rawName];
        const sKey = Object.keys(next).find((k) => next[k].id === sId || next[k].name === sName || k === sName || k === sId || (rawName && (next[k].name === rawName || k === rawName))) || sName;
        const existing = next[sKey] || { id: sId, name: sName, code: '', logs: [] };
        return {
          ...next,
          [sKey]: {
            ...existing, id: sId, studentId: sId, name: sName, studentName: sName, status: 'Submitted', isLive: false,
            code: data.finalCode || data.code || existing.code, codeHistory: data.codeHistory || existing.codeHistory || []
          }
        };
      });
    }

    if (notifSettingsRef.current?.notifyOnSubmission) {
      const sFormatted = formatStudentName(data.studentName || data.studentId || 'A student');
      setToast({ message: `${sFormatted} submitted their exam.`, type: 'success' });
      setTimeout(() => setToast(null), 3500);
    }
  };

  const handleUnsubmitted = (data) => {
    if (!data) return;
    const sName = data.studentName || data.studentId;
    setStudents((prev) => {
      const sKey = Object.keys(prev).find((k) => prev[k].id === sName || prev[k].name === sName) || sName;
      if (!prev[sKey]) return prev;
      return { ...prev, [sKey]: { ...prev[sKey], status: 'Live' } };
    });
  };

  const handleLiveGradeUpdate = (data) => {
    if (!data || String(data.assignmentId) !== String(assignment?.id) || !data.studentId) return;
    const gradesKey = `verity_grades_${assignment.id}`;
    try {
      const current = JSON.parse(localStorage.getItem(gradesKey)) || {};
      current[data.studentId] = { grade: data.grade, feedback: data.feedback, gradedAt: data.gradedAt };
      localStorage.setItem(gradesKey, JSON.stringify(current));
    } catch {}
    setStudents((prev) => {
      const sKey = Object.keys(prev).find((k) => k === data.studentId || prev[k].id === data.studentId || prev[k].name === data.studentId) || data.studentId;
      if (!prev[sKey]) return prev;
      return { ...prev, [sKey]: { ...prev[sKey], status: 'Graded' } };
    });
  };

  return {
    handleUpdateCode,
    handleReceiveAlert,
    handleTerminalUpdate,
    handleStudentLeft,
    handleReceiveSubmission,
    handleUnsubmitted,
    handleLiveGradeUpdate
  };
}
