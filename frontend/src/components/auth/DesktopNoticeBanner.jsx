import React from 'react';

export default function DesktopNoticeBanner({ isDark }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(254, 242, 242, 0.92)',
        border: isDark ? '1px solid rgba(239, 68, 68, 0.28)' : '1px solid rgba(239, 68, 68, 0.24)',
        borderRadius: '12px',
        padding: '12px 14px',
        marginBottom: '18px',
        textAlign: 'left',
        backdropFilter: 'blur(8px)',
        boxShadow: isDark
          ? '0 4px 18px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.04)'
          : '0 4px 14px rgba(220, 38, 38, 0.06)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
          <strong
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              letterSpacing: '0.01em',
              color: isDark ? '#f87171' : '#dc2626',
            }}
          >
            Computer Laboratory Notice:
          </strong>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: '0.79rem',
            lineHeight: 1.45,
            color: isDark ? '#fca5a5' : '#991b1b',
          }}
        >
          Students on desktop/laboratory computers must use{' '}
          <strong style={{ fontWeight: 700, color: isDark ? '#ffffff' : '#7f1d1d' }}>The Verity.exe</strong>.
          Web access is restricted to mobile phones only.
        </p>
      </div>
    </div>
  );
}

