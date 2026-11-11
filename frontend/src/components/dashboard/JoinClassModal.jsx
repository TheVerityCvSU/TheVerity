import React from 'react';
import { X } from 'lucide-react';

export default function JoinClassModal({
  isOpen,
  onClose,
  onSubmit,
  isDark,
  classCode,
  setClassCode,
  joinError,
  isJoining,
  cardBg,
  textColor,
  textMuted
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: cardBg,
          padding: '32px',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Join a Class</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} color={textMuted} />
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: textMuted }}>
              Class Code
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. CS101"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: `1.5px solid ${isDark ? '#444' : '#e5e7eb'}`,
                backgroundColor: isDark ? '#1a1a1a' : 'white',
                color: textColor,
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>
          {joinError && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>{joinError}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '50px',
                background: 'transparent',
                border: `1px solid ${isDark ? '#444' : '#e5e7eb'}`,
                color: textColor,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isJoining}
              style={{
                padding: '10px 24px',
                borderRadius: '50px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                cursor: isJoining ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isJoining ? 'Joining...' : 'Join Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

