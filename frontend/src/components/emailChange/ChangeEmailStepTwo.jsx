import React from 'react';
import { CheckCircle2, ArrowLeft, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';

export default function ChangeEmailStepTwo({
  newEmail,
  otpDigits,
  digitInputRefs,
  handleDigitChange,
  handleDigitKeyDown,
  handlePaste,
  handlePasteDirect,
  devOtp,
  countdown,
  loading,
  onBack,
  onResend,
  onClose,
  onSubmit,
  colors,
  isDark
}) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div
        style={{
          padding: '12px 14px',
          borderRadius: '10px',
          backgroundColor: isDark ? '#1a2e22' : '#ecfdf5',
          border: isDark ? '1px solid #065f46' : '1px solid #a7f3d0',
          color: isDark ? '#6ee7b7' : '#047857',
          fontSize: '0.84rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
          <CheckCircle2 size={16} />
          <span>Verification code sent!</span>
        </div>
        <div style={{ marginTop: '4px', fontSize: '0.8rem', opacity: 0.9 }}>
          Enter the 6-digit code sent to <strong style={{ color: isDark ? '#ffffff' : '#064e3b' }}>{newEmail}</strong>.
        </div>
      </div>

      {/* Dev Code Pill if SMTP is simulated */}
      {devOtp && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: isDark ? 'rgba(52, 211, 153, 0.12)' : '#f0fdf4',
            border: '1px dashed #34d399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem'
          }}
        >
          <span style={{ color: isDark ? '#a7f3d0' : '#15803d', fontWeight: '500' }}>
            Dev mode simulated code:
          </span>
          <button
            type="button"
            onClick={() => handlePasteDirect(devOtp, 0)}
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
            title="Click to fill dev code"
          >
            {devOtp} (Click to fill)
          </button>
        </div>
      )}

      {/* 6 OTP boxes */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          margin: '6px 0'
        }}
        onPaste={handlePaste}
      >
        {otpDigits.map((digit, idx) => (
          <input
            key={idx}
            ref={el => (digitInputRefs.current[idx] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleDigitChange(idx, e.target.value)}
            onKeyDown={e => handleDigitKeyDown(idx, e)}
            onFocus={e => e.target.select()}
            style={{
              width: '46px',
              height: '52px',
              borderRadius: '12px',
              border: digit
                ? '2px solid #10b981'
                : `1.5px solid ${colors.boxBorder}`,
              backgroundColor: colors.boxBg,
              color: colors.title,
              fontSize: '1.45rem',
              fontWeight: '700',
              textAlign: 'center',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.15s ease',
              boxShadow: digit ? '0 0 0 3px rgba(16, 185, 129, 0.18)' : 'none'
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: colors.subText,
            cursor: 'pointer',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0
          }}
        >
          <ArrowLeft size={14} /> Back to email
        </button>

        <button
          type="button"
          onClick={onResend}
          disabled={countdown > 0 || loading}
          style={{
            background: 'none',
            border: 'none',
            color: countdown > 0 ? colors.subText : '#10b981',
            cursor: countdown > 0 || loading ? 'not-allowed' : 'pointer',
            fontSize: '0.82rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0
          }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : undefined} />
          {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '6px' }}>
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
          disabled={loading || otpDigits.join('').length < 6}
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
            cursor: loading || otpDigits.join('').length < 6 ? 'not-allowed' : 'pointer',
            opacity: loading || otpDigits.join('').length < 6 ? 0.65 : 1,
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              <span>Verify & Change Email</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

