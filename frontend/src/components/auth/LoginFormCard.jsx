import { Loader2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DesktopNoticeBanner from './DesktopNoticeBanner';
import GoogleSignInButton from './GoogleSignInButton';

export default function LoginFormCard({
  error,
  isDesktopWeb,
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  rememberAccount,
  setRememberAccount,
  handleLogin,
  isLoading,
  startExternalGoogleAuth,
  isGoogleLoading,
  onGoToRegister,
  isDark,
  styles,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{
        ...styles.card,
        backgroundColor: isDark ? '#262626' : 'white',
        border: isDark ? '1px solid #3f3f46' : 'none',
        boxShadow: isDark ? '0 12px 36px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.15)',
      }}
    >
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25 }}
            style={styles.error}
          >
            <div>{error}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {isDesktopWeb && <DesktopNoticeBanner isDark={isDark} />}

      <form onSubmit={handleLogin} style={styles.form}>
        <motion.input
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05, duration: 0.3, ease: 'easeOut' }}
          type="text"
          placeholder="Username or Email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            ...styles.input,
            backgroundColor: isDark ? '#333338' : '#f9fafb',
            borderColor: isDark ? '#4a4a52' : '#e5e7eb',
            color: isDark ? '#f4f4f5' : '#4b5563',
          }}
        />

        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
          style={{ position: 'relative' }}
        >
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              ...styles.input,
              backgroundColor: isDark ? '#333338' : '#f9fafb',
              borderColor: isDark ? '#4a4a52' : '#e5e7eb',
              color: isDark ? '#f4f4f5' : '#4b5563',
              paddingRight: '40px',
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
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = isDark ? '#e4e4e7' : '#1f2937')}
            onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#9ca3af' : '#64748b')}
            title={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </motion.div>

        {/* Remember Account Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '4px 0 6px',
            fontSize: '0.88rem',
            userSelect: 'none',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: isDark ? '#a1a1aa' : '#4b5563',
              fontSize: '0.88rem',
            }}
          >
            <input
              type="checkbox"
              checked={rememberAccount}
              onChange={(e) => setRememberAccount(e.target.checked)}
              style={{
                accentColor: '#10b981',
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
            />
            <span>Remember account</span>
          </label>
        </div>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3, ease: 'easeOut' }}
          whileHover={{
            scale: isLoading ? 1 : 1.02,
            boxShadow: isLoading ? undefined : '0 6px 20px rgba(16, 185, 129, 0.4)',
          }}
          whileTap={{ scale: isLoading ? 1 : 0.97 }}
          type="submit"
          style={{
            ...styles.button,
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Loader2 size={20} className="animate-spin" />
              Authenticating...
            </span>
          ) : (
            'Login'
          )}
        </motion.button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: isDark ? '#3f3f46' : '#e5e7eb' }}></div>
          <span style={{ padding: '0 10px', color: isDark ? '#71717a' : '#9ca3af', fontSize: '0.9rem' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: isDark ? '#3f3f46' : '#e5e7eb' }}></div>
        </div>

        <GoogleSignInButton
          onClick={() => startExternalGoogleAuth()}
          isLoading={isLoading}
          isGoogleLoading={isGoogleLoading}
          isDark={isDark}
          styles={styles}
        />

        <p style={{ ...styles.registerText, color: isDark ? '#a1a1aa' : '#9ca3af' }}>
          Don't have an account?{' '}
          <span onClick={onGoToRegister} style={styles.registerLink}>
            Register
          </span>
        </p>
      </form>
    </motion.div>
  );
}

