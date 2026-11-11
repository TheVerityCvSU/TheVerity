import React from 'react';
import ProtectedRoute from '../ProtectedRoute';
import AdminDashboard from '../../pages/AdminDashboard';
import AdminLogin from '../../pages/admin/AdminLogin';
import Login from '../../pages/Login';
import Register from '../../pages/Register';
import NotFound from '../../pages/NotFound';
import { notifyUserListeners } from '../../hooks/useCurrentUser';

export default function AppAuthRoutes({
  isAdminApp,
  currentScreen,
  currentUser,
  setCurrentScreen,
  setCurrentUser,
  socket,
  handleLogout,
  handleUserLogin,
  lockDown,
}) {
  const handleAdminLoginSuccess = (user, token) => {
    localStorage.removeItem('verity_teacher_classrooms');
    localStorage.removeItem('verity_classrooms');
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('verity_user', JSON.stringify(user));
    if (token) {
      localStorage.setItem('verity_token', token);
      localStorage.setItem('token', token);
    }
    localStorage.setItem('currentScreen', 'admin_dashboard');

    if (window.electronAPI?.localDB?.setLocal) {
      window.electronAPI.localDB.setLocal('verity_saved_session_user', user).catch(() => {});
      if (token) window.electronAPI.localDB.setLocal('verity_saved_session_token', token).catch(() => {});
      window.electronAPI.localDB.setLocal('verity_saved_session_screen', 'admin_dashboard').catch(() => {});
    }

    setCurrentUser(user);
    notifyUserListeners(user);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('verity:user-updated', { detail: user }));
    }
    setCurrentScreen('admin_dashboard');
  };

  if (isAdminApp) {
    if (currentScreen === 'admin_dashboard' && currentUser?.role === 'Admin') {
      return (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen} requiredRole="Admin">
          <AdminDashboard currentUser={currentUser} onLogout={handleLogout} socket={socket} />
        </ProtectedRoute>
      );
    }
    return <AdminLogin onLogin={handleAdminLoginSuccess} />;
  }

  return (
    <>
      {currentScreen === 'admin_login' && (
        <AdminLogin onLogin={handleAdminLoginSuccess} />
      )}

      {currentScreen === 'login' && (
        <Login
          onLogin={handleUserLogin}
          onGoToRegister={() => setCurrentScreen('register')}
        />
      )}

      {currentScreen === 'register' && (
        <Register
          onBackToLogin={() => setCurrentScreen('login')}
          onLogin={handleUserLogin}
        />
      )}

      {currentScreen === 'admin_dashboard' && (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
          <AdminDashboard currentUser={currentUser} onLogout={handleLogout} socket={socket} />
        </ProtectedRoute>
      )}

      {/* Fallback for unknown screen */}
      {currentUser && !['student_dashboard', 'classroom_view', 'student_activity_detail', 'student_workspace', 'sandbox_workspace', 'admin_dashboard', 'teacher_dashboard', 'teacher_classwork', 'teacher_grading', 'teacher_proctoring', 'teacher_live_monitoring', 'teacher_playback'].includes(currentScreen) && (
        <NotFound />
      )}

      {/* Login fallback to avoid white screen */}
      {!currentUser && !['login', 'register', 'admin_login'].includes(currentScreen) && (
        (typeof window !== 'undefined' && (window.location.pathname.startsWith('/admin') || Boolean(window.IS_ADMIN_APP))) ? (
          <AdminLogin onLogin={handleAdminLoginSuccess} />
        ) : (
          <Login
            onLogin={(user, token) => {
              setCurrentUser(user);
              if (token) localStorage.setItem('verity_token', token);
              if (user.role === 'Admin') {
                setCurrentScreen('admin_login');
              } else if (user.role === 'Teacher') {
                setCurrentScreen('teacher_dashboard');
              } else {
                lockDown();
                setCurrentScreen('student_dashboard');
              }
            }}
            onGoToRegister={() => setCurrentScreen('register')}
          />
        )
      )}
    </>
  );
}
