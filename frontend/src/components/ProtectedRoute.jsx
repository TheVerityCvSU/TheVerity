import { useEffect } from 'react';

export default function ProtectedRoute({ children, currentUser, setCurrentScreen, requiredRole }) {
  const isAdminApp = typeof window !== 'undefined' && Boolean(
    window.IS_ADMIN_APP ||
    window.electronAPI?.isAdminApp ||
    window.location.pathname.startsWith('/admin') ||
    window.location.hash.startsWith('#/admin') ||
    new URLSearchParams(window.location.search).get('admin') === 'true' ||
    window.location.href.includes('admin')
  );

  useEffect(() => {
    if (!currentUser) {
      setCurrentScreen(isAdminApp ? 'admin_login' : 'login');
      return;
    }
    if (isAdminApp && currentUser.role !== 'Admin') {
      setCurrentScreen('admin_login');
      return;
    }
    if (requiredRole && currentUser.role !== requiredRole) {
      if (currentUser.role === 'Admin') setCurrentScreen('admin_dashboard');
      else if (currentUser.role === 'Teacher') setCurrentScreen('teacher_dashboard');
      else setCurrentScreen('student_dashboard');
    }
  }, [currentUser, setCurrentScreen, isAdminApp, requiredRole]);

  if (!currentUser) {
    return null;
  }

  if (isAdminApp && currentUser.role !== 'Admin') {
    return null;
  }

  return (
    <div style={{ flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'inherit' }}>
      {children}
    </div>
  );
}