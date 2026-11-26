import { Home, Calendar, TerminalSquare, Archive, Settings } from 'lucide-react';

export default function ActivityMobileNav({ isDark, onBack, onNavigateView }) {
  const items = [
    { id: 'classrooms', Icon: Home, label: 'Home' },
    { id: 'calendar', Icon: Calendar, label: 'Calendar' },
    { id: 'workspace', Icon: TerminalSquare, label: 'Compiler' },
    { id: 'archived', Icon: Archive, label: 'Archived' },
    { id: 'settings', Icon: Settings, label: 'Settings' }
  ];

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: isDark ? '#262626' : '#ffffff',
      borderTop: isDark ? '1px solid #3f3f46' : '1px solid #e5e7eb',
      height: '65px',
      flexShrink: 0,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      zIndex: 60
    }}>
      {items.map(({ id, Icon, label }) => (
        <button
          key={id}
          onClick={() => {
            if (onNavigateView) onNavigateView(id);
            else if (onBack) onBack();
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            color: isDark ? '#a3a3a3' : '#64748b',
            cursor: 'pointer',
            padding: '8px',
            minWidth: '64px'
          }}
        >
          <Icon size={22} style={{ marginBottom: '4px' }} />
          <span style={{ fontSize: '0.65rem', fontWeight: '500' }}>{label}</span>
        </button>
      ))}
    </nav>
  );
}

