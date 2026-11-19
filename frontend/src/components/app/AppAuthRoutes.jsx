import React, { Suspense, lazy } from 'react';
import ProtectedRoute from '../ProtectedRoute';
import Skeleton from '../Skeleton';
import { notifyUserListeners } from '../../hooks/useCurrentUser';

const AdminDashboard = lazy(() => import('../../pages/AdminDashboard'));
const AdminLogin = lazy(() => import('../../pages/admin/AdminLogin'));
const Login = lazy(() => import('../../pages/Login'));
const Register = lazy(() => import('../../pages/Register'));
const NotFound = lazy(() => import('../../pages/NotFound'));

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
          <Suspense fallback={<Skeleton.AdminDashboard />}>
            <AdminDashboard currentUser={currentUser} onLogout={handleLogout} socket={socket} />
          </Suspense>
        </ProtectedRoute>
      );
    }
    return (
      <Suspense fallback={<Skeleton.AuthForm />}>
        <AdminLogin onLogin={handleAdminLoginSuccess} />
      </Suspense>
    );
  }

  return (
    <>
      {currentScreen === 'admin_login' && (
        <Suspense fallback={<Skeleton.AuthForm />}>
          <AdminLogin onLogin={handleAdminLoginSuccess} />
        </Suspense>
      )}

      {currentScreen === 'login' && (
        <Suspense fallback={<Skeleton.AuthForm />}>
          <Login
            onLogin={handleUserLogin}
            onGoToRegister={() => setCurrentScreen('register')}
          />
        </Suspense>
      )}

      {currentScreen === 'register' && (
        <Suspense fallback={<Skeleton.AuthForm />}>
          <Register
            onBackToLogin={() => setCurrentScreen('login')}
            onLogin={handleUserLogin}
          />
        </Suspense>
      )}

      {currentScreen === 'admin_dashboard' && (
        <ProtectedRoute currentUser={currentUser} setCurrentScreen={setCurrentScreen}>
          <Suspense fallback={<Skeleton.AdminDashboard />}>
            <AdminDashboard currentUser={currentUser} onLogout={handleLogout} socket={socket} />
          </Suspense>
        </ProtectedRoute>
      )}

      {/* Fallback for unknown screen */}
      {currentUser && !['student_dashboard', 'classroom_view', 'student_activity_detail', 'student_workspace', 'sandbox_workspace', 'admin_dashboard', 'teacher_dashboard', 'teacher_classwork', 'teacher_grading', 'teacher_proctoring', 'teacher_live_monitoring', 'teacher_playback'].includes(currentScreen) && (
        <Suspense fallback={<Skeleton.AuthForm />}>
          <NotFound />
        </Suspense>
      )}

      {/* Login fallback to avoid white screen */}
      {!currentUser && !['login', 'register', 'admin_login'].includes(currentScreen) && (
        (typeof window !== 'undefined' && (window.location.pathname.startsWith('/admin') || Boolean(window.IS_ADMIN_APP))) ? (
          <Suspense fallback={<Skeleton.AuthForm />}>
            <AdminLogin onLogin={handleAdminLoginSuccess} />
          </Suspense>
        ) : (
          <Suspense fallback={<Skeleton.AuthForm />}>
            <Login
              onLogin={handleUserLogin}
              onGoToRegister={() => setCurrentScreen('register')}
            />
          </Suspense>
        )
      )}
    </>
  );
}
