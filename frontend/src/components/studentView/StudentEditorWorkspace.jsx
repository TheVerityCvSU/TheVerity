import StudentViewFileTabs from './StudentViewFileTabs';
import StudentCodeEditor from './StudentCodeEditor';
import { studentViewStyles as styles } from '../../utils/studentViewStyles';

export default function StudentEditorWorkspace({
  isDark,
  submitted,
  filesHook,
  editorFontSize,
  editorRef,
  monacoRef,
  diagnosticsRef,
  compilerHook,
  handleSaveCode,
  kioskHook,
  studentActualId,
  safeUsername,
  assignmentId,
  studentDisplayName,
  currentUser,
  classroom,
  classroomId,
  assignment,
  copiedInternallyRef,
  layout
}) {
  return (
    <>
      <StudentViewFileTabs
        isDark={isDark}
        submitted={submitted}
        activeFileId={filesHook.activeFileId}
        setActiveFileId={filesHook.setActiveFileId}
        extraFiles={filesHook.extraFiles}
        renamingFileId={filesHook.renamingFileId}
        setRenamingFileId={filesHook.setRenamingFileId}
        renameValue={filesHook.renameValue}
        setRenameValue={filesHook.setRenameValue}
        handleAddFile={filesHook.handleAddFile}
        handleDeleteFile={filesHook.handleDeleteFile}
        handleRenameFile={filesHook.handleRenameFile}
      />

      <div style={styles.editorWrapper}>
        <StudentCodeEditor
          isDark={isDark}
          activeCode={filesHook.activeCode}
          submitted={submitted}
          editorFontSize={editorFontSize}
          editorRef={editorRef}
          monacoRef={monacoRef}
          diagnosticsRef={diagnosticsRef}
          updateEditorMarkers={compilerHook.updateEditorMarkers}
          handleSaveCode={handleSaveCode}
          activeFileId={filesHook.activeFileId}
          setCode={filesHook.setCode}
          codeRef={filesHook.codeRef}
          draftKey={filesHook.draftKey}
          studentId={studentActualId}
          safeUsername={safeUsername}
          assignmentId={assignmentId}
          setCodeHistory={filesHook.setCodeHistory}
          persistHistory={filesHook.persistHistory}
          emitToSockets={compilerHook.emitToSockets}
          studentActualId={studentActualId}
          studentDisplayName={studentDisplayName}
          currentUser={currentUser}
          classroom={classroom}
          classroomId={classroomId}
          assignment={assignment}
          proctorLogsRef={kioskHook.proctorLogsRef}
          proctorLogs={kioskHook.proctorLogs}
          handleExtraFileCodeChange={filesHook.handleExtraFileCodeChange}
          copiedInternallyRef={copiedInternallyRef}
          addProctorLog={kioskHook.addProctorLog}
          isResizingTerminal={layout.isResizingTerminal}
          handleDividerMouseDown={layout.handleDividerMouseDown}
        />
      </div>
    </>
  );
}
