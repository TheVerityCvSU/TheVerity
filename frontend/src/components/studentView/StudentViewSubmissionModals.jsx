import { X } from 'lucide-react';

export default function StudentViewSubmissionModals({
  showSubmitModal,
  setShowSubmitModal,
  strictCompiler,
  diagnosticsCount,
  handleConfirmSubmit,
  showUnsubmitModal,
  setShowUnsubmitModal,
  handleConfirmUnsubmit,
  isDark
}) {
  return (
    <>
      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowSubmitModal(false)}
        >
          <div
            style={{
              backgroundColor: isDark ? '#242424' : '#ffffff',
              color: isDark ? '#E8EAED' : '#1e293b',
              borderRadius: '18px',
              padding: '24px 28px',
              width: '90%',
              maxWidth: '460px',
              boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: isDark ? '1px solid #3d3d3d' : '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: isDark ? '#f3f4f6' : '#0f172a' }}>
                Submit Activity
              </h3>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#9ca3af' : '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {strictCompiler && diagnosticsCount > 0 ? (
              <div
                style={{
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                  border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  color: isDark ? '#fcd34d' : '#92400e'
                }}
              >
                <strong>Notice:</strong> Strict compiler mode is active and your code currently has compiler errors/warnings. Are you sure you want to submit anyway?
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: isDark ? '#d1d5db' : '#334155' }}>
                Are you ready to submit your work? You will enter read-only review mode after submission until you unsubmit.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #4b5563' : '1px solid #cbd5e1',
                  backgroundColor: 'transparent',
                  color: isDark ? '#d1d5db' : '#475569',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
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
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                }}
              >
                Submit Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsubmit Confirmation Modal */}
      {showUnsubmitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowUnsubmitModal(false)}
        >
          <div
            style={{
              backgroundColor: isDark ? '#242424' : '#ffffff',
              color: isDark ? '#E8EAED' : '#1e293b',
              borderRadius: '18px',
              padding: '24px 28px',
              width: '90%',
              maxWidth: '460px',
              boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: isDark ? '1px solid #3d3d3d' : '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: isDark ? '#f3f4f6' : '#0f172a' }}>
                Unsubmit Activity
              </h3>
              <button
                type="button"
                onClick={() => setShowUnsubmitModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#9ca3af' : '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowUnsubmitModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #4b5563' : '1px solid #cbd5e1',
                  backgroundColor: 'transparent',
                  color: isDark ? '#d1d5db' : '#475569',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUnsubmit}
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
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
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
