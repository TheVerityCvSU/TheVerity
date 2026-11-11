import React from 'react';
import TeacherViewGradeModal from './TeacherViewGradeModal';
import TeacherViewSettingsModal from './TeacherViewSettingsModal';
import TeacherViewToast from './TeacherViewToast';

export default function TeacherViewModals({
  showGradeModal,
  setShowGradeModal,
  activeStudent,
  assignment,
  gradeInput,
  setGradeInput,
  feedbackInput,
  setFeedbackInput,
  handleSaveGrade,
  theme,
  showSettingsModal,
  setShowSettingsModal,
  isDark,
  toggleDarkMode,
  editorFontSize,
  setEditorFontSize,
  toast,
}) {
  return (
    <>
      <TeacherViewGradeModal
        show={showGradeModal}
        onClose={() => setShowGradeModal(false)}
        activeStudent={activeStudent}
        assignment={assignment}
        gradeInput={gradeInput}
        setGradeInput={setGradeInput}
        feedbackInput={feedbackInput}
        setFeedbackInput={setFeedbackInput}
        onSaveGrade={handleSaveGrade}
        theme={theme}
      />

      <TeacherViewSettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        isDark={isDark}
        toggleDarkMode={toggleDarkMode}
        editorFontSize={editorFontSize}
        setEditorFontSize={setEditorFontSize}
        theme={theme}
      />

      <TeacherViewToast toast={toast} isDark={isDark} />
    </>
  );
}
