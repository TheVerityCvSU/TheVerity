import React, { useState, useEffect, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Moon, Sun, Loader2, Construction, AlertTriangle, Eye, EyeOff, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { useDarkMode } from '../hooks/useDarkMode';
import { io } from 'socket.io-client';
import { isDesktopWebBrowser } from '../utils/deviceUtils';

export default function Login({ onLogin, onGoToRegister }) {
  const { isDark, toggle } = useDarkMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });
  const [rememberAccount, setRememberAccount] = useState(() => {
    try {
      const savedPref = localStorage.getItem('verity_remember_account');
      return savedPref !== 'false';
    } catch (_) {
      return true;
    }
  });

  const [isDesktopWeb, setIsDesktopWeb] = useState(() => isDesktopWebBrowser());

  useEffect(() => {
    if (window.electronAPI) return;

    const checkEnvironment = () => {
      const isDesktop = isDesktopWebBrowser();
      setIsDesktopWeb(prev => prev !== isDesktop ? isDesktop : prev);
    };

    window.addEventListener('resize', checkEnvironment);
    window.addEventListener('orientationchange', checkEnvironment);
    const timer = setInterval(checkEnvironment, 600);

    return () => {
      window.removeEventListener('resize', checkEnvironment);
      window.removeEventListener('orientationchange', checkEnvironment);
      clearInterval(timer);
    };
  }, []);
  const socketRef = useRef(null);
  const authTimeoutRef = useRef(null);
  const authWindowRef = useRef(null);


  // Load saved account email on mount (localStorage + Electron localDB)
  useEffect(() => {
    const loadSavedAccount = async () => {
      let savedEmail = '';
      try {
        savedEmail = localStorage.getItem('verity_saved_account_email') || '';
      } catch (_) {}

      if (!savedEmail && window.electronAPI?.localDB?.getLocal) {
        try {
          savedEmail = await window.electronAPI.localDB.getLocal('verity_saved_account_email') || '';
        } catch (_) {}
      }

      if (savedEmail) {
        setEmail(savedEmail);
      }
    };
    loadSavedAccount();
  }, []);

  // Check maintenance status on mount
  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await apiFetch('/maintenance-status');
        if (res.ok) {
          const data = await res.json();
          if (data.enabled) {
            setMaintenance({ enabled: true, message: data.message });
          }
        }
      } catch (_) {}
    };
    checkMaintenance();
    // Re-check every 30 seconds in case admin toggles it off
    const interval = setInterval(checkMaintenance, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for Google Auth Window closed event from Electron .exe
  useEffect(() => {
    if (window.electronAPI?.onGoogleAuthClosed) {
      const unsubscribe = window.electronAPI.onGoogleAuthClosed(() => {
        setIsGoogleLoading(false);
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
          authTimeoutRef.current = null;
        }
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, []);

  // When mainWindow regains focus, check if auth window was closed
  useEffect(() => {
    const handleFocus = async () => {
      if (isGoogleLoading && window.electronAPI?.checkGoogleAuthStatus) {
        try {
          const isOpen = await window.electronAPI.checkGoogleAuthStatus();
          if (!isOpen) {
            setIsGoogleLoading(false);
            if (socketRef.current) {
              socketRef.current.disconnect();
              socketRef.current = null;
            }
            if (authTimeoutRef.current) {
              clearTimeout(authTimeoutRef.current);
              authTimeoutRef.current = null;
            }
          }
        } catch (_) {}
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isGoogleLoading]);

  // Clean up any pending socket or timer on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
    };
  }, []);

  const persistRememberedAccount = (accountEmail) => {
    const cleanEmail = (accountEmail || '').trim();
    if (rememberAccount && cleanEmail) {
      try {
        localStorage.setItem('verity_saved_account_email', cleanEmail);
        localStorage.setItem('verity_remember_account', 'true');
        if (window.electronAPI?.localDB?.setLocal) {
          window.electronAPI.localDB.setLocal('verity_saved_account_email', cleanEmail).catch(() => {});
          window.electronAPI.localDB.setLocal('verity_remember_account', 'true').catch(() => {});
        }
      } catch (_) {}
    } else if (!rememberAccount) {
      try {
        localStorage.removeItem('verity_saved_account_email');
        localStorage.setItem('verity_remember_account', 'false');
        if (window.electronAPI?.localDB?.setLocal) {
          window.electronAPI.localDB.setLocal('verity_saved_account_email', null).catch(() => {});
          window.electronAPI.localDB.setLocal('verity_remember_account', 'false').catch(() => {});
        }
      } catch (_) {}
    }
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    setIsGoogleLoading(true);
    try {
      const response = await apiFetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenResponse.credential, access_token: tokenResponse.access_token })
      });
      const data = await response.json();
      if (data.maintenance) {
        setMaintenance({ enabled: true, message: data.message });
        setIsGoogleLoading(false);
        return;
      }
      if (response.ok) {
        persistRememberedAccount(data.user?.email);
        onLogin(data.user, data.token);
      } else {
        setError(data.message || 'Google login failed on server');
        setIsGoogleLoading(false);
      }
    } catch (_) {
      setError('Could not connect to server.');
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Login failed');
    setIsGoogleLoading(false);
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: handleGoogleError,
    onNonOAuthError: handleGoogleError,
    flow: 'implicit',
    hosted_domain: 'cvsu.edu.ph',
  });

  const handleGoogleElectron = () => {
    setIsGoogleLoading(true);
    setError('');
    
    // Clean up any previous session
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }

    const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const activeCloud = getCloudUrl() || 'https://verity-2z4v.onrender.com';
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const backendUrl = isOnline ? activeCloud : getLocalApiUrl();
    
    const socket = io(backendUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    
    socket.on(`google-login-success-${sessionId}`, (data) => {
      socket.disconnect();
      socketRef.current = null;
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
      if (window.electronAPI?.closeGoogleAuth) {
        window.electronAPI.closeGoogleAuth();
      }
      if (data && data.token && data.user) {
        persistRememberedAccount(data.user?.email);
        onLogin(data.user, data.token);
      } else {
        setError('Received invalid data from external login.');
        setIsGoogleLoading(false);
      }
    });
    
    socket.on(`google-login-error-${sessionId}`, (data) => {
      socket.disconnect();
      socketRef.current = null;
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
      if (window.electronAPI?.closeGoogleAuth) {
        window.electronAPI.closeGoogleAuth();
      }
      setError(data.message || 'External Google login failed.');
      setIsGoogleLoading(false);
    });
    
    const url = `${backendUrl}/auth/google/external?sessionId=${sessionId}`;
    if (window.electronAPI && window.electronAPI.openGoogleAuth) {
      window.electronAPI.openGoogleAuth(url);
    } else if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      const popup = window.open(url, '_blank', 'width=520,height=650');
      if (popup) {
        authWindowRef.current = popup;
        const pollTimer = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(pollTimer);
            setIsGoogleLoading(false);
            if (socketRef.current) {
              socketRef.current.disconnect();
              socketRef.current = null;
            }
          }
        }, 500);
      }
    }
    
    authTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.disconnect();
        socketRef.current = null;
        if (window.electronAPI?.closeGoogleAuth) {
          window.electronAPI.closeGoogleAuth();
        }
        setIsGoogleLoading(false);
        setError('Login timed out. Please try again.');
      }
    }, 5 * 60 * 1000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiFetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username: email, identifier: email })
      });

      const data = await response.json();

      if (data.maintenance) {
        setMaintenance({ enabled: true, message: data.message });
        setIsLoading(false);
        return;
      }

      if (response.ok) {
        persistRememberedAccount(data.user?.email || email);
        onLogin(data.user, data.token);
      } else {
        setError(data.message || 'Invalid login credentials');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('[Login] Login request failed:', err);
      setError(err?.message && !err.message.includes('fetch') ? err.message : 'Could not connect to server. Is server.js running?');
      setIsLoading(false);
    }
  };

  // ═══ MAINTENANCE MODE OVERLAY ═══
  if (maintenance.enabled) {
    return (
      <div
        className="auth-container"
        style={{
          ...styles.container,
          background: isDark
            ? 'linear-gradient(180deg, #323232 0%, #262626 45%, #1a1a1a 100%)'
            : 'linear-gradient(to bottom, #f3f4f6 0%, #9ca3af 100%)',
        }}
      >
        {/* Top Left Logo */}
        <div style={styles.logoContainer}>
          <span style={styles.logoV}>V</span>
          <span style={{ ...styles.logoText, color: isDark ? '#f4f4f5' : 'white' }}>erity</span>
        </div>

        {/* Top Right Dark Mode Switch */}
        <button
          onClick={toggle}
          type="button"
          style={{
            position: 'absolute', top: '30px', right: '40px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '42px', height: '42px', borderRadius: '50%',
            backgroundColor: isDark ? '#262626' : 'white',
            border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0',
            color: isDark ? '#f4f4f5' : '#374151',
            boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
            cursor: 'pointer', transition: 'all 0.2s ease',
          }}
          title="Toggle dark/light mode"
        >
          {isDark ? <Sun size={19} color="#f59e0b" /> : <Moon size={19} color="#6366f1" />}
        </button>

        {/* Maintenance Card */}
        <div
          style={{
            ...styles.card,
            backgroundColor: isDark ? '#262626' : 'white',
            border: isDark ? '1px solid #3f3f46' : 'none',
            boxShadow: isDark ? '0 12px 36px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.15)',
            textAlign: 'center',
            padding: '48px 40px',
          }}
        >
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            backgroundColor: isDark ? '#3f2a0a' : '#fef3c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Construction size={36} color="#f59e0b" />
          </div>

          <h2 style={{
            margin: '0 0 8px', fontSize: '1.35rem', fontWeight: '800',
            color: isDark ? '#f4f4f5' : '#1e293b',
          }}>
            System Maintenance
          </h2>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            justifyContent: 'center', marginBottom: '16px',
          }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b',
              display: 'inline-block', animation: 'pulse-dot 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#f59e0b' }}>
              Maintenance in Progress
            </span>
          </div>

          <p style={{
            margin: '0 0 24px', fontSize: '0.92rem', lineHeight: '1.6',
            color: isDark ? '#a1a1aa' : '#64748b',
          }}>
            {maintenance.message}
          </p>

          <div style={{
            padding: '12px 16px', borderRadius: '12px',
            backgroundColor: isDark ? '#1c1c1c' : '#f8fafc',
            border: `1px solid ${isDark ? '#3f3f46' : '#e2e8f0'}`,
            fontSize: '0.8rem', color: isDark ? '#71717a' : '#94a3b8',
          }}>
            <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Student and instructor logins are temporarily disabled.
            Administrators can still access the system via the admin portal.
          </div>

          <style>{`
            @keyframes pulse-dot {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.4; transform: scale(0.8); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div
      className="auth-container"
      style={{
        ...styles.container,
        background: isDark
          ? 'linear-gradient(180deg, #323232 0%, #262626 45%, #1a1a1a 100%)'
          : 'linear-gradient(to bottom, #f3f4f6 0%, #9ca3af 100%)',
      }}
    >
      {/* Top Left Logo */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={styles.logoContainer}
      >
        <span style={styles.logoV}>V</span>
        <span style={{ ...styles.logoText, color: isDark ? '#f4f4f5' : 'white' }}>erity</span>
      </motion.div>


      {/* Top Right Dark Mode Switch */}
      <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={toggle}
        type="button"
        style={{
          position: 'absolute',
          top: '30px',
          right: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          backgroundColor: isDark ? '#262626' : 'white',
          border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0',
          color: isDark ? '#f4f4f5' : '#374151',
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        title="Toggle dark/light mode"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? 'sun' : 'moon'}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex' }}
          >
            {isDark ? <Sun size={19} color="#f59e0b" /> : <Moon size={19} color="#6366f1" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          ...styles.card,
          backgroundColor: isDark ? '#262626' : 'white',
          border: isDark ? '1px solid #3f3f46' : 'none',
          boxShadow: isDark ? '0 12px 36px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.15)',
        }}
      >
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.25 }}
              style={styles.error}
            >
              <div>{error}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {isDesktopWeb && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(254, 242, 242, 0.92)',
              border: isDark ? '1px solid rgba(239, 68, 68, 0.28)' : '1px solid rgba(239, 68, 68, 0.24)',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '18px',
              textAlign: 'left',
              backdropFilter: 'blur(8px)',
              boxShadow: isDark
                ? '0 4px 18px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.04)'
                : '0 4px 14px rgba(220, 38, 38, 0.06)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2',
                border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fca5a5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px',
              }}
            >
              <Monitor size={17} color={isDark ? '#f87171' : '#dc2626'} strokeWidth={2.2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isDark ? '#f87171' : '#dc2626',
                  }}
                />
                <strong
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    letterSpacing: '0.01em',
                    color: isDark ? '#f87171' : '#dc2626',
                  }}
                >
                  Computer Laboratory Notice:
                </strong>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.79rem',
                  lineHeight: 1.45,
                  color: isDark ? '#fca5a5' : '#991b1b',
                }}
              >
                Students on desktop/laboratory computers must use{' '}
                <strong style={{ fontWeight: 700, color: isDark ? '#ffffff' : '#7f1d1d' }}>
                  The Verity.exe
                </strong>
                . Web access is restricted to mobile phones only.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} style={styles.form}>
          <motion.input
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05, duration: 0.3, ease: 'easeOut' }}
            type="text"
            placeholder="Username or Email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              ...styles.input,
              backgroundColor: isDark ? '#333338' : '#f9fafb',
              borderColor: isDark ? '#4a4a52' : '#e5e7eb',
              color: isDark ? '#f4f4f5' : '#4b5563',
            }}
          />

          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
            style={{ position: 'relative' }}
          >
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                ...styles.input,
                backgroundColor: isDark ? '#333338' : '#f9fafb',
                borderColor: isDark ? '#4a4a52' : '#e5e7eb',
                color: isDark ? '#f4f4f5' : '#4b5563',
                paddingRight: '40px'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: 0,
                bottom: 0,
                margin: 'auto 0',
                height: '24px',
                width: '24px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: isDark ? '#9ca3af' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                outline: 'none',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.color = isDark ? '#e4e4e7' : '#1f2937'}
              onMouseLeave={e => e.currentTarget.style.color = isDark ? '#9ca3af' : '#64748b'}
              title={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </motion.div>

          {/* Remember Account Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '4px 0 6px',
            fontSize: '0.88rem',
            userSelect: 'none'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: isDark ? '#a1a1aa' : '#4b5563',
              fontSize: '0.88rem'
            }}>
              <input
                type="checkbox"
                checked={rememberAccount}
                onChange={(e) => setRememberAccount(e.target.checked)}
                style={{
                  accentColor: '#10b981',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              />
              <span>Remember account</span>
            </label>
          </div>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3, ease: 'easeOut' }}
            whileHover={{ scale: isLoading ? 1 : 1.02, boxShadow: isLoading ? undefined : '0 6px 20px rgba(16, 185, 129, 0.4)' }}
            whileTap={{ scale: isLoading ? 1 : 0.97 }}
            type="submit"
            style={{
              ...styles.button,
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader2 size={20} className="animate-spin" />
                Authenticating...
              </span>
            ) : 'Login'}
          </motion.button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: isDark ? '#3f3f46' : '#e5e7eb' }}></div>
            <span style={{ padding: '0 10px', color: isDark ? '#71717a' : '#9ca3af', fontSize: '0.9rem' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: isDark ? '#3f3f46' : '#e5e7eb' }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => {
                if (window.electronAPI) {
                  handleGoogleElectron();
                } else {
                  setIsGoogleLoading(true);
                  googleLogin();
                }
              }}
              disabled={isGoogleLoading || isLoading}
              style={isGoogleLoading ? {
                ...styles.button,
                opacity: 0.7,
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              } : {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 20px',
                borderRadius: '8px',
                border: isDark ? '1px solid #3f3f46' : '1px solid #d1d5db',
                backgroundColor: isDark ? '#262626' : '#ffffff',
                color: isDark ? '#e4e4e7' : '#374151',
                fontSize: '0.95rem',
                fontWeight: '500',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                transition: 'background 0.2s, border-color 0.2s',
                width: '100%',
                justifyContent: 'center',
              }}
              onMouseEnter={e => { if (!isGoogleLoading && !isLoading) e.currentTarget.style.backgroundColor = isDark ? '#333333' : '#f9fafb' }}
              onMouseLeave={e => { if (!isGoogleLoading && !isLoading) e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#ffffff' }}
            >
              {isGoogleLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader2 size={18} className="animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>
          </div>

          <p style={{ ...styles.registerText, color: isDark ? '#a1a1aa' : '#9ca3af' }}>
            Don't have an account? <span onClick={onGoToRegister} style={styles.registerLink}>Register</span>
          </p>

        </form>
      </motion.div>
    </div>
  );
}

// STYLES matching the prototype
const styles = {
  container: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Arial, Helvetica, sans-serif',
    position: 'relative',
    padding: '20px',
    boxSizing: 'border-box',
    transition: 'background 0.3s ease',
  },
  logoContainer: {
    position: 'absolute',
    top: '30px',
    left: '40px',
    fontSize: '2.5rem',
    fontWeight: '900',
    fontStyle: 'italic',
    textShadow: '2px 2px 4px rgba(0,0,0,0.15)',
  },
  logoV: { color: '#10b981' },
  logoText: { color: 'white' },
  card: {
    backgroundColor: 'white',
    padding: '40px 50px',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    boxSizing: 'border-box',
    transition: 'background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  input: {
    width: '100%',
    padding: '15px',
    borderRadius: '15px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    color: '#4b5563',
    fontSize: '1rem',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
    outline: 'none',
    transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
  },
  button: {
    width: '100%',
    padding: '15px',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '15px',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '1.1rem',
    cursor: 'pointer',
    marginTop: '10px',
    boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)',
  },
  registerText: { textAlign: 'center', marginTop: '10px', color: '#9ca3af', fontSize: '0.9rem' },
  registerLink: { color: '#10b981', cursor: 'pointer', fontWeight: 'bold' },
  error: { backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.9rem', textAlign: 'center' }
};