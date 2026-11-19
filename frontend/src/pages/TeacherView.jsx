/* eslint-disable react-hooks/set-state-in-effect, no-empty, react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useDarkMode } from '../hooks/useDarkMode';
import { getStudentGrade } from '../utils/gradeUtils';
import { getTeacherViewTheme } from '../utils/teacherViewTheme';
import { saveTeacherGrade } from '../utils/teacherGradeService';

import { useTeacherViewPlayback } from '../hooks/useTeacherViewPlayback';
import { useTeacherViewWarnings } from '../hooks/useTeacherViewWarnings';
import { useTeacherViewRoster } from '../hooks/useTeacherViewRoster';
import { useTeacherViewSocket } from '../hooks/useTeacherViewSocket';

import TeacherViewHeader from '../components/teacherview/TeacherViewHeader';
import TeacherViewSidebar from '../components/teacherview/TeacherViewSidebar';
import TeacherViewTimelineScrubber from '../components/teacherview/TeacherViewTimelineScrubber';
import TeacherViewTerminal from '../components/teacherview/TeacherViewTerminal';
import TeacherViewModals from '../components/teacherview/TeacherViewModals';

export default function TeacherView({
  socket,
  currentUser,
  assignment,
  classroom,
  initialStudent,
  onBack,
  onLogout,
  mode = 'live',
  onSwitchMode
}) {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const theme = useMemo(() => getTeacherViewTheme(isDark), [isDark]);

  const isCompact = useMediaQuery('(max-width: 1023px)');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [sidebarTab, setSidebarTab] = useState('roster');
  const [studentSearch, setStudentSearch] = useState('');
  const [terminalMode, setTerminalMode] = useState('normal');

  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(() =>
    parseInt(localStorage.getItem('verity_editor_font_size') || '15', 10)
  );
  const [gradeInput, setGradeInput] = useState(
    assignment?.points ? String(assignment.points) : '100'
  );
  const [feedbackInput, setFeedbackInput] = useState('');

  // 1. Roster and active coders hook
  const roster = useTeacherViewRoster({ assignment, classroom, initialStudent, mode, studentSearch });

  // 2. Persistent warning logs hook
  const warnings = useTeacherViewWarnings({
    assignment,
    classroom,
    students: roster.students,
    mode,
    selectedStudentId: roster.selectedStudentId,
    activeStudent: roster.activeStudent
  });

  // 3. Socket real-time monitoring hook
  const socketHook = useTeacherViewSocket({
    socket,
    currentUser,
    assignment,
    classroom,
    mode,
    setStudents: roster.setStudents,
    setSelectedStudentId: roster.setSelectedStudentId,
    setSubmittedStudentNames: roster.setSubmittedStudentNames,
    submittedStudentNamesRef: roster.submittedStudentNamesRef,
    mergeWarningLogs: warnings.mergeWarningLogs,
    activeStudent: roster.activeStudent
  });

  // 4. Playback and history calculations
  const rawHistory = roster.activeStudent.codeHistory || roster.activeStudent.history || [];
  const history =
    Array.isArray(rawHistory) && rawHistory.length > 0
      ? rawHistory
      : roster.activeStudent.code || roster.activeStudent.finalCode
      ? [{ time: Date.now(), code: roster.activeStudent.code || roster.activeStudent.finalCode }]
      : [];

  const hasPlayback =
    mode === 'playback' &&
    (roster.activeStudent.status === 'Submitted' || history.length > 0 || Boolean(roster.activeStudent.code || roster.activeStudent.finalCode));

  const playback = useTeacherViewPlayback({
    history,
    hasPlayback,
    selectedStudentId: roster.selectedStudentId,
    mode
  });

  let displayCode = roster.activeStudent.code || roster.activeStudent.finalCode || '';
  if (hasPlayback) {
    if (playback.playbackIndex >= 0 && history[playback.playbackIndex]) {
      displayCode = history[playback.playbackIndex].code;
    } else if (history.length > 0) {
      displayCode = history[history.length - 1]?.code || displayCode;
    }
  }

  // Pre-populate grade form
  useEffect(() => {
    if (roster.selectedStudentId && assignment?.id) {
      const gradesKey = `verity_grades_${assignment.id}`;
      try {
        const savedGrades = JSON.parse(localStorage.getItem(gradesKey)) || {};
        const curStudent = roster.students[roster.selectedStudentId] || { id: roster.selectedStudentId };
        const saved = getStudentGrade(savedGrades, curStudent);
        if (saved) {
          if (saved.grade != null) setGradeInput(String(saved.grade));
          if (saved.feedback != null) setFeedbackInput(saved.feedback);
        } else {
          setGradeInput(assignment?.points ? String(assignment.points) : '100');
          setFeedbackInput('');
        }
      } catch {}
    }
  }, [roster.selectedStudentId, assignment?.id, roster.students]);

  const handleSaveGrade = () => {
    saveTeacherGrade({
      assignmentId: assignment?.id,
      selectedStudentId: roster.selectedStudentId,
      studentName: roster.activeStudent.name,
      gradeInput,
      feedbackInput,
      setStudents: roster.setStudents,
      setToast: socketHook.setToast,
      onCloseModal: () => setShowGradeModal(false)
    });
  };

  return (
    <div
      style={{
        height: '100vh', maxHeight: '100vh', width: '100vw', maxWidth: '100%',
        display: 'flex', flexDirection: 'column', backgroundColor: theme.bg,
        color: theme.textPrimary, fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflow: 'hidden', boxSizing: 'border-box'
      }}
    >
      <TeacherViewHeader
        onBack={onBack}
        onLogout={onLogout}
        isMobile={isMobile}
        isDark={isDark}
        theme={theme}
        assignment={assignment}
        classroom={classroom}
        mode={mode}
        activeStudent={roster.activeStudent}
        evaluating={socketHook.evaluating}
        handleEvaluate={socketHook.handleEvaluate}
        handleStopCode={socketHook.handleStopCode}
        setShowGradeModal={setShowGradeModal}
        setShowSettingsModal={setShowSettingsModal}
      />

      <div
        style={{
          flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden', position: 'relative', minHeight: 0
        }}
      >
        {isCompact && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', top: isMobile ? '56px' : '62px', left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(2px)', zIndex: 45
            }}
          />
        )}

        <TeacherViewSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sidebarTab={sidebarTab}
          setSidebarTab={setSidebarTab}
          studentSearch={studentSearch}
          setStudentSearch={setStudentSearch}
          isMobile={isMobile}
          isCompact={isCompact}
          windowWidth={windowWidth}
          isDark={isDark}
          theme={theme}
          mode={mode}
          visibleStudents={roster.visibleStudents}
          allLogs={warnings.allLogs}
          activeStudentWarnings={warnings.activeStudentWarnings}
          students={roster.students}
          selectedStudentId={roster.selectedStudentId}
          setSelectedStudentId={roster.setSelectedStudentId}
          activeStudent={roster.activeStudent}
          onSeekToWarning={playback.handleScrub}
        />

        <main
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            minWidth: 0, minHeight: 0, backgroundColor: theme.bg
          }}
        >
          {terminalMode !== 'maximized' && (
            <div
              style={{
                flex: terminalMode === 'collapsed' ? 1 : 2,
                minHeight: '180px', width: '100%', position: 'relative', overflow: 'hidden'
              }}
            >
              <Editor
                height="100%"
                width="100%"
                language="csharp"
                theme={isDark ? 'vs-dark' : 'light'}
                value={displayCode}
                options={{
                  fontSize: editorFontSize,
                  minimap: { enabled: (windowWidth || 1200) >= 1200 },
                  readOnly: true,
                  automaticLayout: true,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderLineHighlight: 'all',
                  scrollBeyondLastLine: false,
                  fontFamily: 'Consolas, "Courier New", monospace'
                }}
              />
            </div>
          )}

          {hasPlayback && terminalMode !== 'maximized' && (
            <TeacherViewTimelineScrubber
              history={history}
              playbackIndex={playback.playbackIndex}
              isPlaying={playback.isPlaying}
              playbackSpeed={playback.playbackSpeed}
              setPlaybackSpeed={playback.setPlaybackSpeed}
              playbackSpeedRef={playback.playbackSpeedRef}
              cumulativeTimes={playback.cumulativeTimes}
              totalPlaybackDuration={playback.totalPlaybackDuration}
              togglePlay={playback.togglePlay}
              handleScrub={playback.handleScrub}
              progressLineRef={playback.progressLineRef}
              progressThumbRef={playback.progressThumbRef}
              timeDisplayRef={playback.timeDisplayRef}
              smoothProgressRef={playback.smoothProgressRef}
              currentAnimTimeRef={playback.currentAnimTimeRef}
              activeStudentWarnings={warnings.activeStudentWarnings}
              theme={theme}
              isDark={isDark}
              isMobile={isMobile}
            />
          )}

          <TeacherViewTerminal
            terminalMode={terminalMode}
            setTerminalMode={setTerminalMode}
            evaluating={socketHook.evaluating}
            evalOutput={socketHook.evalOutput}
            setEvalOutput={socketHook.setEvalOutput}
            activeStudent={roster.activeStudent}
            theme={theme}
            isDark={isDark}
            isMobile={isMobile}
          />
        </main>
      </div>

      <TeacherViewModals
        showGradeModal={showGradeModal}
        setShowGradeModal={setShowGradeModal}
        activeStudent={roster.activeStudent}
        assignment={assignment}
        gradeInput={gradeInput}
        setGradeInput={setGradeInput}
        feedbackInput={feedbackInput}
        setFeedbackInput={setFeedbackInput}
        handleSaveGrade={handleSaveGrade}
        theme={theme}
        showSettingsModal={showSettingsModal}
        setShowSettingsModal={setShowSettingsModal}
        isDark={isDark}
        toggleDarkMode={toggleDarkMode}
        editorFontSize={editorFontSize}
        setEditorFontSize={setEditorFontSize}
        toast={socketHook.toast}
      />
    </div>
  );
}
