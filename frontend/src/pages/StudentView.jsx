import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '../data/api';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { isDesktopWebBrowser } from '../utils/deviceUtils';
import { getStudentIdentity, checkLocalSubmitted } from '../utils/studentViewUtils';
import { studentViewStyles as styles } from '../utils/studentViewStyles';
import { useStudentViewFiles } from '../hooks/useStudentViewFiles';
import { useStudentViewTestCases } from '../hooks/useStudentViewTestCases';
import { useStudentViewCompiler } from '../hooks/useStudentViewCompiler';
import { useStudentViewKiosk } from '../hooks/useStudentViewKiosk';
import { useStudentViewSubmission } from '../hooks/useStudentViewSubmission';
import { useStudentViewLayout } from '../hooks/useStudentViewLayout';

import StudentViewToolbar from '../components/studentView/StudentViewToolbar';
import StudentViewInstructionSidebar from '../components/studentView/StudentViewInstructionSidebar';
import StudentEditorWorkspace from '../components/studentView/StudentEditorWorkspace';
import StudentViewTerminalPanel from '../components/studentView/StudentViewTerminalPanel';
import StudentViewModals from '../components/studentView/StudentViewModals';
import StudentViewSecurityModals from '../components/studentView/StudentViewSecurityModals';
import ErrorBoundary from '../components/ErrorBoundary';

