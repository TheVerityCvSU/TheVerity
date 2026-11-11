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
    const userRoleLower = String(currentUser?.role || '').toLowerCase();
    if (isAdminApp && userRoleLower !== 'admin') {
      setCurrentScreen('admin_login');
      return;
    }
    if (requiredRole) {
      const reqRoleLower = String(requiredRole).toLowerCase();
      if (userRoleLower !== reqRoleLower) {
        if (userRoleLower === 'admin') setCurrentScreen('admin_dashboard');
        else if (userRoleLower === 'teacher' || userRoleLower === 'instructor') setCurrentScreen('teacher_dashboard');
        else setCurrentScreen('student_dashboard');
      }
    }
  }, [currentUser, setCurrentScreen, isAdminApp, requiredRole]);

  if (!currentUser) {
    return null;
  }

  if (isAdminApp && String(currentUser.role || '').toLowerCase() !== 'admin') {
    return null;
  }

  return (
    <div style={{ flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'inherit' }}>
      {children}
    </div>
  );
}