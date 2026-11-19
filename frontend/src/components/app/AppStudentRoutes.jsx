import React, { Suspense, lazy } from 'react';
import ProtectedRoute from '../ProtectedRoute';
import Skeleton from '../Skeleton';

const StudentDashboard = lazy(() => import('../../pages/StudentDashboard'));
const ClassroomView = lazy(() => import('../../pages/ClassroomView'));
const StudentActivityDetail = lazy(() => import('../../pages/StudentActivityDetail'));
const StudentView = lazy(() => import('../../pages/StudentView'));

export default function AppStudentRoutes({
  currentScreen,
  currentUser,
  setCurrentScreen,
  socket,
  activeClassroom,
  setActiveClassroom,
  activeAssignment,
  workspaceReturnScreen,
  handleLogout,
  handleBack,
  navigateTo,
  verifyEnvironmentBeforeExam,
}) {
  return (
    <>
      {currentScreen === 'student_dashboard' && (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
          <Suspense fallback={<Skeleton.StudentDashboard />}>
            <StudentDashboard
              socket={socket}
              currentUser={currentUser}
              onLogout={handleLogout}
              onEnterClassroom={(classroom) => {
                if (classroom?.id) {
                  try {
                    sessionStorage.setItem(`verity_student_classroom_tab_${classroom.id}`, 'stream');
                    sessionStorage.setItem('verity_student_classroom_tab_active', 'stream');
                  } catch (_) {}
                }
                navigateTo('classroom_view', { classroom });
              }}
              onOpenAssignment={(classroom, task) => {
                navigateTo('student_activity_detail', { classroom, assignment: task, workspaceReturnScreen: 'student_dashboard' });
              }}
              onOpenSandbox={() => navigateTo('sandbox_workspace')}
            />
          </Suspense>
        </ProtectedRoute>
      )}

      {currentScreen === 'classroom_view' && (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
          <Suspense fallback={<Skeleton.ClassroomView />}>
            <ClassroomView
              key={activeClassroom?.id ? `student_class_${activeClassroom.id}` : 'classroom_view'}
              onEnterClassroom={(classroom) => {
                setActiveClassroom(classroom);
                navigateTo('classroom_view', { classroom, force: true });
              }}
              socket={socket}
              currentUser={currentUser}
              classroom={activeClassroom}
              onLogout={handleLogout}
              onBack={() => handleBack('student_dashboard')}
              onNavigateView={(view) => {
                localStorage.setItem('verity_student_view', view);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('verity:student-view-sync', { detail: view }));
                }
                navigateTo('student_dashboard');
              }}
              onOpenAssignment={(task) => {
                navigateTo('student_activity_detail', { assignment: task, classroom: activeClassroom || task.classroom, workspaceReturnScreen: 'classroom_view' });
              }}
              onStartAssignment={async (task) => {
                const allowed = await verifyEnvironmentBeforeExam();
                if (!allowed) return;
                navigateTo('student_workspace', { assignment: task, classroom: activeClassroom || task.classroom, workspaceReturnScreen: 'classroom_view' });
              }}
            />
          </Suspense>
        </ProtectedRoute>
      )}

      {currentScreen === 'student_activity_detail' && (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
          <Suspense fallback={<Skeleton.StudentActivityDetail />}>
            <StudentActivityDetail
              socket={socket}
              currentUser={currentUser}
              classroom={activeClassroom}
              assignment={activeAssignment}
              onBack={() => handleBack(workspaceReturnScreen === 'student_dashboard' ? 'student_dashboard' : 'classroom_view')}
              onNavigateView={(view) => {
                localStorage.setItem('verity_student_view', view);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('verity:student-view-sync', { detail: view }));
                }
                navigateTo('student_dashboard');
              }}
              onStartCoding={async () => {
                const allowed = await verifyEnvironmentBeforeExam();
                if (!allowed) return;
                navigateTo('student_workspace', {
                  assignment: activeAssignment,
                  classroom: activeClassroom || activeAssignment?.classroom,
                  workspaceReturnScreen: 'student_activity_detail'
                });
              }}
              onEnterClassroom={(classroom) => {
                if (classroom?.id) {
                  try {
                    sessionStorage.setItem(`verity_student_classroom_tab_${classroom.id}`, 'stream');
                    sessionStorage.setItem('verity_student_classroom_tab_active', 'stream');
                  } catch (_) {}
                }
                navigateTo('classroom_view', { classroom });
              }}
              onLogout={handleLogout}
            />
          </Suspense>
        </ProtectedRoute>
      )}

      {currentScreen === 'student_workspace' && (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
          <Suspense fallback={<Skeleton.Workspace />}>
            <StudentView
              key={activeAssignment?.id ? `student_view_${activeAssignment.id}` : 'student_view'}
              socket={socket}
              currentUser={currentUser}
              username={currentUser?.name}
              assignment={activeAssignment}
              classroom={activeClassroom}
              onBack={() => handleBack(workspaceReturnScreen || 'classroom_view')}
            />
          </Suspense>
        </ProtectedRoute>
      )}

      {currentScreen === 'sandbox_workspace' && (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
          <Suspense fallback={<Skeleton.Workspace />}>
            <StudentView
              socket={socket}
              currentUser={currentUser}
              username={currentUser?.name}
              isSandbox={true}
              onBack={() => handleBack('student_dashboard')}
            />
          </Suspense>
        </ProtectedRoute>
      )}
    </>
  );
}
