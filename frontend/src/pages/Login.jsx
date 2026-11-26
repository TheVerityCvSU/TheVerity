import { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDarkMode } from '../hooks/useDarkMode';
import { isDesktopWebBrowser } from '../utils/deviceUtils';
import {
  loadSavedAccountEmail,
  persistSavedAccountEmail,
  getRememberAccountPreference,
  checkMaintenanceStatus,
  loginUser,
  authenticateGoogleToken,
} from '../data/loginService';
import { useGoogleAuthFlow } from '../hooks/useGoogleAuthFlow';
import { styles } from './loginStyles';
import MaintenanceOverlay from '../components/auth/MaintenanceOverlay';
import LoginFormCard from '../components/auth/LoginFormCard';

export default function Login({ onLogin, onGoToRegister }) {
  const { isDark, toggle } = useDarkMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });
  const [rememberAccount, setRememberAccount] = useState(getRememberAccountPreference);
  const [isDesktopWeb, setIsDesktopWeb] = useState(() => isDesktopWebBrowser());

  useEffect(() => {
    if (window.electronAPI) return;
    const checkEnvironment = () => {
      const isDesktop = isDesktopWebBrowser();
      setIsDesktopWeb((prev) => (prev !== isDesktop ? isDesktop : prev));
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

  useEffect(() => {
    loadSavedAccountEmail().then((saved) => {
      if (saved) setEmail(saved);
    });
  }, []);

  useEffect(() => {
    const check = async () => {
      const status = await checkMaintenanceStatus();
      setMaintenance(status.enabled ? status : { enabled: false, message: '' });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAuthSuccess = (user, token) => {
    persistSavedAccountEmail(user?.email || email, rememberAccount);
    onLogin(user, token);
  };

  const { isGoogleLoading, setIsGoogleLoading, startExternalGoogleAuth } = useGoogleAuthFlow({
    onSuccess: handleAuthSuccess,
    onError: setError,
  });

  const handleGoogleSuccess = async (tokenResponse) => {
    setIsGoogleLoading(true);
    try {
      const { ok, data } = await authenticateGoogleToken(tokenResponse);
      if (data.maintenance) {
        setMaintenance({ enabled: true, message: data.message });
        setIsGoogleLoading(false);
        return;
      }
      if (ok && data.user) {
        handleAuthSuccess(data.user, data.token);
      } else {
        setError(data.message || 'Google login failed on server');
      }
    } catch (_) {
      setError('Could not connect to server.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => {
      setError('Google Login failed');
      setIsGoogleLoading(false);
    },
    onNonOAuthError: () => {
      setError('Google Login failed');
      setIsGoogleLoading(false);
    },
    flow: 'implicit',
    hosted_domain: 'cvsu.edu.ph',
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { ok, data } = await loginUser(email, password);
      if (data.maintenance) {
        setMaintenance({ enabled: true, message: data.message });
        setIsLoading(false);
        return;
      }

      if (ok && data.user) {
        handleAuthSuccess(data.user, data.token);
      } else {
        setError(data.message || 'Invalid login credentials');
      }
    } catch (err) {
      console.error('[Login] Login request failed:', err);
      setError(
        err?.message && !err.message.includes('fetch')
          ? err.message
          : 'Could not connect to server. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (maintenance.enabled) {
    return <MaintenanceOverlay isDark={isDark} toggle={toggle} message={maintenance.message} styles={styles} />;
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
      <LoginFormCard
        error={error}
        isDesktopWeb={isDesktopWeb}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        rememberAccount={rememberAccount}
        setRememberAccount={setRememberAccount}
        handleLogin={handleLogin}
        isLoading={isLoading}
        startExternalGoogleAuth={startExternalGoogleAuth}
        isGoogleLoading={isGoogleLoading}
        onGoToRegister={onGoToRegister}
        isDark={isDark}
        styles={styles}
      />
    </div>
  );
}
