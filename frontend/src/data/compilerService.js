import { io } from 'socket.io-client';
import { getCompilerSocketUrl, getLocalApiUrl } from './api';

export const DEFAULT_CSHARP =
  'using System;\n\nclass Program {\n    static void Main(string[] args) {\n        Console.WriteLine("Hello, World!");\n    }\n}';

export const MIN_TERMINAL_H = 38;
export const DEFAULT_TERMINAL_H = 240;
export const MIN_FONT = 10;
export const MAX_FONT = 24;

export function loadSavedCode() {
  try {
    const saved = localStorage.getItem('verity_compiler_code');
    if (saved) return saved;
  } catch (_) {}
  return DEFAULT_CSHARP;
}

export function persistCode(code) {
  try {
    localStorage.setItem('verity_compiler_code', code);
  } catch (_) {}
}

export function loadSavedExtraFiles() {
  try {
    const saved = localStorage.getItem('verity_compiler_extrafiles');
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return [];
}

export function persistExtraFiles(files) {
  try {
    localStorage.setItem('verity_compiler_extrafiles', JSON.stringify(files));
  } catch (_) {}
}

/**
 * Executes C# test cases over socket.io connection.
 */
export function executeTestCasesSocket({ code, extraFiles, testCases, storedUser, token, onResults, onError }) {
  const primaryUrl = getCompilerSocketUrl();
  const localUrl = getLocalApiUrl();
  let hasSwitchedToLocal = primaryUrl === localUrl;

  const socket = io(primaryUrl, {
    timeout: 5000,
    transports: ['websocket', 'polling'],
    auth: { token },
  });

  const cleanup = () => {
    try {
      socket.disconnect();
    } catch (_) {}
  };

  const timer = setTimeout(() => {
    cleanup();
    if (onError) onError(new Error('Test cases execution timed out.'));
  }, 25000);

  socket.on('connect', () => {
    socket.emit('run_test_cases', {
      language: 'csharp',
      code,
      extraFiles: extraFiles.map((f) => ({
        name: f.name.endsWith('.cs') ? f.name : `${f.name}.cs`,
        code: f.code,
      })),
      testCases,
      username: storedUser?.name || 'CompilerView',
      room: 'sandbox',
      token,
      user: storedUser || { id: 1, name: 'CompilerView', role: 'Student' },
    });
  });

  socket.on('test_cases_results', (data) => {
    clearTimeout(timer);
    cleanup();
    if (onResults) onResults(data?.results || []);
  });

  socket.on('connect_error', () => {
    if (!hasSwitchedToLocal && socket.io && socket.io.uri !== localUrl) {
      hasSwitchedToLocal = true;
      socket.io.uri = localUrl;
      socket.connect();
      return;
    }
    clearTimeout(timer);
    cleanup();
    if (onError) onError(new Error('Connection error'));
  });

  socket.on('disconnect', () => {
    clearTimeout(timer);
    cleanup();
  });

  socket.on('error', (err) => {
    clearTimeout(timer);
    cleanup();
    if (onError) onError(err);
  });

  return cleanup;
}
