import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  apiFetch,
  getCloudUrl,
  getLocalApiUrl,
  getConnectionStatus,
  getCompilerSocketUrl,
  LOCAL_DEV_API_URL,
  isElectronApp
} from '../data/api';
import { createTeacherSocketHandlers } from '../utils/teacherSocketHandlers';
import { openDotnetSetup } from '../utils/openDotnetSetup';

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
  activeStudent,
  selectedStudentId
}) {
  const [evalOutput, setEvalOutput] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [programStarted, setProgramStarted] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [toast, setToast] = useState(null);

  const compilerSocketRef = useRef(null);
  const ownsCompilerSocketRef = useRef(false);
  const evalTimeoutRef = useRef(null);
  const evalUnbindRef = useRef(null);
  const runIdRef = useRef(0);
  const evaluatingRef = useRef(false);
  useEffect(() => {
    evaluatingRef.current = evaluating;
  }, [evaluating]);

  const cleanupEvalRun = useCallback(({ emitStop = false } = {}) => {
    runIdRef.current += 1;
    if (evalTimeoutRef.current) {
      clearTimeout(evalTimeoutRef.current);
      evalTimeoutRef.current = null;
    }
    if (evalUnbindRef.current) {
      try { evalUnbindRef.current(); } catch (_) {}
      evalUnbindRef.current = null;
    }
    const activeSock = compilerSocketRef.current;
    if (activeSock) {
      if (emitStop) {
        try { activeSock.emit('stop_code'); } catch (_) {}
      }
      if (ownsCompilerSocketRef.current) {
        try { activeSock.disconnect(); } catch (_) {}
      }
      compilerSocketRef.current = null;
      ownsCompilerSocketRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupEvalRun({ emitStop: evaluatingRef.current });
    };
  }, [cleanupEvalRun]);

  // Reset terminal output & state when switching students
  const evalResetKey = `${selectedStudentId ?? ''}|${assignment?.id ?? ''}`;
  const [prevEvalResetKey, setPrevEvalResetKey] = useState(evalResetKey);
  if (evalResetKey !== prevEvalResetKey) {
    setPrevEvalResetKey(evalResetKey);
    setEvalOutput('');
    setEvaluating(false);
    setProgramStarted(false);
    setInputValue('');
  }

  useEffect(() => {
    return () => {
      cleanupEvalRun({ emitStop: true });
    };
  }, [selectedStudentId, assignment?.id, cleanupEvalRun]);

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

  // Compiler evaluation output listeners are attached per active run in startEvalOnSocket

  const handlersRef = useRef(null);
  const mergeWarningLogsRef = useRef(mergeWarningLogs);
  useEffect(() => {
    handlersRef.current = createTeacherSocketHandlers({
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
    mergeWarningLogsRef.current = mergeWarningLogs;
  }, [
    assignment,
    classroom,
    mode,
    setStudents,
    setSelectedStudentId,
    setSubmittedStudentNames,
    submittedStudentNamesRef,
    mergeWarningLogs
  ]);

  const classroomId = classroom?.id;
  const assignmentId = assignment?.id;

  // Dual-bridge socket & real-time monitoring events
  useEffect(() => {
    if (!socket) return;

    let secondarySocket = null;
    try {
      const conn = getConnectionStatus();
      const localUrl = getLocalApiUrl();
      const cloudUrl = getCloudUrl();
      const primaryUri = String(socket?.io?.uri || '').replace(/\/+$/, '');

      let altTarget = null;
      if (primaryUri.includes('localhost') || primaryUri.includes('127.0.0.1') || primaryUri.includes('192.168.')) {
        if (conn.isOnline && cloudUrl && !cloudUrl.includes('localhost') && !cloudUrl.includes('127.0.0.1')) {
          altTarget = String(cloudUrl).replace(/\/+$/, '');
        }
      } else {
<<<<<<< HEAD
        if (!conn.isWebHosted && localUrl && !localUrl.includes('verity-2z4v')) {
          altTarget = String(localUrl).replace(/\/+$/, '');
=======
        if (!conn.isWebHosted && localUrl && !localUrl.includes('onrender.com')) {
          altTarget = localUrl;
>>>>>>> 3b82a0e04c7a495c9e05ceca4205e12acdacce60
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

    const handlePastWarnings = (pastLogs) => {
      if (Array.isArray(pastLogs) && pastLogs.length > 0) {
        const curAId = assignmentId ? String(assignmentId) : null;
        const filtered = curAId
          ? pastLogs.filter((l) => {
              const lAId = l.assignmentId || l.assignment_id;
              return !lAId || String(lAId) === curAId;
            })
          : pastLogs;
        mergeWarningLogsRef.current?.(filtered);
      }
    };

    const onUpdateCode = (d) => handlersRef.current?.handleUpdateCode(d);
    const onReceiveAlert = (d) => handlersRef.current?.handleReceiveAlert(d);
    const onTerminalUpdate = (d) => handlersRef.current?.handleTerminalUpdate(d);
    const onStudentLeft = (d) => handlersRef.current?.handleStudentLeft(d);
    const onReceiveSubmission = (d) => handlersRef.current?.handleReceiveSubmission(d);
    const onUnsubmitted = (d) => handlersRef.current?.handleUnsubmitted(d);
    const onLiveGradeUpdate = (d) => handlersRef.current?.handleLiveGradeUpdate(d);

    const bindSocket = (targetSock) => {
      if (!targetSock) return () => {};
      const joinRoom = () => {
        if (mode === 'live') {
          const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
          targetSock.emit('teacher_join', { classroomId, assignmentId, token, user: currentUser });
          targetSock.emit('teacher_request_sync', { classroomId, assignmentId });
        }
      };

      targetSock.on('connect', joinRoom);
      if (targetSock.connected) joinRoom();

      targetSock.on('teacher_past_warnings', handlePastWarnings);
      if (mode === 'live') {
        targetSock.on('teacher_update_code', onUpdateCode);
        targetSock.on('teacher_receive_alert', onReceiveAlert);
        targetSock.on('teacher_terminal_update', onTerminalUpdate);
        targetSock.on('teacher_student_left', onStudentLeft);
      }
      targetSock.on('teacher_receive_submission', onReceiveSubmission);
      targetSock.on('teacher_student_unsubmitted', onUnsubmitted);
      targetSock.on('student_unsubmitted', onUnsubmitted);
      targetSock.on('grade_updated', onLiveGradeUpdate);

      return () => {
        targetSock.off('connect', joinRoom);
        targetSock.off('teacher_past_warnings', handlePastWarnings);
        if (mode === 'live') {
          targetSock.off('teacher_update_code', onUpdateCode);
          targetSock.off('teacher_receive_alert', onReceiveAlert);
          targetSock.off('teacher_terminal_update', onTerminalUpdate);
          targetSock.off('teacher_student_left', onStudentLeft);
        }
        targetSock.off('teacher_receive_submission', onReceiveSubmission);
        targetSock.off('teacher_student_unsubmitted', onUnsubmitted);
        targetSock.off('student_unsubmitted', onUnsubmitted);
        targetSock.off('grade_updated', onLiveGradeUpdate);
        try {
          targetSock.emit('teacher_leave', { classroomId, assignmentId });
        } catch (_) {}
      };
    };

    const unbindPrimary = bindSocket(socket);
    const unbindSecondary = secondarySocket ? bindSocket(secondarySocket) : null;

    let syncInterval = null;
    if (mode === 'live') {
      syncInterval = setInterval(() => {
        if (socket?.connected) socket.emit('teacher_request_sync', { classroomId, assignmentId });
        if (secondarySocket?.connected) secondarySocket.emit('teacher_request_sync', { classroomId, assignmentId });
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
  }, [socket, mode, classroomId, assignmentId, currentUser]);

  const handleEvaluate = (codeOverride) => {
    if (evaluating) return;
    const codeToRun =
      typeof codeOverride === 'string'
        ? codeOverride
        : activeStudent?.code || activeStudent?.finalCode || '';

    if (!codeToRun || !String(codeToRun).trim()) {
      setEvalOutput('[No code available to run.]\n');
      return;
    }

    cleanupEvalRun({ emitStop: true });
    const runId = runIdRef.current;
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');

    setEvalOutput('');
    setInputValue('');
    setProgramStarted(false);
    setEvaluating(true);

    const startOnSocket = (targetSock, ownsSocket, allowFallbackToPrimary) => {
      compilerSocketRef.current = targetSock;
      ownsCompilerSocketRef.current = ownsSocket;

      const resetTimer = (ms = 25000) => {
        if (evalTimeoutRef.current) clearTimeout(evalTimeoutRef.current);
        evalTimeoutRef.current = setTimeout(() => {
          if (runIdRef.current !== runId) return;
          setEvalOutput((prev) => prev + '\n[Notice: Compilation/execution timed out.]\n');
          setEvaluating(false);
          setProgramStarted(false);
          cleanupEvalRun({ emitStop: true });
        }, ms);
      };

      resetTimer(25000);

      let receivedOutput = false;
      let fallbackTriggered = false;

      const tryFallbackToPrimary = (reasonMsg) => {
        if (fallbackTriggered || runIdRef.current !== runId) return false;
        if (allowFallbackToPrimary && socket && socket.connected && socket !== targetSock) {
          fallbackTriggered = true;
          if (evalUnbindRef.current) {
            try { evalUnbindRef.current(); } catch (_) {}
            evalUnbindRef.current = null;
          }
          if (ownsSocket) {
            try { targetSock.disconnect(); } catch (_) {}
          }
          setEvalOutput('');
          startOnSocket(socket, false, false);
          return true;
        }
        setEvalOutput((prev) => prev + `\n${reasonMsg}\n`);
        setEvaluating(false);
        setProgramStarted(false);
        cleanupEvalRun();
        return false;
      };

      const onOut = (chunk) => {
        if (runIdRef.current !== runId || typeof chunk !== 'string') return;
        if (
          !receivedOutput &&
          allowFallbackToPrimary &&
          /Error:\s*Authentication required to execute code/i.test(chunk) &&
          socket?.connected &&
          socket !== targetSock
        ) {
          tryFallbackToPrimary(chunk.trim());
          return;
        }
        receivedOutput = true;
        setEvalOutput((prev) => prev + chunk);
      };

      const onStarted = () => {
        if (runIdRef.current !== runId) return;
        setProgramStarted(true);
        resetTimer(25000);
      };

      const onExit = () => {
        if (runIdRef.current !== runId) return;
        setEvaluating(false);
        setProgramStarted(false);
        cleanupEvalRun();
      };

      const onDotnetMissing = () => {
        if (runIdRef.current !== runId) return;
        setEvalOutput((prev) =>
          prev +
          '\n[Error: Microsoft .NET SDK is not installed on this machine.]\n' +
          '[Please install Microsoft .NET SDK to compile and run C# code.]\n'
        );
        setEvaluating(false);
        setProgramStarted(false);
        cleanupEvalRun();
        openDotnetSetup();
      };

      const onConnectError = (err) => {
        if (runIdRef.current !== runId) return;
        tryFallbackToPrimary(`Error: Compiler server unreachable (${err?.message || 'connection failed'}).`);
      };

      const onSocketError = (err) => {
        if (runIdRef.current !== runId) return;
        tryFallbackToPrimary(`Error: ${err?.message || 'Compiler socket error.'}`);
      };

      const onDisconnect = () => {
        if (runIdRef.current !== runId) return;
        if (!fallbackTriggered) {
          setEvalOutput((prev) => prev + '\n[Disconnected from compiler server]\n');
          setEvaluating(false);
          setProgramStarted(false);
          cleanupEvalRun();
        }
      };

      const onConnect = () => {
        if (runIdRef.current !== runId) return;
        if (token || currentUser) {
          targetSock.emit('authenticate', { token, user: currentUser });
        }
        targetSock.emit('compile_code', {
          code: codeToRun,
          language: 'csharp',
          token,
          user: currentUser
        });
      };

      targetSock.on('terminal_output', onOut);
      targetSock.on('program_started', onStarted);
      targetSock.on('process_exit', onExit);
      targetSock.on('dotnet_missing', onDotnetMissing);
      if (ownsSocket) {
        targetSock.on('connect', onConnect);
        targetSock.on('connect_error', onConnectError);
        targetSock.on('error', onSocketError);
        targetSock.on('disconnect', onDisconnect);
      }

      evalUnbindRef.current = () => {
        targetSock.off('terminal_output', onOut);
        targetSock.off('program_started', onStarted);
        targetSock.off('process_exit', onExit);
        targetSock.off('dotnet_missing', onDotnetMissing);
        if (ownsSocket) {
          targetSock.off('connect', onConnect);
          targetSock.off('connect_error', onConnectError);
          targetSock.off('error', onSocketError);
          targetSock.off('disconnect', onDisconnect);
        }
      };

      if (targetSock.connected) {
        targetSock.emit('compile_code', {
          code: codeToRun,
          language: 'csharp',
          token,
          user: currentUser
        });
      }
    };

    const strictLocal =
      typeof window !== 'undefined' &&
      (isElectronApp() ||
        Boolean(window.electronAPI) ||
        ['localhost', '127.0.0.1', '::1'].includes(window.location?.hostname || ''));
    const compilerUrl = String(
      strictLocal ? LOCAL_DEV_API_URL || 'http://localhost:3001' : getCompilerSocketUrl()
    ).replace(/\/+$/, '');
    const primaryUri = String(socket?.io?.uri || '').replace(/\/+$/, '');

    if (socket?.connected && primaryUri === compilerUrl) {
      startOnSocket(socket, false, false);
      return;
    }

    try {
      const dedicatedSocket = io(compilerUrl, {
        reconnection: false,
        timeout: 5000,
        transports: ['websocket', 'polling'],
        auth: { token }
      });
      startOnSocket(
        dedicatedSocket,
        true,
        Boolean(socket?.connected && primaryUri !== compilerUrl)
      );
    } catch (err) {
      if (socket?.connected) {
        startOnSocket(socket, false, false);
      } else {
        setEvalOutput(`Error: Unable to connect to compiler server (${err?.message || 'Unknown error'}).\n`);
        setEvaluating(false);
        setProgramStarted(false);
      }
    }
  };

  const handleStopCode = () => {
    const wasEvaluating = evaluatingRef.current;
    cleanupEvalRun({ emitStop: true });
    if (wasEvaluating) {
      setEvalOutput((prev) => prev + '\n[Process stopped by user]\n');
    }
    setEvaluating(false);
    setProgramStarted(false);
  };

  const handleTerminalInput = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const targetSock = compilerSocketRef.current || socket;
    if (targetSock && targetSock.connected) {
      targetSock.emit('terminal_input', inputValue);
    }
    setEvalOutput((prev) => prev + inputValue + '\n');
    setInputValue('');
  };

  return {
    evalOutput,
    setEvalOutput,
    evaluating,
    programStarted,
    inputValue,
    setInputValue,
    toast,
    setToast,
    handleEvaluate,
    handleStopCode,
    handleTerminalInput
  };
}
