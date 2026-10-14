import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X, CheckCircle2, AlertCircle, Loader2, ArrowLeft, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../utils/api';

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
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const emailInputRef = useRef(null);
  const digitInputRefs = useRef([]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setNewEmail('');
      setOtpDigits(['', '', '', '', '', '']);
      setError('');
      setDevOtp(null);
      setLoading(false);
      setCountdown(0);
      setTimeout(() => emailInputRef.current?.focus(), 80);
    }
  }, [isOpen]);

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
      const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/send-email-change-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: cleanEmail })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send verification code.');
      }

      setDevOtp(data.devOtp || null);
      setStep(2);
      setCountdown(45);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => digitInputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e, codeOverride = null) => {
    if (e) e.preventDefault();
    const code = codeOverride || otpDigits.join('');
    if (code.length < 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const cleanEmail = newEmail.trim().toLowerCase();
      const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/verify-email-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: cleanEmail,
          otp: code
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid verification code.');
      }

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

  const handleDigitChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    if (clean.length > 1) {
      handlePasteDirect(clean, index);
      return;
    }

    const char = clean.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);
    setError('');

    if (char && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('')) {
      handleVerifyCode(null, fullCode);
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const newDigits = [...otpDigits];
      if (!newDigits[index] && index > 0) {
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        digitInputRefs.current[index - 1]?.focus();
        e.preventDefault();
      } else {
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePasteDirect = (pastedText, startIndex = 0) => {
    const clean = (pastedText || '').replace(/\D/g, '').slice(0, 6);
    if (!clean) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < clean.length; i++) {
      const targetIndex = (startIndex + i < 6) ? startIndex + i : i;
      newDigits[targetIndex] = clean[i];
    }
    setOtpDigits(newDigits);
    setError('');

    const nextFocus = Math.min(5, startIndex + clean.length);
    digitInputRefs.current[nextFocus]?.focus();

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('')) {
      handleVerifyCode(null, fullCode);
    }
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData?.getData('text') || '';
    if (paste) {
      handlePasteDirect(paste, 0);
      e.preventDefault();
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
          {/* Header */}
          <div
            style={{
              padding: '20px 24px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${colors.border}`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981'
                }}
              >
                <Mail size={20} />
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: colors.title
                  }}
                >
                  {step === 1 ? 'Change Email Address' : 'Verify New Email'}
                </h3>
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: '0.8rem',
                    color: colors.subText
                  }}
                >
                  {step === 1 ? 'Send a verification code first' : 'Enter 6-digit confirmation code'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={loading}
              style={{
                background: 'none',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: colors.subText,
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease'
              }}
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '24px' }}>
            {/* Error banner */}
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

            {/* STEP 1: ENTER NEW EMAIL */}
            {step === 1 && (
              <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {currentEmail && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: isDark ? '#1e1e1e' : '#f8fafc',
                      border: `1px solid ${colors.border}`,
                      fontSize: '0.82rem',
                      color: colors.subText,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>Current email:</span>
                    <strong style={{ color: colors.title }}>{currentEmail}</strong>
                  </div>
                )}

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: colors.title,
                      marginBottom: '8px'
                    }}
                  >
                    New Email Address
                  </label>
                  <input
                    ref={emailInputRef}
                    type="email"
                    placeholder="Enter your new email address"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      if (error) setError('');
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: `1px solid ${colors.inputBorder}`,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      fontSize: '0.92rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                  />
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontSize: '0.78rem',
                      color: colors.subText
                    }}
                  >
                    A 6-digit confirmation code will be sent to this email to verify ownership.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: 'transparent',
                      color: colors.title,
                      fontWeight: '600',
                      fontSize: '0.88rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !newEmail.trim()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      fontWeight: '700',
                      fontSize: '0.88rem',
                      cursor: loading || !newEmail.trim() ? 'not-allowed' : 'pointer',
                      opacity: loading || !newEmail.trim() ? 0.65 : 1,
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Code</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: VERIFY CODE */}
            {step === 2 && (
              <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: isDark ? '#1a2e22' : '#ecfdf5',
                    border: isDark ? '1px solid #065f46' : '1px solid #a7f3d0',
                    color: isDark ? '#6ee7b7' : '#047857',
                    fontSize: '0.84rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                    <CheckCircle2 size={16} />
                    <span>Verification code sent!</span>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '0.8rem', opacity: 0.9 }}>
                    Enter the 6-digit code sent to <strong style={{ color: isDark ? '#ffffff' : '#064e3b' }}>{newEmail}</strong>.
                  </div>
                </div>

                {/* Dev Code Pill if SMTP is simulated */}
                {devOtp && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(52, 211, 153, 0.12)' : '#f0fdf4',
                      border: '1px dashed #34d399',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem'
                    }}
                  >
                    <span style={{ color: isDark ? '#a7f3d0' : '#15803d', fontWeight: '500' }}>
                      Dev mode simulated code:
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePasteDirect(devOtp, 0)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                      title="Click to fill dev code"
                    >
                      {devOtp} (Click to fill)
                    </button>
                  </div>
                )}

                {/* 6 OTP boxes */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px',
                    margin: '6px 0'
                  }}
                  onPaste={handlePaste}
                >
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => (digitInputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleDigitChange(idx, e.target.value)}
                      onKeyDown={e => handleDigitKeyDown(idx, e)}
                      onFocus={e => e.target.select()}
                      style={{
                        width: '46px',
                        height: '52px',
                        borderRadius: '12px',
                        border: digit
                          ? '2px solid #10b981'
                          : `1.5px solid ${colors.boxBorder}`,
                        backgroundColor: colors.boxBg,
                        color: colors.title,
                        fontSize: '1.45rem',
                        fontWeight: '700',
                        textAlign: 'center',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'all 0.15s ease',
                        boxShadow: digit ? '0 0 0 3px rgba(16, 185, 129, 0.18)' : 'none'
                      }}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.subText,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0
                    }}
                  >
                    <ArrowLeft size={14} /> Back to email
                  </button>

                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={countdown > 0 || loading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: countdown > 0 ? colors.subText : '#10b981',
                      cursor: countdown > 0 || loading ? 'not-allowed' : 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0
                    }}
                  >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : undefined} />
                    {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: 'transparent',
                      color: colors.title,
                      fontWeight: '600',
                      fontSize: '0.88rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || otpDigits.join('').length < 6}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      fontWeight: '700',
                      fontSize: '0.88rem',
                      cursor: loading || otpDigits.join('').length < 6 ? 'not-allowed' : 'pointer',
                      opacity: loading || otpDigits.join('').length < 6 ? 0.65 : 1,
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>Verify & Change Email</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
