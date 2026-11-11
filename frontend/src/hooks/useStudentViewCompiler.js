import { useState, useRef, useCallback, useEffect } from 'react';
import { useStudentViewCompilerSocket } from './useStudentViewCompilerSocket';

export function useStudentViewCompiler({
  socket,
  currentUser,
  assignment,
  classroom,
  assignmentId,
  classroomId,
  studentActualId,
  safeUsername,
  submitted,
  isDesktopWeb,
  vmDetected,
  kioskRules,
  code,
  extraFiles,
  setBottomTab,
  onTestResults,
  onSingleTestResult
}) {
  const [output, setOutput] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [programStarted, setProgramStarted] = useState(false);

  const terminalEndRef = useRef(null);
  const terminalBodyRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const diagnosticsRef = useRef([]);

  const { localSocket, emitToSockets, getCompilerSocket } = useStudentViewCompilerSocket({
    socket,
    currentUser
  });

  const updateEditorMarkers = (diagnostics = []) => {
    diagnosticsRef.current = diagnostics;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
      monaco.editor.setModelMarkers(model, 'csharp-compiler', []);
      return;
    }

    const markers = diagnostics.map((d) => {
      const startLine = Math.max(1, Math.min(d.startLineNumber || 1, model.getLineCount()));
      const lineContent = model.getLineContent(startLine) || '';
      const startCol = Math.max(1, Math.min(d.startColumn || 1, lineContent.length + 1));
      let endCol = d.endColumn;
      if (!endCol || endCol <= startCol) {
        const remaining = lineContent.substring(startCol - 1);
        const wordMatch = remaining.match(/^[a-zA-Z0-9_]+/);
        endCol = wordMatch && wordMatch[0].length > 0 ? startCol + wordMatch[0].length : Math.max(startCol + 1, lineContent.length + 1);
      }
      const endLine = Math.max(startLine, Math.min(d.endLineNumber || startLine, model.getLineCount()));

      return {
        severity: d.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
        message: d.message,
        startLineNumber: startLine,
        startColumn: startCol,
        endLineNumber: endLine,
        endColumn: endCol
      };
    });
    monaco.editor.setModelMarkers(model, 'csharp-compiler', markers);
  };

  // Compiler output streaming listeners
  useEffect(() => {
    const handleOutput = (dataChunk) => {
      setOutput((prev) => {
        const newOutput = prev + dataChunk;
        emitToSockets('student_terminal_update', {
          studentId: studentActualId,
          id: studentActualId,
          name: safeUsername,
          studentName: safeUsername,
          output: newOutput,
          classroomId: (classroom?.id != null ? String(classroom.id) : null) || (classroomId !== 'none' ? classroomId : null) || 'none',
          assignmentId: assignment?.id || assignmentId
        });
        return newOutput;
      });
      if (terminalEndRef.current) terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    };

    const handleStarted = () => setProgramStarted(true);
    const handleExit = () => {
      setIsRunning(false);
      setProgramStarted(false);
    };

    const bind = (sock) => {
      if (!sock) return () => { };
      sock.on('terminal_output', handleOutput);
      sock.on('program_started', handleStarted);
      sock.on('process_exit', handleExit);
      sock.on('compiler_diagnostics', updateEditorMarkers);
      if (onTestResults) sock.on('test_cases_results', onTestResults);
      if (onSingleTestResult) sock.on('test_case_result', onSingleTestResult);
      return () => {
        sock.off('terminal_output', handleOutput);
        sock.off('program_started', handleStarted);
        sock.off('process_exit', handleExit);
        sock.off('compiler_diagnostics', updateEditorMarkers);
        if (onTestResults) sock.off('test_cases_results', onTestResults);
        if (onSingleTestResult) sock.off('test_case_result', onSingleTestResult);
      };
    };

    const unbindPrimary = bind(socket);
    const unbindLocal = bind(localSocket);
    return () => {
      unbindPrimary();
      unbindLocal();
    };
  }, [socket, localSocket, safeUsername, studentActualId, classroom, assignment, classroomId, assignmentId, emitToSockets, onTestResults, onSingleTestResult]);

  const handleRunCode = () => {
    if (submitted) return;
    if (isDesktopWeb) {
      setBottomTab('terminal');
      setOutput('[ACCESS DENIED] Running exams in a desktop web browser is prohibited in the Computer Laboratory.\nPlease launch The Verity using The Verity.exe desktop application.\n');
      return;
    }
    if (vmDetected && kioskRules?.blockVirtualMachine !== false) {
      setBottomTab('terminal');
      setOutput('[ACCESS DENIED] Exam code execution is prohibited inside a Virtual Machine.\nPlease exit and run The Verity on a physical host computer.\n');
      return;
    }
    setBottomTab('terminal');
    updateEditorMarkers([]);
    setIsRunning(true);
    setProgramStarted(false);
    setOutput('');

    setTimeout(() => {
      setIsRunning((current) => {
        if (current) {
          setOutput((prev) => prev + '\n[Error: Compiler server did not respond after 15 seconds.]\n');
          setProgramStarted(false);
          return false;
        }
        return current;
      });
    }, 15000);

    const targetSocket = getCompilerSocket();
    if (!targetSocket || !targetSocket.connected) {
      setOutput('Error: No connection to compiler server. Please check your internet connection or restart the server.\n');
      setIsRunning(false);
      return;
    }

    emitToSockets('student_terminal_update', {
      studentId: safeUsername,
      output: 'Compiling...\n',
      classroomId: classroom?.id,
      assignmentId: assignment?.id
    });

    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    targetSocket.emit('compile_code', {
      code,
      extraFiles: extraFiles.map((f) => ({ name: f.name + '.cs', code: f.code })),
      token,
      user: currentUser
    });
  };

  const handleStopCode = () => {
    const targetSocket = getCompilerSocket();
    if (targetSocket) targetSocket.emit('stop_code');
    emitToSockets('student_terminal_update', {
      studentId: safeUsername,
      output: '[Process stopped by user]\n',
      classroomId: classroom?.id,
      assignmentId: assignment?.id
    });
    setIsRunning(false);
    setProgramStarted(false);
  };

  const handleTerminalInput = (e) => {
    if (submitted) return;
    if (e.key === 'Enter') {
      const targetSocket = getCompilerSocket();
      targetSocket.emit('terminal_input', inputValue);
      const newOutput = output + inputValue + '\n';
      setOutput(newOutput);
      emitToSockets('student_terminal_update', {
        studentId: safeUsername,
        output: newOutput,
        classroomId: classroom?.id,
        assignmentId: assignment?.id
      });
      setInputValue('');
    }
  };

  const handleClearTerminal = () => {
    setOutput('');
    emitToSockets('student_terminal_update', {
      studentId: safeUsername,
      output: '',
      classroomId: classroom?.id,
      assignmentId: assignment?.id
    });
  };

  return {
    output,
    setOutput,
    inputValue,
    setInputValue,
    isRunning,
    programStarted,
    terminalEndRef,
    terminalBodyRef,
    editorRef,
    monacoRef,
    diagnosticsRef,
    updateEditorMarkers,
    emitToSockets,
    getCompilerSocket,
    handleRunCode,
    handleStopCode,
    handleTerminalInput,
    handleClearTerminal
  };
}
