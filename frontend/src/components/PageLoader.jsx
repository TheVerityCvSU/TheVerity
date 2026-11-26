import { useDarkMode } from '../hooks/useDarkMode';

export default function PageLoader({ isDark: isDarkProp, label = 'Loading view...' }) {
  const { isDark: isDarkTheme } = useDarkMode();
  const dark = typeof isDarkProp === 'boolean' ? isDarkProp : isDarkTheme;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: dark ? '#141615' : '#f4f5f7',
        color: dark ? '#9ca3af' : '#6b7280',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: '0.88rem',
        fontWeight: 500
      }}
    >
      <style>{`
        @keyframes verityFadeInDelay {
          0%, 40% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes veritySpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          opacity: 0,
          animation: 'verityFadeInDelay 0.35s ease forwards'
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: `2.5px solid ${dark ? 'rgba(52, 211, 153, 0.18)' : 'rgba(16, 185, 129, 0.2)'}`,
            borderTopColor: '#10b981',
            animation: 'veritySpin 0.7s linear infinite'
          }}
        />
        <span>{label}</span>
      </div>
    </div>
  );
}
