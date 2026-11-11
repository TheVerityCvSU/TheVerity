import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { changeUserPassword } from '../data/passwordService';
import { useCurrentUser, updateCurrentUser } from '../hooks/useCurrentUser';
import PasswordInputField from './passwordModal/PasswordInputField';
import ChangePasswordHeader from './passwordModal/ChangePasswordHeader';
import GoogleSsoNotice from './passwordModal/GoogleSsoNotice';

/**
 * ChangePasswordModal
 * Pop-up modal that requires the user to input their current password first
 * before changing their password to a new one.
 */
export default function ChangePasswordModal({
  isOpen,
  onClose,
  onSuccess,
  isDark = false
}) {
  const { currentUser } = useCurrentUser();
  const isGoogleSso = currentUser?.password === 'google_sso_user';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setError('');
      setLoading(false);
      setTimeout(() => currentInputRef.current?.focus(), 80);
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

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!isGoogleSso && !currentPassword) {
      setError('Please enter your current password.');
      currentInputRef.current?.focus();
      return;
    }

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (!isGoogleSso && newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await changeUserPassword({
        currentPassword: isGoogleSso ? 'google_sso_user' : currentPassword,
        newPassword
      });

      updateCurrentUser({ password: newPassword });

      if (onSuccess) {
        onSuccess(data.message || 'Password changed successfully!');
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update password. Please check your current password.');
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
    inputText: isDark ? '#F9FAFB' : '#111827'
  };

  const isSubmitDisabled = loading || (!isGoogleSso && !currentPassword) || !newPassword || !confirmPassword;

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
          <ChangePasswordHeader
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
                  marginBottom: '18px',
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isGoogleSso ? (
                <GoogleSsoNotice isDark={isDark} />
              ) : (
                <PasswordInputField
                  label="Current Password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (error) setError('');
                  }}
                  showPassword={showCurrent}
                  onToggleShow={() => setShowCurrent(!showCurrent)}
                  inputRef={currentInputRef}
                  colors={colors}
                  iconSize={16}
                />
              )}

              <PasswordInputField
                label="New Password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (error) setError('');
                }}
                showPassword={showNew}
                onToggleShow={() => setShowNew(!showNew)}
                colors={colors}
                iconSize={18}
              />

              <PasswordInputField
                label="Confirm New Password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError('');
                }}
                showPassword={showConfirm}
                onToggleShow={() => setShowConfirm(!showConfirm)}
                colors={colors}
                iconSize={18}
              />

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
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
                  disabled={isSubmitDisabled}
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
                    cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                    opacity: isSubmitDisabled ? 0.65 : 1,
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>Change Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
