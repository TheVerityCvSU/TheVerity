import React from 'react';
import { X } from 'lucide-react';
import { getModalStyles } from './submissionModalStyles';

export default function ActivityConfirmModals({
  isDark,
  showSubmitModal,
  showUnsubmitModal,
  onCloseSubmit,
  onCloseUnsubmit,
  onConfirmSubmit,
  onConfirmUnsubmit
}) {
  const styles = getModalStyles(isDark);

  return (
    <>
      {/* SUBMIT CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div style={styles.confirmModalOverlay} onClick={onCloseSubmit}>
          <div style={styles.confirmModalCard} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: isDark ? '#f3f4f6' : '#0f172a' }}>
                Submit Activity
              </h3>
              <button
                type="button"
                onClick={onCloseSubmit}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#9ca3af' : '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: isDark ? '#d1d5db' : '#334155' }}>
              Are you ready to submit your work for this activity?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={onCloseSubmit}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #4b5563' : '1px solid #cbd5e1',
                  backgroundColor: 'transparent',
                  color: isDark ? '#d1d5db' : '#475569',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmSubmit}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                Submit Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNSUBMIT CONFIRMATION MODAL */}
      {showUnsubmitModal && (
        <div style={styles.confirmModalOverlay} onClick={onCloseUnsubmit}>
          <div style={styles.confirmModalCard} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: isDark ? '#f3f4f6' : '#0f172a' }}>
                Unsubmit Activity
              </h3>
              <button
                type="button"
                onClick={onCloseUnsubmit}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#9ca3af' : '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: isDark ? '#d1d5db' : '#334155' }}>
              Are you sure you want to unsubmit? You will be able to edit and re-submit your code.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={onCloseUnsubmit}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #4b5563' : '1px solid #cbd5e1',
                  backgroundColor: 'transparent',
                  color: isDark ? '#d1d5db' : '#475569',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmUnsubmit}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                Confirm Unsubmit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
