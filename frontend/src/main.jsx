import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { MotionConfig } from 'framer-motion';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    try {
      localStorage.setItem('verity_recent_crash', JSON.stringify({
        time: Date.now(),
        message: error?.message || 'Component Render Crash'
      }));
    } catch (_) {}
    try {
      const userStr = localStorage.getItem('currentUser') || localStorage.getItem('verity_user') || localStorage.getItem('user');
      const userObj = userStr ? JSON.parse(userStr) : null;
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      const apiBase = localStorage.getItem('verity_custom_server') || localStorage.getItem('verity_lan_server') || import.meta.env.VITE_API_URL || 'http://localhost:3001';
      fetch(`${apiBase.replace(/\/$/, '')}/audit-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          user: userObj?.name || userObj?.email || 'Student',
          type: 'System Crash Violation',
          severity: 'High',
          desc: `System Crash: ${error?.message || 'Component Render Crash'}`
        })
      }).catch(() => {});
    } catch (_) {}
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee2e2', color: '#991b1b', height: '100vh', boxSizing: 'border-box' }}>
          <h1>React Crashed</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px', marginTop: '20px', backgroundColor: '#fef2f2', padding: '15px', borderRadius: '8px' }}>
            {this.state.error && this.state.error.toString()}
            <br/><br/>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button 
            onClick={() => { window.location.reload(); }}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <ErrorBoundary>
        <MotionConfig reducedMotion="never">
          <App />
        </MotionConfig>
      </ErrorBoundary>
    </GoogleOAuthProvider>
  </StrictMode>,
);
