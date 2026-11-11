import React from 'react';
import { X } from 'lucide-react';

export default function ClassworkUnsubmitModal({
  item,
  isDark,
  onClose,
  onConfirm
}) {
  if (!item) return null;

  return (
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
      onClick={onClose}
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
            onClick={onClose}
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

        <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.5, color: isDark ? '#9ca3af' : '#64748b' }}>
          Unsubmitting will let you edit your code and re-submit. Your current progress will be preserved as a draft.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={onClose}
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
            onClick={onConfirm}
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
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
            }}
          >
            Confirm Unsubmit
          </button>
        </div>
      </div>
    </div>
  );
}
