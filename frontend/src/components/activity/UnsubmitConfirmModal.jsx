import { X } from 'lucide-react';

export default function UnsubmitConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isDark,
  activityTitle = 'this activity'
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-5 z-[9999]"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: isDark ? 'rgba(17, 17, 17, 0.75)' : 'rgba(235, 235, 235, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] text-left rounded-3xl p-7 shadow-2xl relative"
        style={{
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          color: isDark ? '#F9FAFB' : '#111827',
          borderRadius: '24px',
          padding: '28px',
          width: '90%',
          maxWidth: '460px',
          textAlign: 'left',
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
            : '0 20px 40px -10px rgba(0, 0, 0, 0.12)',
          border: isDark ? '1px solid #2C2C2E' : '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          position: 'relative'
        }}
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
        <h3
          style={{
            margin: 0,
            fontSize: '1.2rem',
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#111827',
            paddingRight: '28px',
            textAlign: 'left'
          }}
        >
          Unsubmit activity?
        </h3>

        {/* Warning description with dynamic entity name in font-semibold */}
        <p
          className="text-left"
          style={{
            margin: 0,
            fontSize: '0.9rem',
            lineHeight: 1.55,
            color: isDark ? '#D1D5DB' : '#374151',
            textAlign: 'left'
          }}
        >
          Are you sure you want to unsubmit{' '}
          <span
            className="font-semibold"
            style={{
              fontWeight: 600,
              color: isDark ? '#60A5FA' : '#2563EB'
            }}
          >
            {activityTitle}
          </span>
          ? You will be able to edit and re-submit your code. Your current progress will be preserved as a draft.
        </p>

        {/* Right-aligned footer buttons: justify-end gap-3 */}
        <div
          className="flex justify-end gap-3"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '4px'
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
              fontWeight: '600',
              fontSize: '0.88rem',
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
            onClick={onConfirm}
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontWeight: '600',
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1D4ED8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2563EB';
            }}
          >
            Unsubmit activity
          </button>
        </div>
      </div>
    </div>
  );
}
