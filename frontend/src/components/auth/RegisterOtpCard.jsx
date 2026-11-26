import { ArrowLeft, ShieldCheck, KeyRound, Loader2 } from 'lucide-react';
import { styles } from '../../pages/registerStyles';

export default function RegisterOtpCard({
  isDark,
  email,
  otpDigits,
  inputRefs,
  onOtpChange,
  onOtpKeyDown,
  onOtpPaste,
  loading,
  resending,
  resendCooldown,
  onResendOtp,
  onVerifyOtp,
  onBackToForm,
  onBackToLogin,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Back to Edit Details */}
      <button
        type="button"
        onClick={onBackToForm}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: isDark ? '#a1a1aa' : '#64748b',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: '600',
          padding: 0,
          alignSelf: 'flex-start'
        }}
      >
        <ArrowLeft size={16} /> Edit details
      </button>

      {/* Icon & Heading */}
      <div style={{ textAlign: 'center', margin: '6px 0 10px 0' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: isDark ? '#133527' : '#ECFDF5',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto'
          }}
        >
          <ShieldCheck size={32} />
        </div>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', fontWeight: '700', color: isDark ? '#f4f4f5' : '#1e293b' }}>
          Verify your email
        </h2>
        <p style={{ margin: 0, fontSize: '0.88rem', color: isDark ? '#a1a1aa' : '#64748b', lineHeight: 1.4 }}>
          Enter the 6-digit code sent to<br />
          <strong style={{ color: isDark ? '#e4e4e7' : '#1e293b' }}>{email}</strong>
        </p>
      </div>

      <form onSubmit={onVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 6 Individual Digit Boxes */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            margin: '8px 0 4px 0'
          }}
          onPaste={onOtpPaste}
        >
          {otpDigits.map((digit, idx) => (
            <input
              key={idx}
              ref={el => { inputRefs.current[idx] = el; }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              onChange={e => onOtpChange(idx, e.target.value)}
              onKeyDown={e => onOtpKeyDown(idx, e)}
              onFocus={e => e.target.select()}
              style={{
                width: '50px',
                height: '58px',
                borderRadius: '14px',
                border: digit
                  ? '2px solid #10b981'
                  : isDark
                  ? '1.5px solid #4a4a52'
                  : '1.5px solid #cbd5e1',
                backgroundColor: isDark ? '#1f1f23' : '#f8fafc',
                color: isDark ? '#f4f4f5' : '#111827',
                fontSize: '1.6rem',
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

        <p style={{ margin: '0 0 4px 0', textAlign: 'center', fontSize: '0.78rem', color: isDark ? '#71717a' : '#94a3b8' }}>
          This code is valid for 15 minutes.
        </p>

        {/* Verify Button */}
        <button
          type="submit"
          disabled={loading || otpDigits.join('').length < 6}
          style={{
            ...styles.button,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: loading || otpDigits.join('').length < 6 ? 0.65 : 1,
            cursor: loading || otpDigits.join('').length < 6 ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <KeyRound size={18} />
              <span>Verify & Create Account</span>
            </>
          )}
        </button>
      </form>

      {/* Resend Code Section */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
        <span style={{ color: isDark ? '#a1a1aa' : '#64748b' }}>Didn't receive the code?</span>
        <button
          type="button"
          onClick={onResendOtp}
          disabled={resendCooldown > 0 || resending}
          style={{
            background: 'none',
            border: 'none',
            color: resendCooldown > 0 ? (isDark ? '#71717a' : '#9ca3af') : '#10b981',
            fontWeight: '700',
            cursor: resendCooldown > 0 ? 'default' : 'pointer',
            padding: 0,
            fontSize: '0.85rem'
          }}
        >
          {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
        </button>
      </div>

      {/* Back to Login */}
      <p style={{ ...styles.loginText, marginTop: '8px', color: isDark ? '#a1a1aa' : '#9ca3af' }}>
        Already have an account? <span onClick={onBackToLogin} style={styles.loginLink}>Login</span>
      </p>
    </div>
  );
}

