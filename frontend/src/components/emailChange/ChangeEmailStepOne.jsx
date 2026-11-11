import React from 'react';
import { Loader2 } from 'lucide-react';

export default function ChangeEmailStepOne({
  currentEmail,
  newEmail,
  setNewEmail,
  onSubmit,
  onClose,
  loading,
  error,
  setError,
  emailInputRef,
  colors,
  isDark
}) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {currentEmail && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: isDark ? '#1e1e1e' : '#f8fafc',
            border: `1px solid ${colors.border}`,
            fontSize: '0.82rem',
            color: colors.subText,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>Current email:</span>
          <strong style={{ color: colors.title }}>{currentEmail}</strong>
        </div>
      )}

      <div>
        <label
          style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: '600',
            color: colors.title,
            marginBottom: '8px'
          }}
        >
          New Email Address
        </label>
        <input
          ref={emailInputRef}
          type="email"
          placeholder="Enter your new email address"
          value={newEmail}
          onChange={(e) => {
            setNewEmail(e.target.value);
            if (error) setError('');
          }}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: '10px',
            border: `1px solid ${colors.inputBorder}`,
            backgroundColor: colors.inputBg,
            color: colors.inputText,
            fontSize: '0.92rem',
            boxSizing: 'border-box',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
        />
        <p
          style={{
            margin: '6px 0 0',
            fontSize: '0.78rem',
            color: colors.subText
          }}
        >
          A 6-digit confirmation code will be sent to this email to verify ownership.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: `1px solid ${colors.border}`,
            backgroundColor: 'transparent',
            color: colors.title,
            fontWeight: '600',
            fontSize: '0.88rem',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !newEmail.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: loading || !newEmail.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !newEmail.trim() ? 0.65 : 1,
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Sending Code...</span>
            </>
          ) : (
            <>
              <span>Send Code</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

