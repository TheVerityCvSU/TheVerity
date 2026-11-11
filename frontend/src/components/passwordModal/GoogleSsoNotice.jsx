import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function GoogleSsoNotice({ isDark }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
        border: isDark ? '1px solid #0284c7' : '1px solid #bae6fd',
        color: isDark ? '#38bdf8' : '#0369a1',
        fontSize: '0.84rem',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}
    >
      <ShieldCheck size={20} style={{ flexShrink: 0 }} />
      <span>
        Your account was created via <strong>Google Sign-In</strong>. Set your password below to enable standard email & password sign-in.
      </span>
    </div>
  );
}

