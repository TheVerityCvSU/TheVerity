import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play, Square, TerminalSquare, Trash2,
  ZoomIn, ZoomOut, Settings,
  CheckSquare, Plus, PlayCircle, X
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { openDotnetSetup } from '../utils/dotnetHelper';
import { getCompilerSocketUrl, getLocalApiUrl } from '../utils/api';
import { registerMonacoSnippets } from '../utils/monacoSnippets.js';

const DEFAULT_CSHARP = 'using System;\n\nclass Program {\n    static void Main(string[] args) {\n        Console.WriteLine("Hello, World!");\n    }\n}';

const MIN_TERMINAL_H = 38;
const DEFAULT_TERMINAL_H = 240;
const MIN_FONT = 10;
const MAX_FONT = 24;

export default function CompilerView() {
  const { isDark } = useDarkMode();

  const [code, setCode] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_compiler_code');
      if (saved) return saved;
    } catch (_) {}
    return DEFAULT_CSHARP;
  });

  const [extraFiles, setExtraFiles] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_compiler_extrafiles');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  const [activeFileId, setActiveFileId] = useState('main'); // 'main' = Program.cs
  const [renamingFileId, setRenamingFileId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [output, setOutput]     = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [programStarted, setProgramStarted] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [fontSize, setFontSize] = useState(14);
  
  // Test Cases State
  const [bottomTab, setBottomTab] = useState('terminal');
  const [testCases, setTestCases] = useState([{ id: 1, name: 'Test 1', input: '', expectedOutput: '', isHidden: false }]);
  const [activeTestCaseId, setActiveTestCaseId] = useState(1);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [hasTested, setHasTested] = useState(false);

  // Terminal resize (drag handle)
  const [termH, setTermH]               = useState(DEFAULT_TERMINAL_H);
  const [termCollapsed, setTermCollapsed] = useState(false);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const isDraggingRef = useRef(false);
  const startYRef     = useRef(0);
  const startHRef     = useRef(DEFAULT_TERMINAL_H);

  const editorRef    = useRef(null);
  const containerRef = useRef(null);
  const termEndRef   = useRef(null);
  const socketRef    = useRef(null);
  const failsafeRef  = useRef(null);

  // Auto-scroll terminal output
  useEffect(() => {
    termEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  // Clean up socket and watchdog on component unmount
  useEffect(() => {
    return () => {
      if (failsafeRef.current) {
        clearTimeout(failsafeRef.current);
        failsafeRef.current = null;
      }
      if (socketRef.current) {
        try {
          socketRef.current.emit('stop_code');
          socketRef.current.disconnect();
        } catch (_) {}
        socketRef.current = null;
      }
    };
  }, []);

  // Listen for background .NET SDK installation completions
  useEffect(() => {
    const handleDotnetReady = (e) => {
      addLine(`\n⚡ Microsoft .NET SDK ${e.detail?.version || '8.0'} installed successfully — C# Compiler is ready.\n`, 'out');
    };
    window.addEventListener('verity:dotnet-installed', handleDotnetReady);
    return () => window.removeEventListener('verity:dotnet-installed', handleDotnetReady);
  }, []);

  // Relayout when terminal changes height
  useEffect(() => {
    const t = setTimeout(() => editorRef.current?.layout(), 30);
    return () => clearTimeout(t);
  }, [termH, termCollapsed]);

  // Live font size update
  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize });
  }, [fontSize]);

  const persistExtraFiles = (files) => {
    try {
      localStorage.setItem('verity_compiler_extrafiles', JSON.stringify(files));
    } catch (_) {}
  };

  const handleAddFile = () => {
    const num = extraFiles.length + 2;
    const newFile = {
      id: `file_${Date.now()}`,
      name: `File${num}`,
      code: `using System;\n\npublic class File${num}\n{\n    // Add your code or helper methods here\n}\n`
    };
    const updated = [...extraFiles, newFile];
    setExtraFiles(updated);
    persistExtraFiles(updated);
    setActiveFileId(newFile.id);
  };

  const handleDeleteFile = (id) => {
    const updated = extraFiles.filter(f => f.id !== id);
    setExtraFiles(updated);
    persistExtraFiles(updated);
    if (activeFileId === id) {
      setActiveFileId('main');
    }
  };

  const handleRenameFile = (id, newName) => {
    const cleaned = (newName || '').replace(/\.[a-zA-Z0-9]+$/i, '').trim();
    const safeName = cleaned.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 40) || 'File';
    const updated = extraFiles.map(f => (f.id === id ? { ...f, name: safeName } : f));
    setExtraFiles(updated);
    persistExtraFiles(updated);
    setRenamingFileId(null);
  };

  const handleCodeChange = (newCode) => {
    if (activeFileId === 'main') {
      setCode(newCode);
      try {
        localStorage.setItem('verity_compiler_code', newCode);
      } catch (_) {}
    } else {
      const updated = extraFiles.map(f => (f.id === activeFileId ? { ...f, code: newCode } : f));
      setExtraFiles(updated);
      persistExtraFiles(updated);
    }
  };

  const activeCode = activeFileId === 'main' ? code : (extraFiles.find(f => f.id === activeFileId)?.code ?? '');

  const addLine = (text, type = 'out') =>
    setOutput(prev => [...prev, { text, type }]);

  const cleanupRun = () => {
    if (failsafeRef.current) {
      clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch (_) {}
      socketRef.current = null;
    }
    setIsRunning(false);
    setProgramStarted(false);
  };

  const runCode = async () => {
    // If a previous execution or socket exists, cleanly close it first
    cleanupRun();

    if (window.electronAPI && typeof window.electronAPI.checkVmStatus === 'function') {
      try {
        const vmStatus = await window.electronAPI.checkVmStatus();
        let storedUser = null;
        try {
          const u = localStorage.getItem('currentUser');
          if (u) storedUser = JSON.parse(u);
        } catch (_) {}
        if (vmStatus && vmStatus.isVm && storedUser?.role === 'Student') {
          setTermCollapsed(false);
          setBottomTab('terminal');
          setOutput([
            { text: '⚠️ ACCESS DENIED: Exam and code execution is strictly prohibited inside a Virtual Machine.', type: 'err' },
            { text: 'Please exit and run The Verity on a physical host computer.', type: 'err' }
          ]);
          return;
        }
      } catch (_) {}
    }

    setIsRunning(true);
    setProgramStarted(false);
    setTermCollapsed(false);
    setBottomTab('terminal');

    setOutput([{ text: '▶ Compiling C# (Local)…', type: 'info' }]);

    // Watchdog failsafe timeout so the Run button is guaranteed to re-enable
    failsafeRef.current = setTimeout(() => {
      setIsRunning(current => {
        if (current) {
          addLine('\n[Notice: Compilation/execution timed out after 25s]', 'info');
          cleanupRun();
          return false;
        }
        return current;
      });
    }, 25000);

    try {
      const { io } = await import('socket.io-client');
      const primaryUrl = getCompilerSocketUrl();
      const localUrl = getLocalApiUrl();
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      let storedUser = null;
      try {
        const u = localStorage.getItem('currentUser');
        if (u) storedUser = JSON.parse(u);
      } catch (_) {}

      let currentUrl = primaryUrl;
      let hasSwitchedToLocal = (primaryUrl === localUrl);

      const socket = io(currentUrl, {
        timeout: 5000,
        transports: ['websocket', 'polling'],
        auth: { token }
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('compile_code', {
          language: 'csharp',
          code: code,
          extraFiles: extraFiles.map(f => ({
            name: (f.name.endsWith('.cs') ? f.name : `${f.name}.cs`),
            code: f.code
          })),
          username: storedUser?.name || 'CompilerView',
          room: 'sandbox',
          token: token,
          user: storedUser || { id: 1, name: 'CompilerView', role: 'Student' }
        });
      });

      socket.on('terminal_output', (data) => {
        if (typeof data === 'string') {
          addLine(data.replace(/\n$/, ''), 'out');
        }
      });

      socket.on('program_started', () => {
        setProgramStarted(true);
      });

      socket.on('process_exit', (data) => {
        try {
          const exitCode = (data && typeof data === 'object' && data.code !== undefined)
            ? data.code
            : (typeof data === 'number' ? data : 0);
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
          console.warn(`[CompilerView] Compiler at ${socket.io.uri} unreachable. Falling back to local compiler at ${localUrl}...`);
          socket.io.uri = localUrl;
          socket.connect();
          return;
        }
        addLine(`Error: Local compiler server unreachable at ${currentUrl}. Please ensure The Verity local server is running on port 3001.`, 'err');
        cleanupRun();
      });

      socket.on('disconnect', () => {
        cleanupRun();
      });

      socket.on('error', (err) => {
        addLine(`Error: ${err?.message || 'Socket error'}`, 'err');
        cleanupRun();
      });

      socket.on('dotnet_missing', () => {
        addLine('\n[Error: Microsoft .NET SDK is not installed on this machine.]\n[Please run the Verity installer and select the Microsoft .NET SDK option, or download it from https://dotnet.microsoft.com/download/dotnet/8.0]\n', 'err');
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
    addLine('\n⚠ Stopped by user.', 'err');
  };

  const handleRunAllTestCases = async () => {
    if (window.electronAPI && typeof window.electronAPI.checkVmStatus === 'function') {
      try {
        const vmStatus = await window.electronAPI.checkVmStatus();
        let storedUser = null;
        try {
          const u = localStorage.getItem('currentUser');
          if (u) storedUser = JSON.parse(u);
        } catch (_) {}
        if (vmStatus && vmStatus.isVm && storedUser?.role === 'Student') {
          alert('⚠️ ACCESS DENIED: Exam code execution is prohibited inside a Virtual Machine. Please run on a physical computer.');
          return;
        }
      } catch (_) {}
    }

    if (!testCases || testCases.length === 0) return;
    setBottomTab('testcases');
    setIsRunningTests(true);
    setTestCases(prev => prev.map(tc => ({ ...tc, status: 'running', errorMessage: '', actualOutput: '' })));
    setTermCollapsed(false);

    try {
      const { io } = await import('socket.io-client');
      const primaryUrl = getCompilerSocketUrl();
      const localUrl = getLocalApiUrl();
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      let storedUser = null;
      try {
        const u = localStorage.getItem('currentUser');
        if (u) storedUser = JSON.parse(u);
      } catch (_) {}

      let hasSwitchedToLocal = (primaryUrl === localUrl);

      const socket = io(primaryUrl, {
        timeout: 5000,
        transports: ['websocket', 'polling'],
        auth: { token }
      });

      const cleanupTests = () => {
        setIsRunningTests(false);
        try { socket.disconnect(); } catch (_) {}
      };

      const testTimeout = setTimeout(() => {
        cleanupTests();
      }, 25000);

      socket.on('connect', () => {
        socket.emit('run_test_cases', {
          language: 'csharp',
          code: code,
          extraFiles: extraFiles.map(f => ({
            name: (f.name.endsWith('.cs') ? f.name : `${f.name}.cs`),
            code: f.code
          })),
          testCases: testCases,
          username: storedUser?.name || 'CompilerView',
          room: 'sandbox',
          token: token,
          user: storedUser || { id: 1, name: 'CompilerView', role: 'Student' }
        });
      });

      socket.on('test_cases_results', (data) => {
        clearTimeout(testTimeout);
        const results = data?.results || [];
        setTestCases(prev => prev.map(tc => {
            const res = results.find(r => r.id === tc.id);
            return res ? { ...tc, status: res.passed ? 'passed' : 'failed', actualOutput: res.actualOutput, errorMessage: res.error } : tc;
        }));
        setHasTested(true);
        cleanupTests();
      });

      socket.on('connect_error', () => {
        if (!hasSwitchedToLocal && socket.io && socket.io.uri !== localUrl) {
          hasSwitchedToLocal = true;
          console.warn(`[CompilerView] Test runner at ${socket.io.uri} unreachable. Falling back to local compiler at ${localUrl}...`);
          socket.io.uri = localUrl;
          socket.connect();
          return;
        }
        clearTimeout(testTimeout);
        cleanupTests();
      });

      socket.on('disconnect', () => {
        clearTimeout(testTimeout);
        cleanupTests();
      });

      socket.on('error', () => {
        clearTimeout(testTimeout);
        cleanupTests();
      });
    } catch (err) {
      setIsRunningTests(false);
    }
  };

  const passedTestsCount = testCases.filter(t => t.status === 'passed').length;

  // Drag-to-resize terminal
  const onDividerDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsResizingTerminal(true);

    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    startYRef.current = clientY;

    // Immediately un-collapse so drag visually updates in real time
    let curHeight = termH;
    if (termCollapsed) {
      curHeight = 36;
      setTermCollapsed(false);
    }
    startHRef.current = curHeight;
    setTermH(curHeight);

    document.body.style.cursor     = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!isDraggingRef.current) return;
      const currentY = ev.clientY ?? ev.touches?.[0]?.clientY;
      if (currentY === undefined) return;
      const delta = startYRef.current - currentY;
      const minHeight = 60;
      const maxHeight = Math.max(minHeight, Math.round(window.innerHeight * 0.85));
      setTermH(Math.max(minHeight, Math.min(startHRef.current + delta, maxHeight)));
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };
    const onUp = () => {
      isDraggingRef.current = false;
      setIsResizingTerminal(false);
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 50);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  // ── Colors ── (exactly matches StudentView)
  const toolbarBg   = isDark ? '#262626' : '#f9fafb';
  const toolbarBdr  = isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db';
  const editorBg    = isDark ? '#1e1e1e' : '#ffffff';
  const tabsBg      = isDark ? '#252526' : '#f3f4f6';
  const tabsBdr     = isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db';
  const termBg      = isDark ? '#1e1e1e' : '#ffffff';
  const termHdrBg   = isDark ? '#262626' : '#f3f4f6';
  const termHdrBdr  = isDark ? '1px solid #3c3c3c' : '1px solid #e5e7eb';
  const handleBg    = isDark ? '#262626' : '#e5e7eb';
  const handleBdr   = isDark ? '#3c3c3c' : '#d1d5db';
  const textMain    = isDark ? '#e8eaed' : '#374151';
  const textMuted   = isDark ? '#9ca3af' : '#6b7280';
  const border      = isDark ? '#3c3c3c' : '#d1d5db';

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex', flexDirection: 'column',
        flex: 1, height: '100%', overflow: 'hidden',
        backgroundColor: editorBg,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      {/* ══ TOOLBAR (60px, matches StudentView) ══════════════════ */}
      <div style={{
        height: '60px', minHeight: '60px', flexShrink: 0,
        backgroundColor: toolbarBg,
        borderBottom: toolbarBdr,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        {/* Left group: Run + Stop */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            id="compiler-run-btn"
            onClick={runCode}
            disabled={isRunning}
            style={{
              padding: '8px 20px',
              backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : '#34d399',
              color: isDark ? '#34d399' : 'white',
              border: isDark ? '1px solid rgba(52,211,153,0.3)' : 'none',
              borderRadius: '5px', cursor: isRunning ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: '6px',
              opacity: isRunning ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            <Play size={16} fill="currentColor" /> Run
          </button>

          <button
            id="compiler-stop-btn"
            onClick={handleStop}
            disabled={!isRunning}
            style={{
              padding: '8px 20px',
              backgroundColor: isDark ? 'rgba(248,113,113,0.15)' : '#f87171',
              color: isDark ? '#f87171' : 'white',
              border: isDark ? '1px solid rgba(248,113,113,0.3)' : 'none',
              borderRadius: '5px', cursor: isRunning ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: '6px',
              opacity: isRunning ? 1 : 0.5,
              transition: 'all 0.15s',
            }}
          >
            <Square size={14} fill="currentColor" /> Stop
          </button>
        </div>

        {/* Right group: Font adjuster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

          {/* Font size control */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            border: `1px solid ${border}`, borderRadius: '6px',
            backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => setFontSize(f => Math.max(MIN_FONT, f - 1))}
              disabled={fontSize <= MIN_FONT}
              title="Decrease font size"
              style={{
                padding: '6px 10px', border: 'none', cursor: 'pointer',
                background: 'transparent', color: textMuted,
                opacity: fontSize <= MIN_FONT ? 0.35 : 1,
                display: 'flex', alignItems: 'center',
              }}
            >
              <ZoomOut size={14} />
            </button>
            <span style={{
              minWidth: '28px', textAlign: 'center',
              fontSize: '0.78rem', fontWeight: '700', color: textMain,
              userSelect: 'none', borderLeft: `1px solid ${border}`, borderRight: `1px solid ${border}`,
              padding: '6px 2px',
            }}>
              {fontSize}
            </span>
            <button
              onClick={() => setFontSize(f => Math.min(MAX_FONT, f + 1))}
              disabled={fontSize >= MAX_FONT}
              title="Increase font size"
              style={{
                padding: '6px 10px', border: 'none', cursor: 'pointer',
                background: 'transparent', color: textMuted,
                opacity: fontSize >= MAX_FONT ? 0.35 : 1,
                display: 'flex', alignItems: 'center',
              }}
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ══ EDITOR AREA ══════════════════════════════════════════ */}
      <div style={{
        flex: 1, minHeight: 0,
        backgroundColor: editorBg,
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* File Tabs with Multi-File & Add File Support */}
        <div style={{
          display: 'flex', alignItems: 'center',
          height: '32px', flexShrink: 0,
          backgroundColor: tabsBg,
          borderBottom: tabsBdr,
          userSelect: 'none', overflowX: 'auto',
        }}>
          {/* Main Program.cs Tab */}
          <div
            onClick={() => setActiveFileId('main')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '0 14px', height: '100%',
              borderRight: tabsBdr,
              backgroundColor: activeFileId === 'main'
                ? (isDark ? '#1e1e1e' : '#ffffff')
                : 'transparent',
              color: activeFileId === 'main'
                ? (isDark ? '#e8eaed' : '#111827')
                : (isDark ? '#9ca3af' : '#6b7280'),
              fontSize: '0.75rem',
              fontWeight: activeFileId === 'main' ? '700' : '500',
              borderBottom: activeFileId === 'main' ? '2px solid #10b981' : '2px solid transparent',
              whiteSpace: 'nowrap', flexShrink: 0,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold' }}>{'{ }'}</span>
            <span>Program.cs</span>
          </div>

          {/* Extra Files Tabs */}
          {extraFiles.map(f => (
            <div
              key={f.id}
              onClick={() => setActiveFileId(f.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenamingFileId(f.id);
                setRenameValue(f.name);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '0 8px 0 12px', height: '100%',
                borderRight: tabsBdr,
                backgroundColor: activeFileId === f.id
                  ? (isDark ? '#1e1e1e' : '#ffffff')
                  : 'transparent',
                color: activeFileId === f.id
                  ? (isDark ? '#e8eaed' : '#111827')
                  : (isDark ? '#9ca3af' : '#6b7280'),
                fontSize: '0.75rem',
                fontWeight: activeFileId === f.id ? '700' : '500',
                borderBottom: activeFileId === f.id ? '2px solid #10b981' : '2px solid transparent',
                whiteSpace: 'nowrap', flexShrink: 0,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {renamingFileId === f.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => handleRenameFile(f.id, renameValue)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameFile(f.id, renameValue);
                    if (e.key === 'Escape') setRenamingFileId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '90px', fontSize: '0.75rem', padding: '2px 5px',
                    border: '1px solid #10b981', borderRadius: '4px', outline: 'none',
                    backgroundColor: isDark ? '#333333' : '#ffffff',
                    color: isDark ? '#e8eaed' : '#111827',
                  }}
                />
              ) : (
                <span title="Double-click to rename file" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.65rem', color: isDark ? '#9ca3af' : '#6b7280' }}>{'{ }'}</span>
                  <span>{f.name}.cs</span>
                </span>
              )}

              {renamingFileId !== f.id && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteFile(f.id);
                  }}
                  title={`Delete ${f.name}.cs`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px', display: 'flex', alignItems: 'center',
                    color: isDark ? '#6b7280' : '#9ca3af',
                    borderRadius: '3px',
                    marginLeft: '2px',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af'}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}

          {/* Add Another File Button */}
          <button
            type="button"
            onClick={handleAddFile}
            title="Add another C# file"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 12px', height: '100%',
              display: 'flex', alignItems: 'center', gap: '4px',
              color: isDark ? '#9ca3af' : '#6b7280',
              fontSize: '0.75rem',
              fontWeight: '600',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#10b981';
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = isDark ? '#9ca3af' : '#6b7280';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Plus size={14} />
            <span>New File</span>
          </button>
        </div>

        {/* Monaco Editor */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', pointerEvents: isResizingTerminal ? 'none' : 'auto' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}>
            <Editor
              height="100%"
              width="100%"
              language="csharp"
              value={activeCode}
              onChange={v => handleCodeChange(v ?? '')}
              theme={isDark ? 'vs-dark' : 'light'}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              registerMonacoSnippets(monaco);
              if (monaco.languages.typescript) {
                monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });
              }
              // Multi-pass layout force to beat any animation timing issues
              [50, 150, 400, 900].forEach(ms =>
                setTimeout(() => editorRef.current?.layout(), ms)
              );
              editor.focus();
            }}
            options={{
              automaticLayout: true,
              fontSize,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderLineHighlight: 'gutter',
              padding: { top: 12, bottom: 12 },
              smoothScrolling: true,
              cursorSmoothCaretAnimation: 'on',
              wordWrap: 'off',
              contextmenu: true,
              readOnly: false,
              domReadOnly: false,
              fontFamily: '"Consolas", "Courier New", monospace',
              // Monaco Snippets & IntelliSense
              snippetSuggestions: 'top',
              tabCompletion: 'on',
              quickSuggestions: { other: true, comments: false, strings: false },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'on',
              wordBasedSuggestions: 'currentDocument',
              suggest: {
                snippetsPreventQuickSuggestions: false,
                localityBonus: true,
                showSnippets: true,
                showWords: true,
                showKeywords: true
              }
            }}
          />
          </div>
        </div>
      </div>

      {/* Full-screen invisible drag overlay to prevent iframe / Monaco pointer interception */}
      {isResizingTerminal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            cursor: 'row-resize',
            backgroundColor: 'transparent',
            userSelect: 'none',
          }}
        />
      )}

      {/* ══ RESIZE HANDLE (matches StudentView resizeHandle) ═══ */}
      <div
        onMouseDown={onDividerDown}
        onTouchStart={onDividerDown}
        style={{
          height: '10px',
          flexShrink: 0,
          zIndex: 15,
          cursor: 'row-resize',
          touchAction: 'none',
          backgroundColor: isResizingTerminal ? '#10b981' : (isDark ? '#262626' : '#e5e7eb'),
          borderTop: isResizingTerminal ? '1px solid #10b981' : `1px solid ${handleBdr}`,
          borderBottom: isResizingTerminal ? '1px solid #10b981' : `1px solid ${handleBdr}`,
          boxShadow: isResizingTerminal ? '0 0 10px rgba(16, 185, 129, 0.45)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none',
          transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        }}
        title="Drag up or down to resize terminal"
      >
        <div style={{
          width: '48px',
          height: '4px',
          borderRadius: '4px',
          backgroundColor: isResizingTerminal ? '#ffffff' : (isDark ? '#555555' : '#9ca3af'),
        }} />
      </div>

      {/* ══ TERMINAL (matches StudentView terminalWrapper) ══════ */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        backgroundColor: termBg,
        borderTop: `1px solid ${border}`,
        flexShrink: 0,
        overflow: 'hidden',
        height: termCollapsed ? '36px' : `${termH}px`,
        minHeight: termCollapsed ? '36px' : '60px',
        maxHeight: '85vh',
        transition: isResizingTerminal ? 'none' : 'height 0.15s ease',
      }}>
        {/* Terminal header */}
        <div
          onMouseDown={(e) => {
            if (e.target.closest('button') || e.target.closest('input')) return;
            onDividerDown(e);
          }}
          onTouchStart={(e) => {
            if (e.target.closest('button') || e.target.closest('input')) return;
            onDividerDown(e);
          }}
          onDoubleClick={() => setTermCollapsed(p => !p)}
          style={{
            height: '36px', minHeight: '36px', flexShrink: 0,
            backgroundColor: termHdrBg,
            borderBottom: termCollapsed ? 'none' : termHdrBdr,
            padding: '0 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'row-resize',
            userSelect: 'none',
          }}
          title="Drag up or down to resize, double-click to toggle"
        >
          {/* Left: TABS */}
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <button
              onClick={() => { setBottomTab('terminal'); setTermCollapsed(false); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '0 14px', height: '36px',
                border: 'none', cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: '700',
                letterSpacing: '0.04em',
                backgroundColor: (bottomTab === 'terminal' && !termCollapsed) ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
                color: (bottomTab === 'terminal' && !termCollapsed) ? (isDark ? '#10b981' : '#059669') : textMuted,
                borderBottom: (bottomTab === 'terminal' && !termCollapsed) ? '2px solid #10b981' : '2px solid transparent',
                userSelect: 'none',
                transition: 'all 0.15s ease',
                marginLeft: '-14px',
              }}
            >
              <TerminalSquare size={15} />
              <span>TERMINAL</span>
            </button>
            <button
              onClick={() => { setBottomTab('testcases'); setTermCollapsed(false); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '0 14px', height: '36px',
                border: 'none', cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: '700',
                letterSpacing: '0.04em',
                backgroundColor: (bottomTab === 'testcases' && !termCollapsed) ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
                color: (bottomTab === 'testcases' && !termCollapsed) ? (isDark ? '#10b981' : '#059669') : textMuted,
                borderBottom: (bottomTab === 'testcases' && !termCollapsed) ? '2px solid #10b981' : '2px solid transparent',
                userSelect: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <CheckSquare size={15} />
              <span>TEST CASES</span>
              <span style={{
                fontSize: '0.72rem',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: (hasTested && passedTestsCount === testCases.length && testCases.length > 0)
                  ? '#10b981'
                  : (testCases.some(t => t.status === 'failed') ? '#ef4444' : (isDark ? '#374151' : '#e5e7eb')),
                color: (hasTested || testCases.some(t => t.status === 'failed')) ? '#ffffff' : (isDark ? '#d1d5db' : '#4b5563'),
                fontWeight: 'bold',
                marginLeft: '4px'
              }}>
                {hasTested ? `${passedTestsCount}/${testCases.length}` : testCases.length}
              </span>
            </button>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {bottomTab === 'terminal' ? (
              <button
                onClick={() => setOutput([])}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 12px', borderRadius: '5px', border: `1px solid ${border}`,
                  background: isDark ? '#333' : '#fff',
                  color: textMuted, fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer',
                }}
              >
                <Trash2 size={13} /> Clear
              </button>
            ) : (
              <button
                onClick={handleRunAllTestCases}
                disabled={isRunningTests || isRunning}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 12px', borderRadius: '5px', border: `1px solid ${isDark ? 'rgba(52, 211, 153, 0.3)' : '#10b981'}`,
                  backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : '#10b981',
                  color: isDark ? '#34d399' : '#ffffff',
                  fontSize: '0.78rem', fontWeight: '700', cursor: (isRunningTests || isRunning) ? 'not-allowed' : 'pointer',
                  opacity: (isRunningTests || isRunning) ? 0.6 : 1,
                }}
              >
                <PlayCircle size={13} /> Run All
              </button>
            )}
            <button
              onClick={() => setTermCollapsed(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '28px', height: '28px', borderRadius: '4px', border: 'none',
                background: 'transparent', color: textMuted, cursor: 'pointer',
              }}
            >
              {termCollapsed ? <ZoomIn size={14} /> : <ZoomOut size={14} />}
            </button>
          </div>
        </div>

        {/* Body */}
        {!termCollapsed && (
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: termBg }}>
            {bottomTab === 'terminal' ? (
              <div style={{
                padding: '10px 16px',
                fontFamily: '"Consolas", "Courier New", monospace',
                fontSize: '0.82rem', lineHeight: '1.7',
              }}>
                {output.length === 0 ? (
                  <span style={{ color: isDark ? '#555' : '#9ca3af', fontStyle: 'italic' }}>
                    Press Run to compile and execute your C# code…
                  </span>
                ) : (
                  output.map((line, i) => (
                    <div key={i} style={{
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      color:
                        line.type === 'err'      ? '#f87171' :
                        line.type === 'info'     ? (isDark ? '#6b7280' : '#9ca3af') :
                        line.type === 'exit-ok'  ? (isDark ? '#6b7280' : '#9ca3af') :
                        line.type === 'exit-err' ? '#f87171' :
                                                  (isDark ? '#d4d4d4' : '#1e1e1e'),
                      fontStyle: line.type === 'info' ? 'italic' : 'normal',
                    }}>
                      {line.text}
                    </div>
                  ))
                )}
                {isRunning && programStarted && (
                  <div style={{
                    display: 'flex', alignItems: 'center', marginTop: '8px',
                    padding: '4px 8px', borderRadius: '4px',
                    backgroundColor: isDark ? '#252525' : '#f3f4f6',
                    border: isDark ? '1px solid #3c3c3c' : '1px solid #e5e7eb',
                  }}>
                    <span style={{ marginRight: '8px', color: '#10b981', fontWeight: 'bold' }}>{'>'}</span>
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (socketRef.current) {
                            socketRef.current.emit('terminal_input', inputValue);
                          }
                          addLine(inputValue, 'out');
                          setInputValue('');
                        }
                      }}
                      autoFocus
                      style={{
                        flex: 1, border: 'none', outline: 'none', background: 'transparent',
                        color: isDark ? '#E8EAED' : '#111827',
                        fontFamily: '"Consolas", "Courier New", monospace', fontSize: '0.82rem',
                      }}
                      placeholder="Type input here and press Enter..."
                    />
                  </div>
                )}
                <div ref={termEndRef} />
              </div>
            ) : (
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {testCases.map((tc, idx) => (
                  <div key={tc.id} style={{
                    border: `1px solid ${border}`,
                    borderRadius: '8px',
                    backgroundColor: isDark ? '#262626' : '#f9fafb',
                    padding: '12px',
                    display: 'flex', flexDirection: 'column', gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: textMain, fontSize: '0.9rem' }}>{tc.name}</strong>
                      {tc.status === 'passed' && <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem' }}>Passed</span>}
                      {tc.status === 'failed' && <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.8rem' }}>Failed</span>}
                      {tc.status === 'running' && <span style={{ color: '#3b82f6', fontStyle: 'italic', fontSize: '0.8rem' }}>Running...</span>}
                      {tc.status === 'error' && <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.8rem' }}>Error</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: textMuted, marginBottom: '4px' }}>Input</div>
                        <input
                          type="text"
                          value={tc.input}
                          onChange={(e) => setTestCases(prev => prev.map(t => t.id === tc.id ? { ...t, input: e.target.value } : t))}
                          style={{
                            width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${border}`,
                            backgroundColor: editorBg, color: textMain, fontSize: '0.8rem'
                          }}
                          placeholder="e.g. 5 10"
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: textMuted, marginBottom: '4px' }}>Expected Output</div>
                        <input
                          type="text"
                          value={tc.expectedOutput}
                          onChange={(e) => setTestCases(prev => prev.map(t => t.id === tc.id ? { ...t, expectedOutput: e.target.value } : t))}
                          style={{
                            width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${border}`,
                            backgroundColor: editorBg, color: textMain, fontSize: '0.8rem'
                          }}
                          placeholder="Expected result"
                        />
                      </div>
                    </div>
                    {(tc.status === 'failed' || tc.status === 'error') && (
                      <div style={{
                        marginTop: '8px', padding: '8px', borderRadius: '4px',
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                        border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.2)' : '#fecaca'}`,
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold', marginBottom: '4px' }}>Actual Output:</div>
                        <pre style={{ margin: 0, fontSize: '0.8rem', color: isDark ? '#fca5a5' : '#b91c1c', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                          {tc.actualOutput || tc.errorMessage || 'No output'}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setTestCases(prev => [...prev, { id: Date.now(), name: `Test ${prev.length + 1}`, input: '', expectedOutput: '', isHidden: false }])}
                  style={{
                    padding: '8px', borderRadius: '6px', border: `1px dashed ${border}`,
                    backgroundColor: 'transparent', color: textMuted, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    fontSize: '0.85rem', fontWeight: '600'
                  }}
                >
                  <Plus size={14} /> Add Test Case
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
