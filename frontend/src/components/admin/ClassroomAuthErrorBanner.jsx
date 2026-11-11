import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ClassroomAuthErrorBanner({ isDark }) {
  const handleReLogin = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('verity_token');
    localStorage.removeItem('token');
    window.location.reload();
  };

  return (
    <div style={{
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
      border: isDark ? '1px solid #ef4444' : '1px solid #fca5a5',
      color: isDark ? '#fca5a5' : '#991b1b',
      borderRadius: '16px',
      padding: '12px 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      fontSize: '0.88rem',
      marginBottom: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AlertTriangle size={18} />
        <span>Admin session expired or access unauthorized on this server. Please re-authenticate to view live classrooms.</span>
      </div>
      <button
        onClick={handleReLogin}
        style={{
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '9999px',
          padding: '6px 16px',
          fontSize: '0.8rem',
          fontWeight: '700',
          cursor: 'pointer'
        }}
      >
        Re-login as Admin
      </button>
    </div>
  );
}
