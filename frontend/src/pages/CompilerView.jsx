import { useState, useRef, useEffect } from 'react';
import '../utils/monaco/monacoConfig.js';
import Editor from '@monaco-editor/react';
import { useDarkMode } from '../hooks/useDarkMode';
import { registerMonacoSnippets } from '../utils/monaco/registerMonacoSnippets.js';
import { getCompilerMonacoOptions } from '../utils/monaco/compilerMonacoOptions';
import {
  DEFAULT_TERMINAL_H,
  loadSavedCode,
  persistCode,
  loadSavedExtraFiles,
  persistExtraFiles,
} from '../data/compilerService';
import { getCompilerTheme } from '../components/compiler/compilerStyles';
import { useCompilerRunner } from '../hooks/useCompilerRunner';
import CompilerToolbar from '../components/compiler/CompilerToolbar';
import CompilerFileTabs from '../components/compiler/CompilerFileTabs';
import CompilerTerminal from '../components/compiler/CompilerTerminal';

export default function CompilerView() {
  const { isDark } = useDarkMode();
  const theme = getCompilerTheme(isDark);

  const [code, setCode] = useState(loadSavedCode);
  const [extraFiles, setExtraFiles] = useState(loadSavedExtraFiles);
  const [activeFileId, setActiveFileId] = useState('main');
  const [renamingFileId, setRenamingFileId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [fontSize, setFontSize] = useState(14);

  // Test Cases State
  const [bottomTab, setBottomTab] = useState('terminal');
  const [testCases, setTestCases] = useState([{ id: 1, name: 'Test 1', input: '', expectedOutput: '', isHidden: false }]);
  const [hasTested, setHasTested] = useState(false);

  // Terminal resize (drag handle)
  const [termH, setTermH] = useState(DEFAULT_TERMINAL_H);
  const [termCollapsed, setTermCollapsed] = useState(false);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHRef = useRef(DEFAULT_TERMINAL_H);

  const editorRef = useRef(null);
  const containerRef = useRef(null);

  const {
    output,
    setOutput,
    isRunning,
    programStarted,
    inputValue,
    setInputValue,
    isRunningTests,
    termEndRef,
    runCode: executeRunCode,
    handleStop,
    handleSendInput,
    runTestCases: executeRunTestCases,
  } = useCompilerRunner();

  useEffect(() => {
    const t = setTimeout(() => editorRef.current?.layout(), 30);
    return () => clearTimeout(t);
  }, [termH, termCollapsed]);

  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize });
  }, [fontSize]);

  const handleAddFile = () => {
    const num = extraFiles.length + 2;
    const newFile = {
      id: `file_${Date.now()}`,
      name: `File${num}`,
      code: `using System;\n\npublic class File${num}\n{\n    // Add your code or helper methods here\n}\n`,
    };
    const updated = [...extraFiles, newFile];
    setExtraFiles(updated);
    persistExtraFiles(updated);
    setActiveFileId(newFile.id);
  };

  const handleDeleteFile = (id) => {
    const updated = extraFiles.filter((f) => f.id !== id);
    setExtraFiles(updated);
    persistExtraFiles(updated);
    if (activeFileId === id) setActiveFileId('main');
  };

  const handleRenameFile = (id, newName) => {
    const cleaned = (newName || '').replace(/\.[a-zA-Z0-9]+$/i, '').trim();
    const safeName = cleaned.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'File';
    const updated = extraFiles.map((f) => (f.id === id ? { ...f, name: safeName } : f));
    setExtraFiles(updated);
    persistExtraFiles(updated);
    setRenamingFileId(null);
  };

  const handleCodeChange = (newCode) => {
    if (activeFileId === 'main') {
      setCode(newCode);
      persistCode(newCode);
    } else {
      const updated = extraFiles.map((f) => (f.id === activeFileId ? { ...f, code: newCode } : f));
      setExtraFiles(updated);
      persistExtraFiles(updated);
    }
  };

  const activeCode = activeFileId === 'main' ? code : extraFiles.find((f) => f.id === activeFileId)?.code ?? '';

  const runCode = () => {
    executeRunCode(code, extraFiles, () => {
      setTermCollapsed(false);
      setBottomTab('terminal');
    });
  };

  const handleRunAllTestCases = () => {
    executeRunTestCases(code, extraFiles, testCases, setTestCases, setHasTested, () => {
      setBottomTab('testcases');
      setTermCollapsed(false);
    });
  };

  const passedTestsCount = testCases.filter((t) => t.status === 'passed').length;

  const onDividerDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsResizingTerminal(true);

    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    startYRef.current = clientY;

    let curHeight = termH;
    if (termCollapsed) {
      curHeight = 36;
      setTermCollapsed(false);
    }
    startHRef.current = curHeight;
    setTermH(curHeight);

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!isDraggingRef.current) return;
      const currentY = ev.clientY ?? ev.touches?.[0]?.clientY;
      if (currentY === undefined) return;
      const delta = startYRef.current - currentY;
      const minHeight = 60;
      const maxHeight = Math.max(minHeight, Math.round(window.innerHeight * 0.85));
      setTermH(Math.max(minHeight, Math.min(startHRef.current + delta, maxHeight)));
      editorRef.current?.layout();
    };

    const onUp = () => {
      isDraggingRef.current = false;
      setIsResizingTerminal(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      setTimeout(() => editorRef.current?.layout(), 50);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        overflow: 'hidden',
        backgroundColor: theme.editorBg,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <CompilerToolbar
        runCode={runCode}
        handleStop={handleStop}
        isRunning={isRunning}
        fontSize={fontSize}
        setFontSize={setFontSize}
        theme={theme}
        isDark={isDark}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          backgroundColor: theme.editorBg,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <CompilerFileTabs
          activeFileId={activeFileId}
          setActiveFileId={setActiveFileId}
          extraFiles={extraFiles}
          handleAddFile={handleAddFile}
          handleDeleteFile={handleDeleteFile}
          handleRenameFile={handleRenameFile}
          renamingFileId={renamingFileId}
          setRenamingFileId={setRenamingFileId}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          theme={theme}
          isDark={isDark}
        />

        {/* Monaco Editor */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', pointerEvents: isResizingTerminal ? 'none' : 'auto' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}>
            <Editor
              height="100%"
              width="100%"
              language="csharp"
              value={activeCode}
              onChange={(v) => handleCodeChange(v ?? '')}
              theme={isDark ? 'vs-dark' : 'light'}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                registerMonacoSnippets(monaco);
                if (monaco.languages.typescript) {
                  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });
                  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });
                }
                [50, 150, 400, 900].forEach((ms) => setTimeout(() => editorRef.current?.layout(), ms));
                editor.focus();
              }}
              options={getCompilerMonacoOptions(fontSize)}
            />
          </div>
        </div>
      </div>

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

      <CompilerTerminal
        termH={termH}
        termCollapsed={termCollapsed}
        setTermCollapsed={setTermCollapsed}
        isResizingTerminal={isResizingTerminal}
        onDividerDown={onDividerDown}
        bottomTab={bottomTab}
        setBottomTab={setBottomTab}
        output={output}
        setOutput={setOutput}
        isRunning={isRunning}
        programStarted={programStarted}
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSendInput={handleSendInput}
        termEndRef={termEndRef}
        testCases={testCases}
        setTestCases={setTestCases}
        isRunningTests={isRunningTests}
        hasTested={hasTested}
        passedTestsCount={passedTestsCount}
        handleRunAllTestCases={handleRunAllTestCases}
        theme={theme}
        isDark={isDark}
      />
    </div>
  );
}
