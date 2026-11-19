import StudentViewTerminalHeader from './StudentViewTerminalHeader';
import StudentViewTestCaseDetail from './StudentViewTestCaseDetail';
import StudentViewTerminalOutput from './StudentViewTerminalOutput';
import { studentViewStyles as styles } from '../../utils/studentViewStyles';

export default function StudentViewTerminalPanel({
  bottomTab,
  setBottomTab,
  isDark,
  submitted,
  isTerminalCollapsed,
  isTerminalMaximized,
  terminalHeight,
  isResizingTerminal,
  handleDividerMouseDown,
  toggleTerminalCollapse,
  toggleTerminalMaximize,
  testCases,
  passedTestsCount,
  hasTested,
  handleClearTerminal,
  handleAddTestCase,
  handleRunTestCase,
  handleRunAllTestCases,
  isRunningTests,
  isRunning,
  programStarted,
  inputValue,
  setInputValue,
  handleTerminalInput,
  copiedInternallyRef,
  addProctorLog,
  strictClipboardBlocking = true,
  output,
  terminalBodyRef,
  terminalEndRef,
  activeTestCaseId,
  setActiveTestCaseId,
  handleDeleteTestCase,
  handleUpdateTestCase
}) {
  return (
    <>
      {/* Resizable Divider Handle */}
      <div
        onMouseDown={handleDividerMouseDown}
        onTouchStart={handleDividerMouseDown}
        style={{
          ...styles.resizeHandle,
          backgroundColor: isResizingTerminal
            ? '#10b981'
            : isDark
            ? '#2d2d2d'
            : '#e5e7eb',
          borderColor: isDark ? '#3c3c3c' : '#d1d5db',
          display: isTerminalMaximized ? 'none' : 'flex'
        }}
        title="Drag up or down to resize terminal"
      >
        <div
          style={{
            ...styles.resizeHandleGrip,
            width: '48px',
            height: '4px',
            borderRadius: '4px',
            backgroundColor: isResizingTerminal ? '#ffffff' : isDark ? '#555555' : '#9ca3af'
          }}
        />
      </div>

      <div
        style={{
          ...styles.terminalWrapper,
          height: isTerminalCollapsed ? '38px' : isTerminalMaximized ? '100%' : `${terminalHeight}px`,
          minHeight: isTerminalCollapsed ? '38px' : '60px',
          transition: isResizingTerminal ? 'none' : 'height 0.15s ease',
          ...(isTerminalMaximized ? { flex: 1 } : {}),
          ...(isDark ? { backgroundColor: '#1e1e1e', borderTop: '1px solid #3c3c3c' } : {})
        }}
      >
        <StudentViewTerminalHeader
          bottomTab={bottomTab}
          setBottomTab={setBottomTab}
          isDark={isDark}
          submitted={submitted}
          isTerminalCollapsed={isTerminalCollapsed}
          isTerminalMaximized={isTerminalMaximized}
          handleDividerMouseDown={handleDividerMouseDown}
          toggleTerminalCollapse={toggleTerminalCollapse}
          toggleTerminalMaximize={toggleTerminalMaximize}
          testCases={testCases}
          passedTestsCount={passedTestsCount}
          hasTested={hasTested}
          handleClearTerminal={handleClearTerminal}
          handleAddTestCase={handleAddTestCase}
          handleRunTestCase={handleRunTestCase}
          handleRunAllTestCases={handleRunAllTestCases}
          isRunningTests={isRunningTests}
          isRunning={isRunning}
        />

        {/* Tab Content */}
        {bottomTab === 'terminal' ? (
          <StudentViewTerminalOutput
            output={output}
            isDark={isDark}
            isRunning={isRunning}
            programStarted={programStarted}
            inputValue={inputValue}
            setInputValue={setInputValue}
            handleTerminalInput={handleTerminalInput}
            submitted={submitted}
            copiedInternallyRef={copiedInternallyRef}
            addProctorLog={addProctorLog}
            strictClipboardBlocking={strictClipboardBlocking}
            terminalBodyRef={terminalBodyRef}
            terminalEndRef={terminalEndRef}
          />
        ) : (
          <StudentViewTestCaseDetail
            testCases={testCases}
            activeTestCaseId={activeTestCaseId}
            setActiveTestCaseId={setActiveTestCaseId}
            handleAddTestCase={handleAddTestCase}
            handleDeleteTestCase={handleDeleteTestCase}
            handleUpdateTestCase={handleUpdateTestCase}
            submitted={submitted}
            isDark={isDark}
          />
        )}
      </div>
    </>
  );
}
