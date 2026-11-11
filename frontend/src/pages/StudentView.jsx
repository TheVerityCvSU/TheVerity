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

export default function StudentView({
  socket,
  currentUser,
  username,
  assignment,
  classroom,
  onBack,
  isSandbox = false
}) {
  const { isDark, toggleDarkMode } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isDesktopWeb = !isSandbox && isDesktopWebBrowser();

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const diagnosticsRef = useRef([]);
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

  // If assignment is missing instructions/details, look up in cache or fetch
  useEffect(() => {
    const hasDetails = Boolean(
      currentAssignment?.details ||
      currentAssignment?.instruction ||
      currentAssignment?.instructions ||
      currentAssignment?.description
    );
    if (hasDetails) return;

    const cId = classroomId !== 'none' ? classroomId : (classroom?.id != null ? String(classroom.id) : null);
    if (cId) {
      try {
        const raw = localStorage.getItem(`verity_classwork_${cId}`);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const found = list.find((item) => String(item.id) === String(assignmentId));
            if (found && (found.details || found.instruction || found.instructions || found.description)) {
              setCurrentAssignment((prev) => ({ ...(prev || {}), ...found }));
              return;
            }
          }
        }
      } catch (_) {}

      try {
        const globalRaw =
          localStorage.getItem('verity_cached_classwork') ||
          localStorage.getItem(`verity_cached_classwork_${currentUser?.id || currentUser?.email}`);
        if (globalRaw) {
          const list = JSON.parse(globalRaw);
          if (Array.isArray(list)) {
            const found = list.find((item) => String(item.id) === String(assignmentId));
            if (found && (found.details || found.instruction || found.instructions || found.description)) {
              setCurrentAssignment((prev) => ({ ...(prev || {}), ...found }));
              return;
            }
          }
        }
      } catch (_) {}

      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/classwork/${cId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const list = data?.classwork || data?.assignments || (Array.isArray(data) ? data : []);
          const found = list.find((item) => String(item.id) === String(assignmentId));
          if (found && (found.details || found.instruction || found.instructions || found.description)) {
            setCurrentAssignment((prev) => ({ ...(prev || {}), ...found }));
          }
        })
        .catch(() => {});
    }
  }, [currentAssignment, classroomId, classroom?.id, assignmentId, currentUser]);

  const resolvedInstruction =
    currentAssignment?.details ||
    currentAssignment?.instruction ||
    currentAssignment?.instructions ||
    currentAssignment?.description ||
    '';

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

  // Test cases hook
  const testCasesHook = useStudentViewTestCases({
    ...studentCtx,
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
    onSingleTestResult: testCasesHook.handleSingleTestResult
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

  const handleSaveCode = useCallback(() => {
    if (submissionHook.submitted) return;
    try {
      localStorage.setItem(filesHook.draftKey, filesHook.code);
      setSaveStatus(true);
      setTimeout(() => setSaveStatus(false), 2000);
    } catch {}
  }, [submissionHook.submitted, filesHook.draftKey, filesHook.code]);

  const handleBackClick = useCallback(() => {
    if (!submissionHook.submitted && kioskHook.kioskRules?.lockdownActive) {
      alert('Workspace is currently locked for this assessment. Please submit your work before exiting.');
      return;
    }
    if (typeof onBack === 'function') onBack();
  }, [submissionHook.submitted, kioskHook.kioskRules?.lockdownActive, onBack]);

  const handleInstructionClick = useCallback((e) => {
    const target = e.target.closest('a');
    if (target?.href) {
      e.preventDefault();
      setPreviewIframe({ url: target.href, name: target.innerText || 'Reference Document', type: 'doc' });
    }
  }, []);

  const isBackBlocked = !submissionHook.submitted && Boolean(kioskHook.kioskRules?.lockdownActive);

  return (
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
      />

      <div style={styles.mainArea}>
        <StudentViewToolbar
          isSandbox={isSandbox}
          isDark={isDark}
          isBackBlocked={isBackBlocked}
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
          diagnosticsRef={diagnosticsRef}
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
        diagnosticsCount={diagnosticsRef.current?.length || 0}
        handleConfirmSubmit={submissionHook.handleConfirmSubmit}
        showUnsubmitModal={submissionHook.showUnsubmitModal}
        setShowUnsubmitModal={submissionHook.setShowUnsubmitModal}
        handleConfirmUnsubmit={submissionHook.handleConfirmUnsubmit}
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
  );
}
