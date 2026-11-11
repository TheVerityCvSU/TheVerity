import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import syncService from './data/syncService';
import { useDarkMode } from './hooks/useDarkMode';
import { useAppSecurity, isRunningInAdminMode } from './hooks/useAppSecurity';
import { useAppAuth, normalizeSavedUser } from './hooks/useAppAuth';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useAppSocket } from './hooks/useAppSocket';

import ComLabWebBlocker from './components/ComLabWebBlocker';
import NetworkStatusIndicator from './components/NetworkStatusIndicator';
import AppVmBlocker from './components/app/AppVmBlocker';
import AppStudentRoutes from './components/app/AppStudentRoutes';
import AppTeacherRoutes from './components/app/AppTeacherRoutes';
import AppAuthRoutes from './components/app/AppAuthRoutes';

export { createVeritySocket } from './hooks/useAppSocket';
export { isRunningInAdminMode } from './hooks/useAppSecurity';

export default function App() {
  const { isDark } = useDarkMode();
  const isAdminApp = isRunningInAdminMode();

  const nav = useAppNavigation({ isAdminApp, currentUser: null });
  const {
    currentScreen, setCurrentScreen, activeClassroom, setActiveClassroom,
    activeAssignment, setActiveAssignment, selectedStudentForPlayback,
    setSelectedStudentForPlayback, proctoringReturnScreen, proctoringMode,
    setProctoringMode, workspaceReturnScreen, navigateTo, handleBack
  } = nav;

  const auth = useAppAuth({
    isAdminApp,
    socket: null,
    lockDown: () => window.electronAPI?.enableLockdown?.(),
    releaseLockdown: () => window.electronAPI?.disableLockdown?.(),
    setCurrentScreen,
    currentScreen,
    setActiveClassroom,
  });
  const { currentUser, setCurrentUser, handleLogout, handleUserLogin } = auth;

  const { socket } = useAppSocket({
    currentUser,
    setCurrentUser,
    normalizeSavedUser,
    setActiveAssignment,
    setActiveClassroom,
  });

  const security = useAppSecurity({ currentUser, currentScreen, socket });
  const { isDesktopWeb, vmDetected, vmReasons, lockDown, verifyEnvironmentBeforeExam } = security;

  useEffect(() => {
    syncService.initAutoSync(() => localStorage.getItem('verity_token') || localStorage.getItem('token'));
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    if (token) {
      syncService.syncOfflineQueue(token);
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentUser ? 'logged-in' : 'logged-out'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}
        >
          {isAdminApp ? (
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
          ) : (
            <>
              {currentUser?.role === 'Student' && isDesktopWeb ? (
                <ComLabWebBlocker currentUser={currentUser} onLogout={handleLogout} />
              ) : currentUser?.role === 'Student' && vmDetected ? (
                <AppVmBlocker isDark={isDark} vmReasons={vmReasons} handleLogout={handleLogout} />
              ) : (
                <>
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

                  {currentUser?.role === 'Student' && (
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

                  {currentUser?.role === 'Teacher' && (
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
                </>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {!['student_workspace', 'sandbox_workspace', 'teacher_live_monitoring', 'teacher_proctoring', 'teacher_playback'].includes(currentScreen) && (
        <NetworkStatusIndicator position="right" />
      )}
    </div>
  );
}
