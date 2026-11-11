import React from 'react';
import { Server, X } from 'lucide-react';

export default function ServerConfigHeader({ onClose, isDark }) {
  return (
    <div style={{
      padding: '22px 24px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.1)',
          color: isDark ? '#818cf8' : '#4f46e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Server size={22} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
            Server Connection
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#64748b' }}>
            Configure Cloud or Offline School LAN Host
          </p>
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: isDark ? '#94a3b8' : '#64748b',
          cursor: 'pointer',
          padding: '6px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}

