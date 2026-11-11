import React from 'react';

export default function UserSelectToast({ visible, isDark }) {
  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      backgroundColor: isDark ? '#292218' : '#fff3cd',
      border: isDark ? '1px solid #7a5f20' : '1px solid #ffeaa7',
      borderRadius: '8px',
      padding: '12px 16px',
      color: isDark ? '#fbbf24' : '#856404',
      fontSize: '0.875rem',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 1000
    }}>
      <span>Please select at least one user to perform this action.</span>
    </div>
  );
}

