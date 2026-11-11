import React from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import PasswordRequirements from '../PasswordRequirements';
import { styles } from '../../pages/registerStyles';

export default function RegisterFormCard({
  isDark,
  formData,
  setFormData,
  policies,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  loading,
  isGoogleLoading,
  onSubmit,
  onGoogleClick,
  onBackToLogin,
}) {
  return (
    <form onSubmit={onSubmit} style={styles.form}>
      {/* Name Fields */}
      <div style={styles.flexRow}>
        <input
          type="text"
          placeholder="First Name"
          required
          value={formData.firstName}
          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
          style={{
            ...styles.input,
            flex: 1,
            backgroundColor: isDark ? '#333338' : '#f9fafb',
            borderColor: isDark ? '#4a4a52' : '#e5e7eb',
            color: isDark ? '#f4f4f5' : '#4b5563',
          }}
        />
        <input
          type="text"
          placeholder="Last Name"
          required
          value={formData.lastName}
          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          style={{
            ...styles.input,
            flex: 1,
            backgroundColor: isDark ? '#333338' : '#f9fafb',
            borderColor: isDark ? '#4a4a52' : '#e5e7eb',
            color: isDark ? '#f4f4f5' : '#4b5563',
          }}
        />
      </div>

      <input
        type="email"
        placeholder="Email"
        required
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        style={{
          ...styles.input,
          backgroundColor: isDark ? '#333338' : '#f9fafb',
          borderColor: isDark ? '#4a4a52' : '#e5e7eb',
          color: isDark ? '#f4f4f5' : '#4b5563',
        }}
      />

      <div style={{ position: 'relative' }}>
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          required
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          style={{
            ...styles.input,
            backgroundColor: isDark ? '#333338' : '#f9fafb',
            borderColor: isDark ? '#4a4a52' : '#e5e7eb',
            color: isDark ? '#f4f4f5' : '#4b5563',
            paddingRight: '40px'
          }}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={{
            position: 'absolute',
            right: '12px',
            top: 0,
            bottom: 0,
            margin: 'auto 0',
            height: '24px',
            width: '24px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: isDark ? '#9ca3af' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#e4e4e7' : '#1f2937'; }}
          onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#9ca3af' : '#64748b'; }}
          title={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <PasswordRequirements password={formData.password} policies={policies} />

      <div style={{ position: 'relative' }}>
        <input
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Retype Password"
          required
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          style={{
            ...styles.input,
            backgroundColor: isDark ? '#333338' : '#f9fafb',
            borderColor: isDark ? '#4a4a52' : '#e5e7eb',
            color: isDark ? '#f4f4f5' : '#4b5563',
            paddingRight: '40px'
          }}
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          style={{
            position: 'absolute',
            right: '12px',
            top: 0,
            bottom: 0,
            margin: 'auto 0',
            height: '24px',
            width: '24px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: isDark ? '#9ca3af' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#e4e4e7' : '#1f2937'; }}
          onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#9ca3af' : '#64748b'; }}
          title={showConfirmPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {/* Role Checkboxes */}
      <div style={styles.checkboxContainer}>
        <label style={{ ...styles.checkboxLabel, color: isDark ? '#d4d4d8' : '#6b7280' }}>
          <input
            type="checkbox"
            checked={formData.role === 'Student'}
            onChange={() => setFormData({ ...formData, role: 'Student' })}
            style={styles.checkbox}
          /> Student
        </label>
        <label style={{ ...styles.checkboxLabel, color: isDark ? '#d4d4d8' : '#6b7280' }}>
          <input
            type="checkbox"
            checked={formData.role === 'Teacher'}
            onChange={() => setFormData({ ...formData, role: 'Teacher' })}
            style={styles.checkbox}
          /> Teacher
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        style={{
          ...styles.button,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          opacity: loading ? 0.75 : 1,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Sending Code...</span>
          </>
        ) : (
          <span>Continue & Verify Email</span>
        )}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0' }}>
        <div style={{ flex: 1, height: '1px', backgroundColor: isDark ? '#3f3f46' : '#e5e7eb' }}></div>
        <span style={{ padding: '0 10px', color: isDark ? '#71717a' : '#9ca3af', fontSize: '0.9rem' }}>OR</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: isDark ? '#3f3f46' : '#e5e7eb' }}></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={onGoogleClick}
          disabled={isGoogleLoading || loading}
          style={isGoogleLoading ? {
            ...styles.button,
            opacity: 0.7,
            cursor: 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          } : {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 20px',
            borderRadius: '8px',
            border: isDark ? '1px solid #3f3f46' : '1px solid #d1d5db',
            backgroundColor: isDark ? '#262626' : '#ffffff',
            color: isDark ? '#e4e4e7' : '#374151',
            fontSize: '0.95rem',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'background 0.2s, border-color 0.2s',
            width: '100%',
            justifyContent: 'center',
          }}
          onMouseEnter={e => { if (!isGoogleLoading && !loading) e.currentTarget.style.backgroundColor = isDark ? '#333333' : '#f9fafb'; }}
          onMouseLeave={e => { if (!isGoogleLoading && !loading) e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#ffffff'; }}
        >
          {isGoogleLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Loader2 size={18} className="animate-spin" />
              Authenticating...
            </span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Sign up with Google
            </>
          )}
        </button>
      </div>

      {/* Back to login link */}
      <p style={{ ...styles.loginText, color: isDark ? '#a1a1aa' : '#9ca3af' }}>
        Already have an account? <span onClick={onBackToLogin} style={styles.loginLink}>Login</span>
      </p>
    </form>
  );
}