export default function StudentView({
  socket,
  currentUser,
  username,
  assignment,
  classroom,
  onBack,
  isSandbox = false
}) {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isDesktopWeb = !isSandbox && isDesktopWebBrowser();

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const copiedInternallyRef = useRef(new Set());

  const [currentAssignment, setCurrentAssignment] = useState(() => {
    if (assignment) return assignment;
    try {
      const saved = localStorage.getItem('activeAssignment');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (assignment) {
      setCurrentAssignment(assignment);
    }
  }, [assignment]);

  const { safeUsername, studentActualId, assignmentId, classroomId, studentDisplayName } =
    getStudentIdentity(currentUser, username, currentAssignment || assignment, classroom);

  const extractInstructionText = (item) => {
    if (!item) return '';
    if (typeof item.details === 'string' && item.details.trim()) return item.details;
    if (typeof item.instruction === 'string' && item.instruction.trim()) return item.instruction;
    if (typeof item.instructions === 'string' && item.instructions.trim()) return item.instructions;
    if (typeof item.description === 'string' && item.description.trim()) {
      const raw = item.description.trim();
      if (raw.startsWith('{') && raw.endsWith('}')) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.details) return parsed.details;
          if (parsed.instruction) return parsed.instruction;
          if (parsed.instructions) return parsed.instructions;
          if (parsed.description) return parsed.description;
        } catch (_) {}
      }
      return raw;
    }
    return '';
  };

  const resolvedInstruction =
    extractInstructionText(currentAssignment) ||
    extractInstructionText(assignment) ||
    '';

  // If assignment is missing instructions/details, look up in cache or fetch
  useEffect(() => {
    if (resolvedInstruction) return;

    const findInList = (list) => {
      if (!Array.isArray(list)) return null;
      const found = list.find((item) => String(item.id) === String(assignmentId));
      if (found && extractInstructionText(found)) return found;
      return null;
    };

    const cId = classroomId !== 'none' ? classroomId : (classroom?.id != null ? String(classroom.id) : null);

    // 1. Check classroom specific storage
    if (cId) {
      try {
        const raw = localStorage.getItem(`verity_classwork_${cId}`);
        if (raw) {
          const match = findInList(JSON.parse(raw));
          if (match) {
            const ex = extractInstructionText(match);
            setCurrentAssignment((prev) => ({ ...(prev || {}), ...match, details: ex }));
            return;
          }
        }
      } catch (_) {}
    }

    // 2. Scan all localStorage keys for classwork
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('verity_classwork_') || key.startsWith('verity_cached_classwork') || key.startsWith('verity_cached_upcoming_activities'))) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const match = findInList(JSON.parse(raw));
            if (match) {
              const ex = extractInstructionText(match);
              setCurrentAssignment((prev) => ({ ...(prev || {}), ...match, details: ex }));
              return;
            }
          }
        }
      }
    } catch (_) {}

    // 3. Fetch from API (/classwork/:classroomId or /classwork)
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const fetchUrl = cId ? `${baseUrl}/classwork/${cId}` : `${baseUrl}/classwork`;

    apiFetch(fetchUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = data?.classwork || data?.assignments || (Array.isArray(data) ? data : []);
        const match = findInList(list);
        if (match) {
          const extracted = extractInstructionText(match);
          setCurrentAssignment((prev) => {
            const updated = { ...(prev || {}), ...match, details: extracted };
            try { localStorage.setItem('activeAssignment', JSON.stringify(updated)); } catch (_) {}
            return updated;
          });
        } else if (cId) {
          apiFetch(`${baseUrl}/classwork`)
            .then((r) => (r.ok ? r.json() : null))
            .then((allData) => {
              const allList = allData?.classwork || allData?.assignments || (Array.isArray(allData) ? allData : []);
              const m = findInList(allList);
              if (m) {
                const ex = extractInstructionText(m);
                setCurrentAssignment((prev) => {
                  const updated = { ...(prev || {}), ...m, details: ex };
                  try { localStorage.setItem('activeAssignment', JSON.stringify(updated)); } catch (_) {}
                  return updated;
                });
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [resolvedInstruction, classroomId, classroom?.id, assignmentId]);

  const [strictCompiler, setStrictCompiler] = useState(false);

  // Layout hook (sidebar, terminal, drawer resizing)
  const layout = useStudentViewLayout({ isMobile, editorRef });

  // Terminal vs Test cases bottom tab state
  const [bottomTab, setBottomTab] = useState('terminal');

  const studentCtx = {
    assignment: currentAssignment || assignment,
    classroom,
    assignmentId,
    classroomId,
    studentId: studentActualId,
    studentActualId,
    safeUsername,
    currentUser
  };
  const filesHook = useStudentViewFiles(studentCtx);

  const compilerHookRef = useRef(null);

  const [submitted, setSubmitted] = useState(() =>
    checkLocalSubmitted(classroomId, assignmentId, studentActualId, safeUsername, currentUser)
  );

  // Kiosk anti-cheat & proctor logs hook
  const kioskHook = useStudentViewKiosk({
    socket,
    currentUser,
    assignment: currentAssignment || assignment,
    classroom,
    assignmentId,
    classroomId,
    studentActualId,
    safeUsername,
    submitted,
    codeRef: filesHook.codeRef,
    codeHistoryRef: filesHook.codeHistoryRef,
    persistHistoryFn: filesHook.persistHistory,
    emitToSockets: (...args) => compilerHookRef.current?.emitToSockets?.(...args),
    setStrictCompiler
  });

  // Test cases hook
  const testCasesHook = useStudentViewTestCases({
    ...studentCtx,
    submitted,
    isDesktopWeb,
    vmDetected: kioskHook.vmDetected,
    kioskRules: kioskHook.kioskRules,
    code: filesHook.code,
    codeRef: filesHook.codeRef,
    setBottomTab,
    getCompilerSocket: () => compilerHookRef.current?.getCompilerSocket?.()
  });

  // Settings & Previews
  const [editorFontSize, setEditorFontSize] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_editor_font_size');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 14;
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [previewIframe, setPreviewIframe] = useState(null);
  const [saveStatus, setSaveStatus] = useState(false);

  // Compiler socket & code runner hook
  const compilerHook = useStudentViewCompiler({
    socket,
    currentUser,
    assignment: currentAssignment || assignment,
    classroom,
    assignmentId,
    classroomId,
    studentActualId,
    safeUsername,
    submitted,
    isDesktopWeb,
    vmDetected: kioskHook.vmDetected,
    kioskRules: kioskHook.kioskRules,
    code: filesHook.code,
    extraFiles: filesHook.extraFiles,
    setBottomTab,
    onTestResults: testCasesHook.handleTestResults,
    onSingleTestResult: testCasesHook.handleSingleTestResult,
    editorRef,
    monacoRef
  });
  compilerHookRef.current = compilerHook;

  // Submission hook
  const submissionHook = useStudentViewSubmission({
    socket,
    currentUser,
    assignment: currentAssignment || assignment,
    classroom,
    assignmentId,
    classroomId,
    studentId: studentActualId,
    safeUsername,
    isDesktopWeb,
    vmDetected: kioskHook.vmDetected,
    kioskRules: kioskHook.kioskRules,
    codeRef: filesHook.codeRef,
    codeHistoryRef: filesHook.codeHistoryRef,
    persistHistoryFn: filesHook.persistHistory,
    emitToSockets: compilerHook.emitToSockets,
    proctorLogs: kioskHook.proctorLogs,
    editorRef,
    handleStopCode: compilerHook.handleStopCode,
    isRunning: compilerHook.isRunning
  });

  useEffect(() => {
    if (submissionHook.submitted !== submitted) {
      setSubmitted(submissionHook.submitted);
    }
  }, [submissionHook.submitted, submitted]);

  // Keep submission state synced with editor
  useEffect(() => {
    if (submissionHook.submitted && editorRef.current) {
      editorRef.current.updateOptions({ readOnly: true, domReadOnly: true });
    }
  }, [submissionHook.submitted]);

  const effectiveAssignment = currentAssignment || assignment;

  // Broadcast live presence on mount, reconnect, and periodic heartbeat
  const emitPresence = useCallback(() => {
    if (isSandbox || submissionHook.submitted) return;
    const resolvedClassroomId =
      (classroom?.id != null ? String(classroom.id) : null) ||
      (classroomId !== 'none' ? classroomId : null) ||
      (effectiveAssignment?.classroomId != null ? String(effectiveAssignment.classroomId) : null) ||
      (effectiveAssignment?.classroom_id != null ? String(effectiveAssignment.classroom_id) : null) ||
      'none';
    const resolvedAssignmentId = effectiveAssignment?.id || assignmentId;
    if (!resolvedAssignmentId || resolvedAssignmentId === 'unassigned') return;

    const payload = {
      studentId: studentActualId,
      id: studentActualId,
      name: studentDisplayName || safeUsername,
      studentName: studentDisplayName || safeUsername,
      email: currentUser?.email || '',
      avatar: currentUser?.avatar || '',
      code: filesHook.codeRef?.current || filesHook.code || '',
      classroomId: resolvedClassroomId,
      classCode: classroom?.code || classroom?.section || effectiveAssignment?.classCode || '',
      assignmentId: resolvedAssignmentId,
      logs: kioskHook.proctorLogs || [],
      timestamp: Date.now()
    };
    compilerHook.emitToSockets('student_enter_activity', payload);
    compilerHook.emitToSockets('student_typing', payload);
  }, [
    isSandbox,
    submissionHook.submitted,
    classroom?.id,
    classroom?.code,
    classroom?.section,
    classroomId,
    effectiveAssignment?.id,
    effectiveAssignment?.classroomId,
    effectiveAssignment?.classroom_id,
    effectiveAssignment?.classCode,
    assignmentId,
    studentActualId,
    studentDisplayName,
    safeUsername,
    currentUser?.email,
    currentUser?.avatar,
    filesHook.codeRef,
    filesHook.code,
    kioskHook.proctorLogs,
    compilerHook.emitToSockets
  ]);

  useEffect(() => {
    if (isSandbox || submissionHook.submitted) return;
    emitPresence();

    const locSock = compilerHook.localSocket;
    const secSock = compilerHook.secondarySocket;
    if (socket) socket.on('connect', emitPresence);
    if (locSock) locSock.on('connect', emitPresence);
    if (secSock) secSock.on('connect', emitPresence);

    const presenceInterval = setInterval(emitPresence, 5000);
    return () => {
      if (socket) socket.off('connect', emitPresence);
      if (locSock) locSock.off('connect', emitPresence);
      if (secSock) secSock.off('connect', emitPresence);
      clearInterval(presenceInterval);
    };
  }, [isSandbox, submissionHook.submitted, emitPresence, socket, compilerHook.localSocket, compilerHook.secondarySocket]);

  const leaveInfoRef = useRef({
    studentId: studentActualId,
    studentName: studentDisplayName || safeUsername,
    classroomId,
    assignmentId: effectiveAssignment?.id || assignmentId
  });
  useEffect(() => {
    const resolvedClassroomId =
      (classroom?.id != null ? String(classroom.id) : null) ||
      (classroomId !== 'none' ? classroomId : null) ||
      (effectiveAssignment?.classroomId != null ? String(effectiveAssignment.classroomId) : null) ||
      (effectiveAssignment?.classroom_id != null ? String(effectiveAssignment.classroom_id) : null) ||
      'none';
    leaveInfoRef.current = {
      studentId: studentActualId,
      studentName: studentDisplayName || safeUsername,
      classroomId: resolvedClassroomId,
      assignmentId: effectiveAssignment?.id || assignmentId
    };
  }, [studentActualId, studentDisplayName, safeUsername, classroom?.id, classroomId, effectiveAssignment?.id, effectiveAssignment?.classroomId, effectiveAssignment?.classroom_id, assignmentId]);

  useEffect(() => {
    return () => {
      if (!isSandbox && leaveInfoRef.current) {
        compilerHookRef.current?.emitToSockets?.('student_leave_workspace', {
          ...leaveInfoRef.current,
          timestamp: Date.now()
        });
      }
    };
  }, [isSandbox]);

  const handleSaveCode = useCallback(() => {
    if (submissionHook.submitted) return;
    try {
      localStorage.setItem(filesHook.draftKey, filesHook.code);
      setSaveStatus(true);
      setTimeout(() => setSaveStatus(false), 2000);
      emitPresence();
    } catch {}
  }, [submissionHook.submitted, filesHook.draftKey, filesHook.code, emitPresence]);

  const isBackStrictLock = Boolean(effectiveAssignment?.disableBack || effectiveAssignment?.disable_back);
  const isBackBlocked = !submissionHook.submitted && (Boolean(kioskHook.kioskRules?.lockdownActive) || isBackStrictLock);

  const handleBackClick = useCallback(() => {
    if (isBackBlocked) {
      if (isBackStrictLock) {
        alert('Strict lockdown is enabled for this activity. You cannot exit until your work is submitted.');
      } else {
        alert('Workspace is currently locked for this assessment. Please submit your work before exiting.');
      }
      return;
    }
    if (!isSandbox && leaveInfoRef.current) {
      compilerHook.emitToSockets('student_leave_workspace', {
        ...leaveInfoRef.current,
        timestamp: Date.now()
      });
    }
    if (typeof onBack === 'function') onBack();
  }, [isBackBlocked, isBackStrictLock, isSandbox, compilerHook.emitToSockets, onBack]);

  useEffect(() => {
    if (!isBackStrictLock || submissionHook.submitted) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'This activity has strict lockdown enabled. Are you sure you want to exit?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isBackStrictLock, submissionHook.submitted]);

  const handleInstructionClick = useCallback((e) => {
    const target = e.target.closest('a');
    if (target?.href) {
      e.preventDefault();
      setPreviewIframe({ url: target.href, name: target.innerText || 'Reference Document', type: 'doc' });
    }
  }, []);

  return (
    <ErrorBoundary onNavigateFallback={() => { if (typeof onBack === 'function') onBack(); }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          ...styles.container,
          ...(isDark ? { backgroundColor: '#181818', color: '#E8EAED' } : {})
        }}
      >
        <StudentViewInstructionSidebar
          isSandbox={isSandbox}
          layout={layout}
          isMobile={isMobile}
          isDark={isDark}
          proctorLogs={kioskHook.proctorLogs || []}
          instruction={resolvedInstruction}
          handleInstructionClick={handleInstructionClick}
          assignment={currentAssignment || assignment}
          setPreviewImage={setPreviewImage}
          setPreviewVideo={setPreviewVideo}
          setPreviewIframe={setPreviewIframe}
        />

        <div style={styles.mainArea}>
          <StudentViewToolbar
            isSandbox={isSandbox}
            isDark={isDark}
            toggleDarkMode={toggleDarkMode}
            isBackBlocked={isBackBlocked}
            isBackStrictLock={isBackStrictLock}
            submitted={submissionHook.submitted}
            saveStatus={saveStatus}
            isRunning={compilerHook.isRunning}
            isRunningTests={testCasesHook.isRunningTests}
            strictCompiler={strictCompiler}
            handleBackClick={handleBackClick}
            handleSaveCode={handleSaveCode}
            handleRunCode={compilerHook.handleRunCode}
            handleStopCode={compilerHook.handleStopCode}
            handleSubmit={submissionHook.handleSubmit}
            handleUnsubmit={submissionHook.handleUnsubmit}
            setShowSettingsModal={setShowSettingsModal}
          />

          <StudentEditorWorkspace
            isDark={isDark}
            submitted={submissionHook.submitted}
            filesHook={filesHook}
            editorFontSize={editorFontSize}
            editorRef={editorRef}
            monacoRef={monacoRef}
            diagnosticsRef={compilerHook.diagnosticsRef}
            compilerHook={compilerHook}
            handleSaveCode={handleSaveCode}
            kioskHook={kioskHook}
            studentActualId={studentActualId}
            safeUsername={safeUsername}
            assignmentId={assignmentId}
            studentDisplayName={studentDisplayName}
            currentUser={currentUser}
            classroom={classroom}
            classroomId={classroomId}
            assignment={currentAssignment || assignment}
            copiedInternallyRef={copiedInternallyRef}
            layout={layout}
          />

          <StudentViewTerminalPanel
            bottomTab={bottomTab}
            setBottomTab={setBottomTab}
            isDark={isDark}
            submitted={submissionHook.submitted}
            isTerminalCollapsed={layout.isTerminalCollapsed}
            isTerminalMaximized={layout.isTerminalMaximized}
            terminalHeight={layout.terminalHeight}
            isResizingTerminal={layout.isResizingTerminal}
            handleDividerMouseDown={layout.handleDividerMouseDown}
            toggleTerminalCollapse={layout.toggleTerminalCollapse}
            toggleTerminalMaximize={layout.toggleTerminalMaximize}
            testCases={testCasesHook.testCases}
            passedTestsCount={testCasesHook.passedTestsCount}
            hasTested={testCasesHook.hasTested}
            handleClearTerminal={compilerHook.handleClearTerminal}
            handleAddTestCase={testCasesHook.handleAddTestCase}
            handleRunTestCase={testCasesHook.handleRunTestCase}
            handleRunAllTestCases={testCasesHook.handleRunAllTestCases}
            isRunningTests={testCasesHook.isRunningTests}
            isRunning={compilerHook.isRunning}
            programStarted={compilerHook.programStarted}
            inputValue={compilerHook.inputValue}
            setInputValue={compilerHook.setInputValue}
            handleTerminalInput={compilerHook.handleTerminalInput}
            copiedInternallyRef={copiedInternallyRef}
            addProctorLog={kioskHook.addProctorLog}
            output={compilerHook.output}
            terminalBodyRef={compilerHook.terminalBodyRef}
            terminalEndRef={compilerHook.terminalEndRef}
            activeTestCaseId={testCasesHook.activeTestCaseId}
            setActiveTestCaseId={testCasesHook.setActiveTestCaseId}
            handleDeleteTestCase={testCasesHook.handleDeleteTestCase}
            handleUpdateTestCase={testCasesHook.handleUpdateTestCase}
          />
        </div>

        <StudentViewModals
          showSettingsModal={showSettingsModal}
          setShowSettingsModal={setShowSettingsModal}
          isDark={isDark}
          toggleDarkMode={toggleDarkMode}
          editorFontSize={editorFontSize}
          setEditorFontSize={setEditorFontSize}
          previewImage={previewImage}
          setPreviewImage={setPreviewImage}
          previewVideo={previewVideo}
          setPreviewVideo={setPreviewVideo}
          previewIframe={previewIframe}
          setPreviewIframe={setPreviewIframe}
          showSubmitModal={submissionHook.showSubmitModal}
          setShowSubmitModal={submissionHook.setShowSubmitModal}
          strictCompiler={strictCompiler}
          diagnosticsCount={compilerHook.diagnosticsCount}
          handleConfirmSubmit={submissionHook.handleConfirmSubmit}
          showUnsubmitModal={submissionHook.showUnsubmitModal}
          setShowUnsubmitModal={submissionHook.setShowUnsubmitModal}
          handleConfirmUnsubmit={submissionHook.handleConfirmUnsubmit}
          activityTitle={currentAssignment?.title || assignment?.title || 'this activity'}
        />

        <StudentViewSecurityModals
          multiMonitorDetected={kioskHook.multiMonitorDetected}
          vmDetected={kioskHook.vmDetected}
          vmReasons={kioskHook.vmReasons}
          kioskRules={kioskHook.kioskRules}
          isDesktopWeb={isDesktopWeb}
          onBack={onBack}
        />
      </motion.div>
    </ErrorBoundary>
  );
}
