import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import { getModalStyles } from './submissionModalStyles';

export default function StrictLockStartModal({
  isOpen,
  isDark = false,
  onClose,
  onConfirm,
  assignmentTitle = 'this activity'
}) {
  if (!isOpen) return null;

  const styles = getModalStyles(isDark);

  return (
    <div style={styles.confirmModalOverlay} onClick={onClose}>
      <div 
        style={{
          ...styles.confirmModalCard,
          maxWidth: '500px',
          padding: '28px 30px',
          gap: '18px'
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: isDark ? '#f87171' : '#dc2626' }}>
              Strict Lockdown Activity
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: isDark ? '#9ca3af' : '#64748b' }}>
              {assignmentTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: isDark ? '#9ca3af' : '#64748b',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice Banner */}
        <div style={{
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
          border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fee2e2',
          borderRadius: '10px',
          padding: '12px 16px'
        }}>
          <div style={{ fontSize: '0.84rem', color: isDark ? '#fca5a5' : '#991b1b', lineHeight: '1.45' }}>
            <strong style={{ color: isDark ? '#f87171' : '#dc2626' }}>Please read carefully before starting:</strong> Once you enter this activity, strict navigation lockdown is enforced.
          </div>
        </div>

        {/* Rules (No Bullets, Neutral Text Color) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ fontSize: '0.86rem', color: isDark ? '#e2e8f0' : '#334155', lineHeight: '1.45' }}>
            <strong style={{ fontWeight: '700' }}>Back Button Disabled:</strong> You cannot leave or navigate away from the workspace until you click <em>Submit</em>.
          </div>
          <div style={{ fontSize: '0.86rem', color: isDark ? '#e2e8f0' : '#334155', lineHeight: '1.45' }}>
            <strong style={{ fontWeight: '700' }}>Submissions Are Final:</strong> Once submitted, you cannot unsubmit or edit your solution.
          </div>
          <div style={{ fontSize: '0.86rem', color: isDark ? '#e2e8f0' : '#334155', lineHeight: '1.45' }}>
            <strong style={{ fontWeight: '700' }}>Must Finish Activity:</strong> Make sure you have uninterrupted time and a stable connection before proceeding.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 18px',
              borderRadius: '50px',
              border: isDark ? '1px solid #404040' : '1px solid #cbd5e1',
              backgroundColor: 'transparent',
              color: isDark ? '#e2e8f0' : '#475569',
              fontSize: '0.88rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onConfirm();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 24px',
              borderRadius: '50px',
              border: 'none',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.15s ease'
            }}
          >
            I Understand, Start <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
