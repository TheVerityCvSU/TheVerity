import { useState, useEffect } from 'react';
import { Shield, Moon, Sun, KeyRound, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { loginAdmin } from '../../data/adminAuth';
import { useDarkMode } from '../../hooks/useDarkMode';
import { styles } from './adminLoginStyles';

export default function AdminLogin({ onLogin }) {
  const { isDark, toggle } = useDarkMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => {
    try {
      const notice = sessionStorage.getItem('verity_auth_notice');
      if (notice) {
        sessionStorage.removeItem('verity_auth_notice');
        return notice;
      }
    } catch (_) {}
    return '';
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const onAuthNotice = () => {
      try {
        const notice = sessionStorage.getItem('verity_auth_notice');
        if (notice) {
          sessionStorage.removeItem('verity_auth_notice');
          setError(notice);
        }
      } catch (_) {}
    };
    window.addEventListener('verity:auth-invalid', onAuthNotice);
    return () => window.removeEventListener('verity:auth-invalid', onAuthNotice);
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginAdmin({ email, password });
      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-container"
      style={{
        ...styles.container,
        background: isDark
          ? 'linear-gradient(180deg, #1e1e24 0%, #111115 100%)'
          : 'linear-gradient(180deg, #334155 0%, #0f172a 100%)',
      }}
    >
      {/* Top Left Admin Badge Logo */}
      <div style={styles.logoContainer}>
        <div style={styles.shieldBadge}>
          <Shield size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: '1.8rem', fontWeight: '900', fontStyle: 'italic' }}>
            <span style={{ color: '#3b82f6', textShadow: '0 0 14px rgba(59, 130, 246, 0.6)' }}>V</span>
            <span style={{ color: 'white' }}>erity</span>
          </div>
          <div style={styles.adminPortalTag}>SECURE ADMIN PORTAL</div>
        </div>
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
          backgroundColor: isDark ? '#262626' : 'rgba(255,255,255,0.15)',
          border: isDark ? '1px solid #3f3f46' : '1px solid rgba(255,255,255,0.3)',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          backdropFilter: 'blur(8px)',
        }}
        className="btn-anim"
        title="Toggle dark/light mode"
      >
        {isDark ? <Sun size={19} color="#f59e0b" /> : <Moon size={19} color="#818cf8" />}
      </button>

      {/* Admin Login Card */}
      <div
        style={{
          ...styles.card,
          backgroundColor: isDark ? '#262626' : 'white',
          border: isDark ? '1px solid #3f3f46' : '1px solid rgba(255,255,255,0.2)',
          boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.7)' : '0 20px 50px rgba(0,0,0,0.35)',
        }}
      >
        <div style={styles.cardHeader}>
          <div style={styles.headerIconBox}>
            <KeyRound size={24} color="#007bff" />
          </div>
          <h1 style={{ ...styles.title, color: isDark ? '#f4f4f5' : '#0f172a' }}>System Administration</h1>
          <p style={{ ...styles.subtitle, color: isDark ? '#a1a1aa' : '#64748b' }}>
            Isolated administrative access for Verity system controllers.
          </p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAdminLogin} style={styles.form}>
          <div>
            <label style={{ ...styles.label, color: isDark ? '#d4d4d8' : '#475569' }}>Admin Identifier / Email</label>
            <input
              type="email"
              placeholder="admin@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                ...styles.input,
                backgroundColor: isDark ? '#333338' : '#f8fafc',
                borderColor: isDark ? '#4a4a52' : '#cbd5e1',
                color: isDark ? '#f4f4f5' : '#0f172a',
              }}
            />
          </div>

          <div>
            <label style={{ ...styles.label, color: isDark ? '#d4d4d8' : '#475569' }}>Access Credential</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  ...styles.input,
                  backgroundColor: isDark ? '#333338' : '#f8fafc',
                  borderColor: isDark ? '#4a4a52' : '#cbd5e1',
                  color: isDark ? '#f4f4f5' : '#0f172a',
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
                onMouseEnter={e => e.currentTarget.style.color = isDark ? '#e4e4e7' : '#0f172a'}
                onMouseLeave={e => e.currentTarget.style.color = isDark ? '#9ca3af' : '#64748b'}
                title={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Authenticating Admin...' : 'Authenticate & Access Control Center'}
          </button>
        </form>
      </div>
    </div>
  );
}
