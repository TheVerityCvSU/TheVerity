import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Verity ErrorBoundary caught an error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  resolveDashboardTarget = () => {
    try {
      const userStr = localStorage.getItem('currentUser') || localStorage.getItem('verity_user');
      const user = userStr ? JSON.parse(userStr) : null;
      const role = String(user?.role || '').toLowerCase();
      if (role === 'admin' || window.IS_ADMIN_APP) {
        return user ? 'admin_dashboard' : 'admin_login';
      }
      if (role === 'teacher' || role === 'instructor') return 'teacher_dashboard';
      if (role === 'student') return 'student_dashboard';
      return 'login';
    } catch {
      return window.IS_ADMIN_APP ? 'admin_login' : 'login';
    }
  };

  handleReset = () => {
    const target = this.resolveDashboardTarget();
    try {
      localStorage.setItem('currentScreen', target);
      localStorage.removeItem('activeClassroom');
      localStorage.removeItem('activeAssignment');
      sessionStorage.removeItem('verity_nav_stack');
      sessionStorage.removeItem('verity_playback_student');
      sessionStorage.removeItem('verity_teacher_classwork_tab_active');
      sessionStorage.removeItem('verity_student_classroom_tab_active');
      // Students must stay in kiosk lockdown; only release it for non-student roles.
      if (target !== 'student_dashboard' && window.electronAPI?.disableLockdown) {
        window.electronAPI.disableLockdown();
      }
    } catch {}

    // If the crash occurred on the dashboard screen itself (or no callback is wired),
    // reload directly onto the clean dashboard target so React resets all corrupted sub-state.
    if (
      typeof this.props.onNavigateFallback !== 'function' ||
      (this.props.currentScreen && this.props.currentScreen === target)
    ) {
      window.location.reload();
      return;
    }

    try {
      this.props.onNavigateFallback(target);
      this.setState({ hasError: false, error: null, errorInfo: null });
    } catch {
      window.location.reload();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
      const bg = isDark ? '#1a1a1a' : '#f8f9fa';
      const cardBg = isDark ? '#262626' : '#ffffff';
      const text = isDark ? '#f5f5f5' : '#1e293b';
      const textMuted = isDark ? '#a3a3a3' : '#64748b';
      const border = isDark ? '#383838' : '#e2e8f0';

      return (
        <div style={{
          minHeight: '100vh',
          width: '100%',
          backgroundColor: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box',
          fontFamily: '"Inter", "Segoe UI", sans-serif',
          color: text
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: cardBg,
            borderRadius: '20px',
            border: `1px solid ${border}`,
            padding: '32px',
            boxShadow: isDark ? '0 12px 36px rgba(0,0,0,0.5)' : '0 12px 36px rgba(0,0,0,0.08)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <AlertTriangle size={32} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '0 0 10px 0' }}>
              Something went wrong loading this view
            </h2>
            <p style={{ color: textMuted, fontSize: '0.92rem', lineHeight: '1.5', margin: '0 0 24px 0' }}>
              An unexpected error occurred while rendering this screen. You can return to the dashboard or reload the page.
            </p>

            {this.state.error && (
              <div style={{
                backgroundColor: isDark ? '#1a1a1a' : '#f1f5f9',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '0.8rem',
                color: isDark ? '#f87171' : '#dc2626',
                fontFamily: 'monospace',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '24px',
                maxHeight: '140px'
              }}>
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <Home size={18} /> Return to Dashboard
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  backgroundColor: 'transparent',
                  color: text,
                  border: `1px solid ${border}`,
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={18} /> Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

