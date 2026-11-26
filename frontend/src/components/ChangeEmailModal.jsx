import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { sendEmailChangeOtp, verifyEmailChange } from '../data/emailChange';
import ChangeEmailHeader from './emailChange/ChangeEmailHeader';
import ChangeEmailStepOne from './emailChange/ChangeEmailStepOne';
import ChangeEmailStepTwo from './emailChange/ChangeEmailStepTwo';
import { useOtpInput } from './emailChange/useOtpInput';

/**
 * ChangeEmailModal
 * Pop-up modal that requires the user to send and verify a 6-digit confirmation code
 * to their new email address before updating their email credentials.
 */
export default function ChangeEmailModal({
  isOpen,
  onClose,
  currentEmail = '',
  onSuccess,
  isDark = false
}) {
  const [step, setStep] = useState(1); // 1 = enter email, 2 = verify otp
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const emailInputRef = useRef(null);
  const handleVerifyRef = useRef(null);

  const {
    otpDigits,
    digitInputRefs,
    resetOtp,
    handleDigitChange,
    handleDigitKeyDown,
    handlePasteDirect,
    handlePaste
  } = useOtpInput((fullCode) => handleVerifyRef.current?.(null, fullCode));

  const handleVerifyCode = async (e, codeOverride = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const code = codeOverride || otpDigits.join('');
    if (code.length < 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const cleanEmail = newEmail.trim().toLowerCase();
      const data = await verifyEmailChange(cleanEmail, code);

      if (data.token) {
        localStorage.setItem('verity_token', data.token);
        localStorage.setItem('token', data.token);
      }

      if (data.user) {
        try {
          const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
          const updated = { ...stored, ...data.user, email: cleanEmail };
          localStorage.setItem('currentUser', JSON.stringify(updated));
        } catch (_) {}
      }

      if (onSuccess) {
        onSuccess(cleanEmail, data.user);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    handleVerifyRef.current = handleVerifyCode;
  });

  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setStep(1);
      setNewEmail('');
      setError('');
      setDevOtp(null);
      setLoading(false);
      setCountdown(0);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => resetOtp(), 0);
    const focusTimer = setTimeout(() => emailInputRef.current?.focus(), 80);
    return () => {
      clearTimeout(t);
      clearTimeout(focusTimer);
    };
  }, [isOpen, resetOtp]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, loading]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      emailInputRef.current?.focus();
      return;
    }

    if (cleanEmail === (currentEmail || '').trim().toLowerCase()) {
      setError('New email must be different from your current email.');
      emailInputRef.current?.focus();
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await sendEmailChangeOtp(cleanEmail);
      setDevOtp(data.devOtp || null);
      setStep(2);
      setCountdown(45);
      resetOtp();
      setTimeout(() => digitInputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const colors = {
    overlayBg: 'rgba(0, 0, 0, 0.65)',
    cardBg: isDark ? '#262626' : '#FFFFFF',
    border: isDark ? '#404040' : '#E5E7EB',
    title: isDark ? '#F3F4F6' : '#111827',
    subText: isDark ? '#9CA3AF' : '#6B7280',
    inputBg: isDark ? '#333333' : '#F9FAFB',
    inputBorder: isDark ? '#4B5563' : '#D1D5DB',
    inputText: isDark ? '#F9FAFB' : '#111827',
    boxBg: isDark ? '#1f1f23' : '#f8fafc',
    boxBorder: isDark ? '#4a4a52' : '#cbd5e1'
  };

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.overlayBg,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '16px'
        }}
        onClick={() => {
          if (!loading) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 14 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: '20px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 24px 50px rgba(0,0,0,0.4)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ChangeEmailHeader
            step={step}
            onClose={onClose}
            loading={loading}
            colors={colors}
            isDark={isDark}
          />

          {/* Body */}
          <div style={{ padding: '24px' }}>
            {error && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                  border: isDark ? '1px solid #7f1d1d' : '1px solid #fecaca',
                  color: '#ef4444',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {step === 1 ? (
              <ChangeEmailStepOne
                currentEmail={currentEmail}
                newEmail={newEmail}
                setNewEmail={setNewEmail}
                onSubmit={handleSendCode}
                onClose={onClose}
                loading={loading}
                error={error}
                setError={setError}
                emailInputRef={emailInputRef}
                colors={colors}
                isDark={isDark}
              />
            ) : (
              <ChangeEmailStepTwo
                newEmail={newEmail}
                otpDigits={otpDigits}
                digitInputRefs={digitInputRefs}
                handleDigitChange={(idx, val) => handleDigitChange(idx, val, setError)}
                handleDigitKeyDown={handleDigitKeyDown}
                handlePaste={(e) => handlePaste(e, setError)}
                handlePasteDirect={(txt, idx) => handlePasteDirect(txt, idx, setError)}
                devOtp={devOtp}
                countdown={countdown}
                loading={loading}
                onBack={() => {
                  setStep(1);
                  setError('');
                }}
                onResend={handleSendCode}
                onClose={onClose}
                onSubmit={handleVerifyCode}
                colors={colors}
                isDark={isDark}
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
