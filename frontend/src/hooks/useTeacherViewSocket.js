import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { apiFetch, getCloudUrl, getLocalApiUrl, getConnectionStatus } from '../data/api';
import { createTeacherSocketHandlers } from '../utils/teacherSocketHandlers';

export function useTeacherViewSocket({
  socket,
  currentUser,
  assignment,
  classroom,
  mode,
  setStudents,
  setSelectedStudentId,
  setSubmittedStudentNames,
  submittedStudentNamesRef,
  mergeWarningLogs,
  activeStudent
}) {
  const [evalOutput, setEvalOutput] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [toast, setToast] = useState(null);

  const [notifSettings, setNotifSettings] = useState({
    soundAlerts: false,
    notifyOnSubmission: true,
    showToastWarnings: false
  });
  const notifSettingsRef = useRef(notifSettings);
  useEffect(() => {
    notifSettingsRef.current = notifSettings;
  }, [notifSettings]);

  // Load notification settings (initial + live Socket.IO updates)
  useEffect(() => {
    let isMounted = true;
    const applyNotifs = (settingsObj) => {
      if (!isMounted || !settingsObj) return;
      const config = settingsObj.global_config || settingsObj;
      if (config?.notifications) {
        setNotifSettings((prev) => ({ ...prev, ...config.notifications }));
      }
    };

    const loadNotifs = () => {
      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`)
        .then((res) => (res.ok ? res.json() : {}))
        .then((d) => {
          if (d?.settings) applyNotifs(d.settings);
        })
        .catch(() => {});
    };

    loadNotifs();
    const handleSettingsUpdate = (payload) => {
      if (payload?.settings) applyNotifs(payload.settings);
      else loadNotifs();
    };
    if (socket) socket.on('system_settings_updated', handleSettingsUpdate);

    return () => {
      isMounted = false;
      if (socket) socket.off('system_settings_updated', handleSettingsUpdate);
    };
  }, [socket]);

  // Broadcast assignment instruction on socket
  const assignmentInstruction = assignment?.details || '';
  useEffect(() => {
    if (assignmentInstruction && socket) {
      socket.emit('set_instruction', assignmentInstruction);
    }
  }, [socket, assignmentInstruction]);

  // Listen to compiler evaluation output
  useEffect(() => {
    if (!socket) return;
    const onOut = (chunk) => setEvalOutput((prev) => prev + chunk);
    const onExit = () => setEvaluating(false);
    socket.on('terminal_output', onOut);
    socket.on('process_exit', onExit);
    return () => {
      socket.off('terminal_output', onOut);
      socket.off('process_exit', onExit);
    };
  }, [socket]);

  // Dual-bridge socket & real-time monitoring events
  useEffect(() => {
    if (!socket) return;

    let secondarySocket = null;
    try {
      const conn = getConnectionStatus();
      const localUrl = getLocalApiUrl();
      const cloudUrl = getCloudUrl();
      const primaryUri = socket?.io?.uri || '';

      let altTarget = null;
      if (primaryUri.includes('localhost') || primaryUri.includes('127.0.0.1') || primaryUri.includes('192.168.')) {
        if (conn.isOnline && cloudUrl && !cloudUrl.includes('localhost') && !cloudUrl.includes('127.0.0.1')) {
          altTarget = cloudUrl;
        }
      } else {
        if (!conn.isWebHosted && localUrl && !localUrl.includes('verity-2z4v')) {
          altTarget = localUrl;
        }
      }

      if (altTarget && altTarget !== primaryUri) {
        secondarySocket = io(altTarget, {
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1500,
          timeout: 5000,
          transports: ['websocket', 'polling'],
          auth: (cb) => {
            const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
            cb({ token });
          }
        });
      }
    } catch (_) {}

    const handlers = createTeacherSocketHandlers({
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
    });

    const handlePastWarnings = (pastLogs) => {
      if (Array.isArray(pastLogs) && pastLogs.length > 0) {
        const curAId = assignment?.id ? String(assignment.id) : null;
        const filtered = curAId
          ? pastLogs.filter((l) => {
              const lAId = l.assignmentId || l.assignment_id;
              return !lAId || String(lAId) === curAId;
            })
          : pastLogs;
        mergeWarningLogs(filtered);
      }
    };

    const bindSocket = (targetSock) => {
      if (!targetSock) return () => {};
      const joinRoom = () => {
        if (mode === 'live') {
          const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
          targetSock.emit('teacher_join', { classroomId: classroom?.id, assignmentId: assignment?.id, token, user: currentUser });
          targetSock.emit('teacher_request_sync', { classroomId: classroom?.id, assignmentId: assignment?.id });
        }
      };

      targetSock.on('connect', joinRoom);
      if (targetSock.connected) joinRoom();

      targetSock.on('teacher_past_warnings', handlePastWarnings);
      if (mode === 'live') {
        targetSock.on('teacher_update_code', handlers.handleUpdateCode);
        targetSock.on('teacher_receive_alert', handlers.handleReceiveAlert);
        targetSock.on('teacher_terminal_update', handlers.handleTerminalUpdate);
        targetSock.on('teacher_student_left', handlers.handleStudentLeft);
      }
      targetSock.on('teacher_receive_submission', handlers.handleReceiveSubmission);
      targetSock.on('teacher_student_unsubmitted', handlers.handleUnsubmitted);
      targetSock.on('student_unsubmitted', handlers.handleUnsubmitted);
      targetSock.on('grade_updated', handlers.handleLiveGradeUpdate);

      return () => {
        targetSock.off('connect', joinRoom);
        targetSock.off('teacher_past_warnings', handlePastWarnings);
        if (mode === 'live') {
          targetSock.off('teacher_update_code', handlers.handleUpdateCode);
          targetSock.off('teacher_receive_alert', handlers.handleReceiveAlert);
          targetSock.off('teacher_terminal_update', handlers.handleTerminalUpdate);
          targetSock.off('teacher_student_left', handlers.handleStudentLeft);
        }
        targetSock.off('teacher_receive_submission', handlers.handleReceiveSubmission);
        targetSock.off('teacher_student_unsubmitted', handlers.handleUnsubmitted);
        targetSock.off('student_unsubmitted', handlers.handleUnsubmitted);
        targetSock.off('grade_updated', handlers.handleLiveGradeUpdate);
        try {
          targetSock.emit('teacher_leave', { classroomId: classroom?.id, assignmentId: assignment?.id });
        } catch (_) {}
      };
    };

    const unbindPrimary = bindSocket(socket);
    const unbindSecondary = secondarySocket ? bindSocket(secondarySocket) : null;

    let syncInterval = null;
    if (mode === 'live') {
      syncInterval = setInterval(() => {
        if (socket?.connected) socket.emit('teacher_request_sync', { classroomId: classroom?.id, assignmentId: assignment?.id });
        if (secondarySocket?.connected) secondarySocket.emit('teacher_request_sync', { classroomId: classroom?.id, assignmentId: assignment?.id });
      }, 4000);
    }

    return () => {
      if (syncInterval) clearInterval(syncInterval);
      if (unbindPrimary) unbindPrimary();
      if (unbindSecondary) unbindSecondary();
      if (secondarySocket) {
        try { secondarySocket.disconnect(); } catch (_) {}
      }
    };
  }, [socket, mode, classroom?.id, assignment?.id, currentUser]);

  const handleEvaluate = () => {
    if (evaluating || !socket) return;
    setEvalOutput('');
    setEvaluating(true);
    socket.emit('compile_code', { code: activeStudent?.code });
  };

  const handleStopCode = () => {
    if (socket) socket.emit('stop_code');
    setEvaluating(false);
  };

  return {
    evalOutput,
    setEvalOutput,
    evaluating,
    toast,
    setToast,
    handleEvaluate,
    handleStopCode
  };
}
