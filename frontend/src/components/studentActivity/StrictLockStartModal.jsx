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
        className="w-full max-w-[500px] text-left rounded-3xl p-7 shadow-2xl relative"
        style={{
          ...styles.confirmModalCard,
          maxWidth: '500px',
          padding: '28px 30px',
          gap: '18px',
          textAlign: 'left',
          position: 'relative'
        }} 
        onClick={e => e.stopPropagation()}
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

        {/* Header */}
        <div style={{ paddingRight: '28px', textAlign: 'left' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: isDark ? '#F87171' : '#DC2626', textAlign: 'left' }}>
            Start strict lockdown activity?
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: isDark ? '#D1D5DB' : '#374151', textAlign: 'left' }}>
            You are about to start{' '}
            <span
              className="font-semibold"
              style={{ fontWeight: 600, color: isDark ? '#F87171' : '#DC2626' }}
            >
              {assignmentTitle}
            </span>
            .
          </p>
        </div>

        {/* Notice Banner */}
        <div style={{
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
          border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #FEE2E2',
          borderRadius: '10px',
          padding: '12px 16px',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '0.84rem', color: isDark ? '#FCA5A5' : '#991B1B', lineHeight: '1.45' }}>
            <strong style={{ color: isDark ? '#F87171' : '#DC2626' }}>Please read carefully before starting:</strong> Once you enter this activity, strict navigation lockdown is enforced.
          </div>
        </div>

        {/* Rules */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '0.86rem', color: isDark ? '#E2E8F0' : '#334155', lineHeight: '1.45' }}>
            <strong style={{ fontWeight: '700' }}>Back Button Disabled:</strong> You cannot leave or navigate away from the workspace until you click <em>Submit</em>.
          </div>
          <div style={{ fontSize: '0.86rem', color: isDark ? '#E2E8F0' : '#334155', lineHeight: '1.45' }}>
            <strong style={{ fontWeight: '700' }}>Submissions Are Final:</strong> Once submitted, you cannot unsubmit or edit your solution.
          </div>
          <div style={{ fontSize: '0.86rem', color: isDark ? '#E2E8F0' : '#334155', lineHeight: '1.45' }}>
            <strong style={{ fontWeight: '700' }}>Must Finish Activity:</strong> Make sure you have uninterrupted time and a stable connection before proceeding.
          </div>
        </div>

        {/* Actions - Right-aligned footer buttons: justify-end gap-3 */}
        <div
          className="flex justify-end gap-3"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '6px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: isDark ? '1px solid #3A3A3C' : '1px solid #D1D5DB',
              backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
              color: isDark ? '#D1D5DB' : '#374151',
              fontSize: '0.88rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? '#3A3A3C' : '#F3F4F6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? '#2C2C2E' : '#FFFFFF';
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
              padding: '9px 22px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#059669',
              color: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#047857';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#059669';
            }}
          >
            Start activity <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
