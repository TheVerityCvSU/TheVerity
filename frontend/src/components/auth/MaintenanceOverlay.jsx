import React from 'react';
import { Moon, Sun, Construction, AlertTriangle } from 'lucide-react';

export default function MaintenanceOverlay({ isDark, toggle, message, styles }) {
  return (
    <div
      className="auth-container"
      style={{
        ...styles.container,
        background: isDark
          ? 'linear-gradient(180deg, #323232 0%, #262626 45%, #1a1a1a 100%)'
          : 'linear-gradient(to bottom, #f3f4f6 0%, #9ca3af 100%)',
      }}
    >
      {/* Top Left Logo */}
      <div style={styles.logoContainer}>
        <span style={styles.logoV}>V</span>
        <span style={{ ...styles.logoText, color: isDark ? '#f4f4f5' : 'white' }}>erity</span>
      </div>

      {/* Top Right Dark Mode Switch */}
      <button
        onClick={toggle}
        type="button"
        style={{
          position: 'absolute',
          top: '30px',
          right: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          backgroundColor: isDark ? '#262626' : 'white',
          border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0',
          color: isDark ? '#f4f4f5' : '#374151',
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        title="Toggle dark/light mode"
      >
        {isDark ? <Sun size={19} color="#f59e0b" /> : <Moon size={19} color="#6366f1" />}
      </button>

      {/* Maintenance Card */}
      <div
        style={{
          ...styles.card,
          backgroundColor: isDark ? '#262626' : 'white',
          border: isDark ? '1px solid #3f3f46' : 'none',
          boxShadow: isDark ? '0 12px 36px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.15)',
          textAlign: 'center',
          padding: '48px 40px',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: isDark ? '#3f2a0a' : '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <Construction size={36} color="#f59e0b" />
        </div>

        <h2
          style={{
            margin: '0 0 8px',
            fontSize: '1.35rem',
            fontWeight: '800',
            color: isDark ? '#f4f4f5' : '#1e293b',
          }}
        >
          System Maintenance
        </h2>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#f59e0b',
              display: 'inline-block',
              animation: 'pulse-dot 1.5s ease-in-out infinite',
            }}
          />
          <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#f59e0b' }}>
            Maintenance in Progress
          </span>
        </div>

        <p
          style={{
            margin: '0 0 24px',
            fontSize: '0.92rem',
            lineHeight: '1.6',
            color: isDark ? '#a1a1aa' : '#64748b',
          }}
        >
          {message}
        </p>

        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: isDark ? '#1c1c1c' : '#f8fafc',
            border: `1px solid ${isDark ? '#3f3f46' : '#e2e8f0'}`,
            fontSize: '0.8rem',
            color: isDark ? '#71717a' : '#94a3b8',
          }}
        >
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Student and instructor logins are temporarily disabled. Administrators can still access the system via the admin portal.
        </div>

        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.8); }
          }
        `}</style>
      </div>
    </div>
  );
}

