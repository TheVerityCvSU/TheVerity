import { useState, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getCompilerSocketUrl, getLocalApiUrl } from '../data/api';
import { executeTestCasesSocket } from '../data/compilerService';

export function useCompilerRunner() {
  const [output, setOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [programStarted, setProgramStarted] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isRunningTests, setIsRunningTests] = useState(false);

  const socketRef = useRef(null);
  const failsafeRef = useRef(null);
  const termEndRef = useRef(null);

  const addLine = useCallback((text, type = 'out') => {
    setOutput((prev) => [...prev, { text, type }]);
  }, []);

  const cleanupRun = useCallback(() => {
    if (failsafeRef.current) {
      clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
      } catch (_) {}
      socketRef.current = null;
    }
    setIsRunning(false);
    setProgramStarted(false);
  }, []);

  useEffect(() => {
    termEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  useEffect(() => {
    return () => {
      cleanupRun();
    };
  }, [cleanupRun]);

  useEffect(() => {
    const handleDotnetReady = (e) => {
      addLine(`\nMicrosoft .NET SDK ${e.detail?.version || '8.0'} installed successfully — C# Compiler is ready.\n`, 'out');
    };
    window.addEventListener('verity:dotnet-installed', handleDotnetReady);
    return () => window.removeEventListener('verity:dotnet-installed', handleDotnetReady);
  }, [addLine]);

  const checkVmBlock = async () => {
    if (window.electronAPI && typeof window.electronAPI.checkVmStatus === 'function') {
      try {
        const vmStatus = await window.electronAPI.checkVmStatus();
        let storedUser = null;
        try {
          const u = localStorage.getItem('currentUser');
          if (u) storedUser = JSON.parse(u);
        } catch (_) {}
        if (vmStatus && vmStatus.isVm && storedUser?.role === 'Student') {
          return true;
        }
      } catch (_) {}
    }
    return false;
  };

  const runCode = async (code, extraFiles = [], onBeforeRun) => {
    cleanupRun();

    const isBlocked = await checkVmBlock();
    if (isBlocked) {
      if (onBeforeRun) onBeforeRun();
      setOutput([
        { text: '[ACCESS DENIED] Exam and code execution is strictly prohibited inside a Virtual Machine.', type: 'err' },
        { text: 'Please exit and run The Verity on a physical host computer.', type: 'err' },
      ]);
      return;
    }

    if (onBeforeRun) onBeforeRun();
    setIsRunning(true);
    setProgramStarted(false);
    setOutput([{ text: 'Compiling C# (Local)...', type: 'info' }]);

    failsafeRef.current = setTimeout(() => {
      setIsRunning((current) => {
        if (current) {
          addLine('\n[Notice: Compilation/execution timed out after 25s]', 'info');
          cleanupRun();
          return false;
        }
        return current;
      });
    }, 25000);

    try {
      const primaryUrl = getCompilerSocketUrl();
      const localUrl = getLocalApiUrl();
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      let storedUser = null;
      try {
        const u = localStorage.getItem('currentUser');
        if (u) storedUser = JSON.parse(u);
      } catch (_) {}

      let currentUrl = primaryUrl;
      let hasSwitchedToLocal = primaryUrl === localUrl;

      const socket = io(currentUrl, {
        timeout: 5000,
        transports: ['websocket', 'polling'],
        auth: { token },
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('compile_code', {
          language: 'csharp',
          code: code,
          extraFiles: extraFiles.map((f) => ({
            name: f.name.endsWith('.cs') ? f.name : `${f.name}.cs`,
            code: f.code,
          })),
          username: storedUser?.name || 'CompilerView',
          room: 'sandbox',
          token: token,
          user: storedUser || { id: 1, name: 'CompilerView', role: 'Student' },
        });
      });

      socket.on('terminal_output', (data) => {
        if (typeof data === 'string') {
          addLine(data.replace(/\n$/, ''), 'out');
        }
      });

      socket.on('program_started', () => setProgramStarted(true));

      socket.on('process_exit', (data) => {
        try {
          const exitCode =
            data && typeof data === 'object' && data.code !== undefined
              ? data.code
              : typeof data === 'number'
              ? data
              : 0;
          addLine(`\nDone — exit code ${exitCode}`, exitCode === 0 ? 'exit-ok' : 'exit-err');
        } catch (e) {
          console.error('Error handling process_exit:', e);
        } finally {
          cleanupRun();
        }
      });

      socket.on('connect_error', () => {
        if (!hasSwitchedToLocal && socket.io && socket.io.uri !== localUrl) {
          hasSwitchedToLocal = true;
          currentUrl = localUrl;
          socket.io.uri = localUrl;
          socket.connect();
          return;
        }
        addLine(`Error: Local compiler server unreachable at ${currentUrl}. Please ensure The Verity local server is running on port 3001.`, 'err');
        cleanupRun();
      });

      socket.on('disconnect', () => cleanupRun());
      socket.on('error', (err) => {
        addLine(`Error: ${err?.message || 'Socket error'}`, 'err');
        cleanupRun();
      });

      socket.on('dotnet_missing', () => {
        addLine(
          '\n[Error: Microsoft .NET SDK is not installed on this machine.]\n[Please run the Verity installer and select the Microsoft .NET SDK option, or download it from https://dotnet.microsoft.com/download/dotnet/8.0]\n',
          'err'
        );
        cleanupRun();
      });
    } catch (err) {
      addLine(`Error: Failed to initialize compiler socket (${err?.message || 'Unknown'}).`, 'err');
      cleanupRun();
    }
  };

  const handleStop = () => {
    if (socketRef.current) {
      try {
        socketRef.current.emit('stop_code');
        socketRef.current.disconnect();
      } catch (_) {}
      socketRef.current = null;
    }
    if (failsafeRef.current) {
      clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
    setIsRunning(false);
    setProgramStarted(false);
    addLine('\n[Stopped by user]', 'err');
  };

  const handleSendInput = (text) => {
    if (socketRef.current) {
      socketRef.current.emit('terminal_input', text);
    }
    addLine(text, 'out');
  };

  const runTestCases = async (code, extraFiles = [], testCases = [], setTestCases, setHasTested, onBeforeRun) => {
    const isBlocked = await checkVmBlock();
    if (isBlocked) {
      alert('[ACCESS DENIED] Exam code execution is prohibited inside a Virtual Machine. Please run on a physical computer.');
      return;
    }

    if (!testCases || testCases.length === 0) return;
    if (onBeforeRun) onBeforeRun();
    setIsRunningTests(true);
    setTestCases((prev) => prev.map((tc) => ({ ...tc, status: 'running', errorMessage: '', actualOutput: '' })));

    let storedUser = null;
    try {
      const u = localStorage.getItem('currentUser');
      if (u) storedUser = JSON.parse(u);
    } catch (_) {}
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');

    executeTestCasesSocket({
      code,
      extraFiles,
      testCases,
      storedUser,
      token,
      onResults: (results) => {
        setTestCases((prev) =>
          prev.map((tc) => {
            const res = results.find((r) => r.id === tc.id);
            return res ? { ...tc, status: res.passed ? 'passed' : 'failed', actualOutput: res.actualOutput, errorMessage: res.error } : tc;
          })
        );
        setHasTested(true);
        setIsRunningTests(false);
      },
      onError: () => {
        setIsRunningTests(false);
      },
    });
  };

  return {
    output,
    setOutput,
    addLine,
    isRunning,
    programStarted,
    inputValue,
    setInputValue,
    isRunningTests,
    termEndRef,
    runCode,
    handleStop,
    handleSendInput,
    runTestCases,
  };
}
