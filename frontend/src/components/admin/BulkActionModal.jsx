import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle, X } from 'lucide-react';
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

  const modalTitle =
    modalAction === 'reset'
      ? 'Reset password?'
      : modalAction === 'suspend'
      ? 'Suspend account?'
      : 'Delete account?';

  const confirmBtnText = bulkLoading
    ? 'Processing...'
    : modalAction === 'reset'
    ? 'Reset password'
    : modalAction === 'suspend'
    ? 'Suspend account'
    : 'Delete account';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-5 z-[99999]"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: isDark ? 'rgba(17, 17, 17, 0.75)' : 'rgba(235, 235, 235, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(5px)',
            padding: '20px'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-[440px] text-left rounded-3xl p-7 shadow-2xl relative"
            style={{
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              border: isDark ? '1px solid #2C2C2E' : '1px solid #E5E7EB',
              borderRadius: '24px',
              padding: '28px',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'left',
              boxShadow: isDark
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                : '0 20px 40px -10px rgba(0, 0, 0, 0.12)',
              position: 'relative'
            }}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top-Right Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: isDark ? '#9CA3AF' : '#64748B',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease, color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#2C2C2E' : '#F1F5F9';
                e.currentTarget.style.color = isDark ? '#F3F4F6' : '#0F172A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = isDark ? '#9CA3AF' : '#64748B';
              }}
            >
              <X size={18} />
            </button>

            {/* Title */}
            <h2
              style={{
                margin: '0 0 16px',
                fontSize: '1.25rem',
                fontWeight: '700',
                color: isDark ? '#F9FAFB' : '#111827',
                paddingRight: '28px',
                textAlign: 'left'
              }}
            >
              {modalTitle}
            </h2>

            {/* Warning description with dynamic entity name in font-semibold */}
            <div
              className="text-left"
              style={{
                marginBottom: '20px',
                color: isDark ? '#D1D5DB' : '#374151',
                fontSize: '0.9rem',
                lineHeight: '1.55',
                textAlign: 'left'
              }}
            >
              {modalAction === 'reset' ? (
                <>
                  <p style={{ margin: '0 0 12px 0' }}>
                    Enter a new password for{' '}
                    <span
                      className="font-semibold"
                      style={{ fontWeight: 600, color: isDark ? '#60A5FA' : '#2563EB' }}
                    >
                      {selectedDisplayNames}
                    </span>
                    :
                  </p>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showBulkPassword ? 'text' : 'password'}
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{
                        ...styles.inputPill,
                        width: '100%',
                        paddingRight: '40px',
                        backgroundColor: isDark ? '#2C2C2E' : '#F8FAFC',
                        border: isDark ? '1px solid #3A3A3C' : '1px solid #CBD5E1',
                        color: isDark ? '#F9FAFB' : '#0F172A',
                        boxSizing: 'border-box'
                      }}
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
                        color: isDark ? '#9CA3AF' : '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        outline: 'none',
                        transition: 'color 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = isDark ? '#E4E4E7' : '#1F2937')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#9CA3AF' : '#64748B')}
                      title={showBulkPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showBulkPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <PasswordRequirements password={newPassword} policies={policies} />
                </>
              ) : (
                <p style={{ margin: 0 }}>
                  Are you sure you want to {modalAction === 'suspend' ? 'suspend' : 'permanently delete'}{' '}
                  <span
                    className="font-semibold"
                    style={{
                      fontWeight: 600,
                      color:
                        modalAction === 'delete'
                          ? isDark
                            ? '#F87171'
                            : '#DC2626'
                          : isDark
                          ? '#FBBF24'
                          : '#D97706'
                    }}
                  >
                    {selectedDisplayNames}
                  </span>
                  ?{' '}
                  {modalAction === 'delete'
                    ? 'This action cannot be undone.'
                    : 'The affected user(s) will lose access until reactivated.'}
                </p>
              )}
            </div>

            {bulkError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? '#3F1D1D' : '#FEE2E2',
                  color: isDark ? '#FCA5A5' : '#B91C1C',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{bulkError}</span>
              </div>
            )}

            {/* Right-aligned footer buttons: justify-end gap-3 */}
            <div
              className="flex justify-end gap-3"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}
            >
              <button
                type="button"
                disabled={bulkLoading}
                onClick={onClose}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: isDark ? '1px solid #3A3A3C' : '1px solid #D1D5DB',
                  backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
                  color: isDark ? '#D1D5DB' : '#374151',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: bulkLoading ? 'not-allowed' : 'pointer',
                  opacity: bulkLoading ? 0.6 : 1,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!bulkLoading) e.currentTarget.style.backgroundColor = isDark ? '#3A3A3C' : '#F3F4F6';
                }}
                onMouseLeave={(e) => {
                  if (!bulkLoading) e.currentTarget.style.backgroundColor = isDark ? '#2C2C2E' : '#FFFFFF';
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkLoading}
                onClick={onConfirm}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: modalAction === 'delete' ? '#DC2626' : '#2563EB',
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: bulkLoading ? 'not-allowed' : 'pointer',
                  opacity: bulkLoading ? 0.7 : 1,
                  boxShadow:
                    modalAction === 'delete'
                      ? '0 4px 12px rgba(220, 38, 38, 0.35)'
                      : '0 4px 12px rgba(37, 99, 235, 0.35)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!bulkLoading) {
                    e.currentTarget.style.backgroundColor =
                      modalAction === 'delete' ? '#B91C1C' : '#1D4ED8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!bulkLoading) {
                    e.currentTarget.style.backgroundColor =
                      modalAction === 'delete' ? '#DC2626' : '#2563EB';
                  }
                }}
              >
                {confirmBtnText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
