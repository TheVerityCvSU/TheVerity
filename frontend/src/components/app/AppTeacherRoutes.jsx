import { lazy, Suspense } from 'react';
import ProtectedRoute from '../ProtectedRoute';
import PageLoader from '../PageLoader';
import TeacherDashboard from '../../pages/TeacherDashboard';

const TeacherClasswork = lazy(() => import('../../pages/TeacherClasswork'));
const TeacherGrading = lazy(() => import('../../pages/TeacherGrading'));
const TeacherView = lazy(() => import('../../pages/TeacherView'));

export default function AppTeacherRoutes({
  currentScreen,
  currentUser,
  setCurrentScreen,
  socket,
  activeClassroom,
  setActiveClassroom,
  activeAssignment,
  selectedStudentForPlayback,
  setSelectedStudentForPlayback,
  proctoringMode,
  setProctoringMode,
  proctoringReturnScreen,
  handleLogout,
  handleBack,
  navigateTo,
}) {
  return (
    <Suspense fallback={<PageLoader />}>
      {currentScreen === 'teacher_dashboard' && (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
          <TeacherDashboard
            currentUser={currentUser}
            onLogout={handleLogout}
            socket={socket}
            onEnterClassroom={(classroom) => {
              navigateTo('teacher_classwork', { classroom });
            }}
          />
        </ProtectedRoute>
      )}

      {currentScreen === 'teacher_classwork' && (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
          <TeacherClasswork
            key={activeClassroom?.id ? `teacher_class_${activeClassroom.id}` : 'teacher_classwork'}
            onEnterClassroom={(classroom) => {
              setActiveClassroom(classroom);
              navigateTo('teacher_classwork', { classroom, force: true });
            }}
            socket={socket}
            classroom={activeClassroom}
            onLogout={handleLogout}
            onBack={() => handleBack('teacher_dashboard')}
            onNavigateView={(view) => {
              localStorage.setItem('verity_teacher_view', view);
              navigateTo('teacher_dashboard');
            }}
            onStartMonitoring={(assignment) => {
              navigateTo('teacher_live_monitoring', {
                assignment,
                student: null,
                proctoringMode: 'live',
                proctoringReturnScreen: 'teacher_classwork'
              });
            }}
            onOpenGrading={(assignment, tab) => {
              navigateTo('teacher_grading', {
                assignment,
                tab: tab || 'classwork'
              });
            }}
            currentUser={currentUser}
            onOpenPlayback={(assignment, student) => {
              navigateTo('teacher_playback', {
                assignment,
                student,
                proctoringMode: 'playback',
                proctoringReturnScreen: 'teacher_classwork'
              });
            }}
          />
        </ProtectedRoute>
      )}

      {currentScreen === 'teacher_grading' && (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
          <TeacherGrading
            socket={socket}
            classroom={activeClassroom}
            assignment={activeAssignment}
            onLogout={handleLogout}
            onBack={() => handleBack('teacher_classwork')}
            onEnterClassroom={(classroom) => {
              navigateTo('teacher_classwork', { classroom });
            }}
            onNavigateView={(view) => {
              localStorage.setItem('verity_teacher_view', view);
              navigateTo('teacher_dashboard');
            }}
            onOpenPlayback={(assignment, student) => {
              navigateTo('teacher_playback', {
                assignment,
                student,
                proctoringMode: 'playback',
                proctoringReturnScreen: 'teacher_grading'
              });
            }}
            onStartMonitoring={(assignment, student) => {
              navigateTo('teacher_live_monitoring', {
                assignment,
                student: student || null,
                proctoringMode: 'live',
                proctoringReturnScreen: 'teacher_grading'
              });
            }}
            currentUser={currentUser}
          />
        </ProtectedRoute>
      )}

      {(currentScreen === 'teacher_proctoring' || currentScreen === 'teacher_live_monitoring' || currentScreen === 'teacher_playback') && (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
          <TeacherView
            key={activeAssignment?.id ? `teacher_view_${activeAssignment.id}_${currentScreen}` : 'teacher_view'}
            socket={socket}
            currentUser={currentUser}
            assignment={activeAssignment}
            classroom={activeClassroom}
            initialStudent={selectedStudentForPlayback}
            mode={currentScreen === 'teacher_playback' ? 'playback' : (currentScreen === 'teacher_live_monitoring' ? 'live' : proctoringMode)}
            onSwitchMode={(newMode) => {
              setProctoringMode(newMode);
              setCurrentScreen(newMode === 'playback' ? 'teacher_playback' : 'teacher_live_monitoring');
              try {
                localStorage.setItem('verity_proctoring_mode', newMode);
              } catch {}
            }}
            onBack={() => {
              if (proctoringMode === 'playback' || currentScreen === 'teacher_playback') {
                setSelectedStudentForPlayback(null);
              }
              handleBack(proctoringReturnScreen || 'teacher_grading');
            }}
            onLogout={() => {
              setSelectedStudentForPlayback(null);
              handleLogout();
            }}
          />
        </ProtectedRoute>
      )}
    </Suspense>
  );
}
