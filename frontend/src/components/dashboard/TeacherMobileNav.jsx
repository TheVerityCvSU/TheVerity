import React from 'react';
import { Home, Calendar, Archive, Settings } from 'lucide-react';

export default function TeacherMobileNav({ isDark, activeView, onSetView }) {
  const items = [
    { id: 'classrooms', Icon: Home, label: 'Home' },
    { id: 'calendar', Icon: Calendar, label: 'Calendar' },
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
      {items.map(({ id, Icon, label }) => {
        const active = activeView === id || (id === 'settings' && activeView === 'classroomSettings');
        return (
          <button
            key={id}
            onClick={() => onSetView(id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              color: active ? '#10b981' : (isDark ? '#a3a3a3' : '#64748b'),
              cursor: 'pointer',
              padding: '8px',
              minWidth: '64px'
            }}
          >
            <Icon size={20} style={{ marginBottom: '4px' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: active ? '700' : '600' }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

