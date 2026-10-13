import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play, Square, TerminalSquare, Trash2,
  Copy, Check, ZoomIn, ZoomOut, Settings,
  CheckSquare, Plus, PlayCircle
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';

const TEMPLATES = {
  csharp: 'using System;\n\nclass Program {\n    static void Main(string[] args) {\n        Console.WriteLine("Hello, World!");\n    }\n}',
  python: 'print("Hello, World!")',
  javascript: 'console.log("Hello, World!");',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}'
};

const LANGUAGES = [
  { id: 'csharp', label: 'C#' },
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' },
];

const MIN_TERMINAL_H = 38;
const DEFAULT_TERMINAL_H = 240;
const MIN_FONT = 10;
const MAX_FONT = 24;

export default function CompilerView() {
  const { isDark } = useDarkMode();

  const [language, setLanguage] = useState('csharp');
  const [code, setCode]         = useState(TEMPLATES['csharp']);
  const [output, setOutput]     = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [programStarted, setProgramStarted] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [copied, setCopied]     = useState(false);
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

  // Relayout when terminal changes height
  useEffect(() => {
    const t = setTimeout(() => editorRef.current?.layout(), 30);
    return () => clearTimeout(t);
  }, [termH, termCollapsed]);

  // Live font size update
  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize });
  }, [fontSize]);

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

    setIsRunning(true);
    setProgramStarted(false);
    setTermCollapsed(false);
    setBottomTab('terminal');

    const langLabel = LANGUAGES.find(l => l.id === language)?.label || language;
    setOutput([{ text: `▶ Compiling ${langLabel} (Local)…`, type: 'info' }]);

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
      const socketUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001').replace(/\/$/, '');
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      let storedUser = null;
      try {
        const u = localStorage.getItem('currentUser');
        if (u) storedUser = JSON.parse(u);
      } catch (_) {}

      const socket = io(socketUrl, {
        timeout: 5000,
        transports: ['websocket', 'polling'],
        auth: { token }
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('compile_code', {
          language: language,
          code: code,
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
        addLine(`Error: Local compiler server unreachable at ${socketUrl}.`, 'err');
        cleanupRun();
      });

      socket.on('disconnect', () => {
        cleanupRun();
      });

      socket.on('error', (err) => {
        addLine(`Error: ${err?.message || 'Socket error'}`, 'err');
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
    if (!testCases || testCases.length === 0) return;
    setBottomTab('testcases');
    setIsRunningTests(true);
    setTestCases(prev => prev.map(tc => ({ ...tc, status: 'running', errorMessage: '', actualOutput: '' })));
    setTermCollapsed(false);

    try {
      const { io } = await import('socket.io-client');
      const socketUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001').replace(/\/$/, '');
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      let storedUser = null;
      try {
        const u = localStorage.getItem('currentUser');
        if (u) storedUser = JSON.parse(u);
      } catch (_) {}

      const socket = io(socketUrl, {
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
          code: code,
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

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Drag-to-resize terminal
  const onDividerDown = (e) => {
    if (termCollapsed) return;
    isDraggingRef.current = true;
    startYRef.current  = e.clientY;
    startHRef.current  = termH;
    document.body.style.cursor     = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!isDraggingRef.current) return;
      const delta = startYRef.current - ev.clientY;
      setTermH(Math.max(MIN_TERMINAL_H, Math.min(startHRef.current + delta, 520)));
    };
    const onUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
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

        {/* Right group: Language + Font adjuster + Copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={language}
            onChange={(e) => {
              const newLang = e.target.value;
              setLanguage(newLang);
              setCode(TEMPLATES[newLang]);
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: `1px solid ${border}`,
              backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
              color: textMain,
              fontSize: '0.82rem',
              fontWeight: '600',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {LANGUAGES.map(l => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>

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
        {/* File Tabs (matches StudentView) */}
        <div style={{
          display: 'flex', alignItems: 'center',
          height: '28px', flexShrink: 0,
          backgroundColor: tabsBg,
          borderBottom: tabsBdr,
          userSelect: 'none', overflowX: 'auto',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '0 12px', height: '100%',
            borderRight: tabsBdr,
            backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
            borderBottom: '2px solid #10b981',
            color: isDark ? '#e8eaed' : '#111827',
            fontSize: '0.75rem', fontWeight: '600',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.65rem', opacity: 0.55 }}>{'{ }'}</span>
            Program.cs
          </div>
        </div>

        {/* Monaco Editor */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}>
            <Editor
              height="100%"
              width="100%"
              language={language === 'cpp' ? 'cpp' : language}
              value={code}
              onChange={v => setCode(v ?? '')}
              theme={isDark ? 'vs-dark' : 'light'}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
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
            }}
          />
          </div>
        </div>
      </div>

      {/* ══ RESIZE HANDLE (matches StudentView resizeHandle) ═══ */}
      <div
        onMouseDown={onDividerDown}
        style={{
          height: '6px', flexShrink: 0,
          backgroundColor: handleBg,
          borderTop: `1px solid ${handleBdr}`,
          borderBottom: `1px solid ${handleBdr}`,
          cursor: termCollapsed ? 'default' : 'row-resize',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none',
          transition: 'background-color 0.15s ease',
        }}
      >
        <div style={{
          width: '36px', height: '2px',
          backgroundColor: isDark ? '#555555' : '#9ca3af',
          borderRadius: '2px',
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
        minHeight: termCollapsed ? '36px' : `${MIN_TERMINAL_H}px`,
        maxHeight: '75vh',
        transition: 'height 0.15s ease',
      }}>
        {/* Terminal header */}
        <div style={{
          height: '36px', minHeight: '36px', flexShrink: 0,
          backgroundColor: termHdrBg,
          borderBottom: termCollapsed ? 'none' : termHdrBdr,
          padding: '0 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
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
