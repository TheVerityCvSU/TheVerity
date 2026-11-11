import React from 'react';
import { Link2, X } from 'lucide-react';

export default function AddLinkHeader({ onClose, colors, isDark }) {
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
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: isDark ? '#133527' : '#ECFDF5',
            color: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Link2 size={20} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: '700', color: colors.title }}>
            Paste a Link
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: colors.subText, marginTop: '2px' }}>
            Attach an external URL or resource
          </p>
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: colors.subText,
          padding: '6px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Close (Esc)"
        type="button"
      >
        <X size={20} />
      </button>
    </div>
  );
}

