import React from 'react';
import { KeyRound, X } from 'lucide-react';

export default function ChangePasswordHeader({ onClose, loading, colors, isDark }) {
  return (
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
          <KeyRound size={20} />
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
            Change Password
          </h3>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: '0.8rem',
              color: colors.subText
            }}
          >
            Enter current password to verify identity
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
  );
}

