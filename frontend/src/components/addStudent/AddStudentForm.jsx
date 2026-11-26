import { motion } from 'framer-motion';
import { Mail, User, Loader2, AlertCircle, CheckCircle2, UserPlus } from 'lucide-react';

export default function AddStudentForm({
  email,
  setEmail,
  name,
  setName,
  loading,
  error,
  setError,
  successMsg,
  emailInputRef,
  classCode,
  colors,
  isDark,
  onSubmit,
  onClose
}) {
  return (
    <form onSubmit={onSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Feedback Banners */}
      {error && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: isDark ? '#3d1616' : '#fef2f2',
            border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
            color: isDark ? '#fca5a5' : '#b91c1c',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: colors.infoBg,
            border: `1px solid ${colors.infoBorder}`,
            color: colors.infoText,
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Email Field */}
      <div>
        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '600', color: colors.title, marginBottom: '6px' }}>
          Student Email <span style={{ color: '#EF4444' }}>*</span>
        </label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            ref={emailInputRef}
            type="email"
            required
            placeholder="student@school.edu"
            value={email}
            disabled={loading}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            style={{
              width: '100%',
              padding: '11px 14px 11px 38px',
              borderRadius: '10px',
              border: `1px solid ${error ? '#EF4444' : colors.inputBorder}`,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              fontSize: '0.92rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <Mail
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              color: colors.subText,
              pointerEvents: 'none'
            }}
          />
        </div>
      </div>

      {/* Name Field (Optional) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '0.84rem', fontWeight: '600', color: colors.title }}>
            Student Name <span style={{ fontSize: '0.75rem', fontWeight: '400', color: colors.subText }}>(optional)</span>
          </label>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="e.g. Alex Johnson"
            value={name}
            disabled={loading}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px 11px 38px',
              borderRadius: '10px',
              border: `1px solid ${colors.inputBorder}`,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              fontSize: '0.92rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <User
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              color: colors.subText,
              pointerEvents: 'none'
            }}
          />
        </div>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.76rem', color: colors.subText }}>
          Leave empty to automatically derive the name from the email address.
        </p>
      </div>

      {/* Class Code Info Box */}
      {classCode && (
        <div
          style={{
            backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
            border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            color: isDark ? '#CBD5E1' : '#475569'
          }}
        >
          <span>Alternatively, students can join with code:</span>
          <strong style={{ color: '#10B981', letterSpacing: '1px', fontSize: '0.9rem' }}>
            {classCode}
          </strong>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '10px',
          marginTop: '8px'
        }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{
            padding: '9px 18px',
            borderRadius: '10px',
            border: `1px solid ${colors.border}`,
            backgroundColor: 'transparent',
            color: colors.title,
            fontSize: '0.88rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease',
            opacity: loading ? 0.6 : 1
          }}
        >
          Cancel
        </button>

        <motion.button
          type="submit"
          disabled={loading || Boolean(successMsg)}
          whileHover={loading ? {} : { scale: 1.02 }}
          whileTap={loading ? {} : { scale: 0.98 }}
          style={{
            padding: '9px 20px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: '#10B981',
            color: '#FFFFFF',
            fontSize: '0.88rem',
            fontWeight: '700',
            cursor: loading || successMsg ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
            opacity: loading || successMsg ? 0.8 : 1
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Adding...</span>
            </>
          ) : successMsg ? (
            <>
              <CheckCircle2 size={16} />
              <span>Added</span>
            </>
          ) : (
            <>
              <UserPlus size={16} />
              <span>Add Student</span>
            </>
          )}
        </motion.button>
      </div>
    </form>
  );
}

