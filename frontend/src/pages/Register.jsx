import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDarkMode } from '../hooks/useDarkMode';
import { useGoogleAuthFlow } from '../hooks/useGoogleAuthFlow';
import { useOtpInput } from '../hooks/useOtpInput';
import {
  fetchPasswordPolicies,
  sendRegisterOtp,
  verifyRegisterOtp,
  resendRegisterOtp
} from '../data/registerService';
import RegisterFormCard from '../components/auth/RegisterFormCard';
import RegisterOtpCard from '../components/auth/RegisterOtpCard';
import AuthToast from '../components/auth/AuthToast';
import { styles } from './registerStyles';

export default function Register({ onBackToLogin, onLogin }) {
  const { isDark, toggle } = useDarkMode();
  const [step, setStep] = useState('form');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Student'
  });
  const [message, setMessage] = useState(null);
  const [policies, setPolicies] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const handleVerifyOtp = async (e, codeOverride = null) => {
    if (e) e.preventDefault();
    const cleanOtp = (codeOverride || otpDigits.join('')).trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setMessage({ type: 'error', text: 'Please enter all 6 digits of the verification code.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const { ok, data } = await verifyRegisterOtp({ email: formData.email, otp: cleanOtp });
      if (ok) {
        setMessage({
          type: 'success',
          text: data?.pendingApproval
            ? 'Account created! Your instructor account is pending administrator approval. Redirecting to login...'
            : 'Account verified and created successfully! Redirecting to login...'
        });
        setTimeout(() => onBackToLogin(), 2000);
      } else {
        setMessage({ type: 'error', text: data?.message || 'Verification failed. Please check your code.' });
      }
    } catch (_) {
      setMessage({ type: 'error', text: 'Could not connect to server.' });
    } finally {
      setLoading(false);
    }
  };

  const {
    otpDigits,
    inputRefs,
    resetOtp,
    handleOtpChange,
    handleOtpKeyDown,
    handleOtpPaste,
  } = useOtpInput({
    onComplete: (code) => handleVerifyOtp(null, code),
    onClearError: () => {
      if (message && message.type === 'error') setMessage(null);
    }
  });

  const { isGoogleLoading, startExternalGoogleAuth } = useGoogleAuthFlow({
    onSuccess: (user, token, data) => {
      if (data?.user?.status === 'Pending') {
        setMessage({ type: 'info', text: 'Account created! Your instructor account is pending administrator approval.' });
        setTimeout(() => onBackToLogin(), 3500);
        return;
      }
      try {
        localStorage.setItem('verity_saved_account_email', data?.user?.email || '');
        localStorage.setItem('verity_remember_account', 'true');
        if (window.electronAPI?.localDB?.setLocal) {
          window.electronAPI.localDB.setLocal('verity_saved_account_email', data?.user?.email || '').catch(() => {});
          window.electronAPI.localDB.setLocal('verity_remember_account', 'true').catch(() => {});
        }
      } catch (_) {}

      if (onLogin && data?.user && data?.token) {
        onLogin(data.user, data.token);
      } else {
        setMessage({ type: 'success', text: 'Google sign-up successful! Redirecting...' });
        setTimeout(() => onBackToLogin(), 1200);
      }
    },
    onError: (errMsg) => setMessage({ type: 'error', text: errMsg || 'Google Registration failed' })
  });

  useEffect(() => {
    fetchPasswordPolicies().then(p => { if (p) setPolicies(p); });
  }, []);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (message && message.type !== 'success') {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => inputRefs.current[0]?.focus(), 120);
    }
  }, [step, inputRefs]);

  const handleGoogleClick = () => {
    setMessage(null);
    startExternalGoogleAuth({
      role: formData.role || 'Student',
      initialPassword: formData.password || ''
    });
  };

  const handleInitiateOtp = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match. Please try again.' });
      return;
    }
    if (policies) {
      const pw = formData.password || '';
      if (policies.minLength8 && pw.length < 8) {
        setMessage({ type: 'error', text: 'Password must be at least 8 characters long.' });
        return;
      }
      if (policies.numbers && !/\d/.test(pw)) {
        setMessage({ type: 'error', text: 'Password must contain at least one number.' });
        return;
      }
      if (policies.specialChars && !/[!@#$%^&*(),.?":{}|<>_\-\\[\];'`~+/=]/.test(pw)) {
        setMessage({ type: 'error', text: 'Password must contain at least one special character.' });
        return;
      }
    }

    const payload = {
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email.trim(),
      password: formData.password,
      role: formData.role
    };

    setLoading(true);
    try {
      const { ok, data } = await sendRegisterOtp(payload);
      if (ok) {
        setStep('otp');
        resetOtp();
        setMessage({ type: 'info', text: `A 6-digit verification code has been sent to ${payload.email}.` });
        setResendCooldown(30);
      } else {
        setMessage({ type: 'error', text: data?.message || 'Failed to send verification code.' });
      }
    } catch (_) {
      setMessage({ type: 'error', text: 'Could not connect to server. Make sure server is running.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setMessage(null);
    try {
      const { ok, data } = await resendRegisterOtp(formData.email);
      if (ok) {
        resetOtp();
        setMessage({ type: 'info', text: 'A new 6-digit verification code was sent to your email.' });
        setResendCooldown(45);
      } else {
        setMessage({ type: 'error', text: data?.message || 'Failed to resend code.' });
      }
    } catch (_) {
      setMessage({ type: 'error', text: 'Could not connect to server.' });
    } finally {
      setResending(false);
    }
  };

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
      <div style={styles.logoContainer}>
        <span style={styles.logoV}>V</span>
        <span style={{ ...styles.logoText, color: isDark ? '#f4f4f5' : 'white' }}>erity</span>
      </div>

      <button
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
        className="btn-anim"
        title="Toggle dark/light mode"
      >
        {isDark ? <Moon size={19} color="#6366f1" /> : <Sun size={19} color="#f59e0b" />}
      </button>

      <AuthToast message={message} isDark={isDark} onClose={() => setMessage(null)} />

      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          ...styles.card,
          backgroundColor: isDark ? '#262626' : 'white',
          border: isDark ? '1px solid #3f3f46' : 'none',
          boxShadow: isDark ? '0 12px 36px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.15)',
        }}
      >
        {step === 'form' ? (
          <RegisterFormCard
            isDark={isDark}
            formData={formData}
            setFormData={setFormData}
            policies={policies}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            loading={loading}
            isGoogleLoading={isGoogleLoading}
            onSubmit={handleInitiateOtp}
            onGoogleClick={handleGoogleClick}
            onBackToLogin={onBackToLogin}
          />
        ) : (
          <RegisterOtpCard
            isDark={isDark}
            email={formData.email}
            otpDigits={otpDigits}
            inputRefs={inputRefs}
            onOtpChange={handleOtpChange}
            onOtpKeyDown={handleOtpKeyDown}
            onOtpPaste={handleOtpPaste}
            loading={loading}
            resending={resending}
            resendCooldown={resendCooldown}
            onResendOtp={handleResendOtp}
            onVerifyOtp={handleVerifyOtp}
            onBackToForm={() => { setStep('form'); setMessage(null); }}
            onBackToLogin={onBackToLogin}
          />
        )}
      </motion.div>
    </div>
  );
}
