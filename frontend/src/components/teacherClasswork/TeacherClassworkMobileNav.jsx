import { Home, Calendar, Archive, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'classrooms', Icon: Home, label: 'Home' },
  { id: 'calendar', Icon: Calendar, label: 'Calendar' },
  { id: 'archived', Icon: Archive, label: 'Archived' },
  { id: 'settings', Icon: Settings, label: 'Settings' }
];

export default function TeacherClassworkMobileNav({ isDark, onOpenSettings, onNavigateView, onBack }) {
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
      position: 'sticky',
      bottom: 0,
      zIndex: 60
    }}>
      {NAV_ITEMS.map(({ id, Icon, label }) => (
        <button
          key={id}
          onClick={() => {
            if (id === 'settings') onOpenSettings();
            else if (onNavigateView) onNavigateView(id);
            else onBack();
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
          <Icon size={20} style={{ marginBottom: '4px' }} />
          <span style={{ fontSize: '0.65rem', fontWeight: '600' }}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
