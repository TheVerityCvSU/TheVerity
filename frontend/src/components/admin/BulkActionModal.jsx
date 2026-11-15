import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import PasswordRequirements from '../PasswordRequirements';

export default function BulkActionModal({
  isOpen,
  modalAction,
  selected = [],
  users = [],
  newPassword = '',
  setNewPassword = () => {},
  showBulkPassword = false,
  setShowBulkPassword = () => {},
  bulkError = null,
  bulkLoading = false,
  policies = null,
  onClose = () => {},
  onConfirm = () => {},
  isDark = false,
  styles = {}
}) {
  const isVisible = isOpen !== undefined ? Boolean(isOpen && modalAction) : Boolean(modalAction);
  const selectedList = Array.isArray(selected) ? selected : [];
  const usersList = Array.isArray(users) ? users : [];

  const getUserDisplayName = (email) => {
    const found = usersList.find((u) => u && u.email === email);
    return found?.name || email;
  };

  const selectedDisplayNames =
    selectedList.length > 0
      ? selectedList.map(getUserDisplayName).join(', ')
      : 'No users selected';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div style={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            style={{ ...styles.modalCard, maxWidth: '400px' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <h2 style={{ margin: '0 0 16px', color: isDark ? '#f1f5f9' : '#1e293b' }}>
              {modalAction === 'reset' ? 'Reset Password' : modalAction === 'suspend' ? 'Suspend Account' : 'Delete Account'}
            </h2>
            <div style={{ marginBottom: '20px', color: isDark ? '#cbd5e1' : '#334155', fontSize: '0.9rem' }}>
              {modalAction === 'reset' ? (
                <>
                  <p>Enter a new password for the selected user(s):</p>
                  <p style={{ fontWeight: '700', color: '#007bff', marginBottom: '12px' }}>
                    {selectedDisplayNames}
                  </p>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showBulkPassword ? 'text' : 'password'}
                      placeholder="New Password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{ ...styles.inputPill, paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowBulkPassword(!showBulkPassword)}
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
                      title={showBulkPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showBulkPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <PasswordRequirements password={newPassword} policies={policies} />
                </>
              ) : (
                <>
                  <p>Are you sure you want to {modalAction === 'suspend' ? 'suspend' : 'delete'} this account?</p>
                  <p style={{ fontWeight: '700', color: modalAction === 'delete' ? '#ef4444' : '#f59e0b', marginTop: '8px' }}>
                    {selectedDisplayNames}
                  </p>
                </>
              )}
            </div>
            {bulkError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: isDark ? '#3f1d1d' : '#fee2e2',
                color: isDark ? '#fca5a5' : '#b91c1c',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px'
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{bulkError}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <motion.button
                type="button"
                disabled={bulkLoading}
                whileHover={bulkLoading ? {} : { scale: 1.05 }}
                whileTap={bulkLoading ? {} : { scale: 0.95 }}
                onClick={onClose}
                style={{
                  ...styles.submitBlueBtn,
                  backgroundColor: isDark ? '#374151' : '#e2e8f0',
                  color: isDark ? '#cbd5e1' : '#475569',
                  flex: 1,
                  boxShadow: 'none',
                  opacity: bulkLoading ? 0.6 : 1,
                  cursor: bulkLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </motion.button>
              <motion.button
                type="button"
                disabled={bulkLoading}
                whileHover={bulkLoading ? {} : { scale: 1.05 }}
                whileTap={bulkLoading ? {} : { scale: 0.95 }}
                onClick={onConfirm}
                style={{
                  ...styles.submitBlueBtn,
                  flex: 1,
                  backgroundColor: modalAction === 'delete' ? '#ef4444' : '#007bff',
                  opacity: bulkLoading ? 0.7 : 1,
                  cursor: bulkLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {bulkLoading ? 'Processing...' : 'Confirm'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

