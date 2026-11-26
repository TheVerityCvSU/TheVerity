import { useEffect, useRef } from 'react';
import syncService from './data/syncService';
import { useDarkMode } from './hooks/useDarkMode';
import { useAppSecurity, isRunningInAdminMode, lockDown, releaseLockdown } from './hooks/useAppSecurity';
import { useAppAuth, normalizeSavedUser } from './hooks/useAppAuth';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useAppSocket } from './hooks/useAppSocket';

import ComLabWebBlocker from './components/ComLabWebBlocker';
import NetworkStatusIndicator from './components/NetworkStatusIndicator';
import AppVmBlocker from './components/app/AppVmBlocker';
import AppStudentRoutes from './components/app/AppStudentRoutes';
import AppTeacherRoutes from './components/app/AppTeacherRoutes';
import AppAuthRoutes from './components/app/AppAuthRoutes';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const { isDark } = useDarkMode();
  const isAdminApp = isRunningInAdminMode();

  const navRef = useRef(null);
  const socketRef = useRef(null);

  const auth = useAppAuth({
    isAdminApp,
    getSocket: () => socketRef.current,
    lockDown,
    releaseLockdown,
    setCurrentScreen: (screen) => navRef.current?.setCurrentScreen(screen),
    setActiveClassroom: (classroom) => navRef.current?.setActiveClassroom(classroom),
    setActiveAssignment: (assignment) => navRef.current?.setActiveAssignment(assignment),
    getCurrentScreen: () => navRef.current?.currentScreen
  });
  const { currentUser, setCurrentUser, handleLogout, handleUserLogin } = auth;

  const nav = useAppNavigation({ isAdminApp, currentUser });
  const {
    currentScreen, setCurrentScreen, activeClassroom, setActiveClassroom,
    activeAssignment, setActiveAssignment, selectedStudentForPlayback,
    setSelectedStudentForPlayback, proctoringReturnScreen, proctoringMode,
    setProctoringMode, workspaceReturnScreen, navigateTo, handleBack
  } = nav;

  const { socket } = useAppSocket({
    currentUser,
    setCurrentUser,
    normalizeSavedUser,
    setActiveAssignment,
    setActiveClassroom,
  });

  useEffect(() => {
    navRef.current = nav;
  });

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const security = useAppSecurity({ currentUser, currentScreen, socket });
  const { isDesktopWeb, vmDetected, vmReasons, verifyEnvironmentBeforeExam } = security;

  useEffect(() => {
    syncService.initAutoSync(() => localStorage.getItem('verity_token') || localStorage.getItem('token'));
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    if (token) {
      syncService.syncOfflineQueue(token);
    }
  }, []);

  const handleErrorReturnToDashboard = (targetScreen) => {
    setActiveClassroom(null);
    setActiveAssignment(null);
    setSelectedStudentForPlayback(null);
    navigateTo(targetScreen, { force: true, classroom: null, assignment: null, student: null });
    setCurrentScreen(targetScreen);
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        {isAdminApp ? (
          <ErrorBoundary
            currentScreen={currentScreen}
            resetKey={currentScreen}
            onNavigateFallback={handleErrorReturnToDashboard}
          >
            <AppAuthRoutes
              isAdminApp={true}
              currentScreen={currentScreen}
              currentUser={currentUser}
              setCurrentScreen={setCurrentScreen}
              setCurrentUser={setCurrentUser}
              socket={socket}
              handleLogout={handleLogout}
              handleUserLogin={handleUserLogin}
              lockDown={lockDown}
            />
          </ErrorBoundary>
        ) : (() => {
          const userRoleLower = String(currentUser?.role || '').toLowerCase();
          const isStudent = userRoleLower === 'student';
          const isTeacher = userRoleLower === 'teacher' || userRoleLower === 'instructor';

          return (
            <>
              {isStudent && isDesktopWeb ? (
                <ComLabWebBlocker currentUser={currentUser} onLogout={handleLogout} />
              ) : isStudent && vmDetected ? (
                <AppVmBlocker isDark={isDark} vmReasons={vmReasons} handleLogout={handleLogout} />
              ) : (
                <ErrorBoundary
                  currentScreen={currentScreen}
                  resetKey={currentScreen}
                  onNavigateFallback={handleErrorReturnToDashboard}
                >
                  <AppAuthRoutes
                    isAdminApp={false}
                    currentScreen={currentScreen}
                    currentUser={currentUser}
                    setCurrentScreen={setCurrentScreen}
                    setCurrentUser={setCurrentUser}
                    socket={socket}
                    handleLogout={handleLogout}
                    handleUserLogin={handleUserLogin}
                    lockDown={lockDown}
                  />

                  {isStudent && (
                    <AppStudentRoutes
                      currentScreen={currentScreen}
                      currentUser={currentUser}
                      setCurrentScreen={setCurrentScreen}
                      socket={socket}
                      activeClassroom={activeClassroom}
                      setActiveClassroom={setActiveClassroom}
                      activeAssignment={activeAssignment}
                      workspaceReturnScreen={workspaceReturnScreen}
                      handleLogout={handleLogout}
                      handleBack={handleBack}
                      navigateTo={navigateTo}
                      verifyEnvironmentBeforeExam={verifyEnvironmentBeforeExam}
                    />
                  )}

                  {isTeacher && (
                    <AppTeacherRoutes
                      currentScreen={currentScreen}
                      currentUser={currentUser}
                      setCurrentScreen={setCurrentScreen}
                      socket={socket}
                      activeClassroom={activeClassroom}
                      setActiveClassroom={setActiveClassroom}
                      activeAssignment={activeAssignment}
                      selectedStudentForPlayback={selectedStudentForPlayback}
                      setSelectedStudentForPlayback={setSelectedStudentForPlayback}
                      proctoringMode={proctoringMode}
                      setProctoringMode={setProctoringMode}
                      proctoringReturnScreen={proctoringReturnScreen}
                      handleLogout={handleLogout}
                      handleBack={handleBack}
                      navigateTo={navigateTo}
                    />
                  )}
                </ErrorBoundary>
              )}
            </>
          );
        })()}
      </div>

      {!['student_workspace', 'sandbox_workspace', 'teacher_live_monitoring', 'teacher_proctoring', 'teacher_playback'].includes(currentScreen) && (
        <NetworkStatusIndicator position="right" />
      )}
    </div>
  );
}
