import { useRef, useLayoutEffect, useState } from 'react';
import { Home, Calendar, Archive, Settings } from 'lucide-react';
import ProfileMenu from '../../components/ProfileMenu';

export default function TeacherDashboardHeader({
  isDark,
  isMobile,
  activeView,
  onSetView,
  currentUser,
  onLogout
}) {
  const navRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0, transition: 'none' });

  const navItems = [
    { id: 'classrooms', Icon: Home, label: 'Home' },
    { id: 'calendar', Icon: Calendar, label: 'Calendar' },
    { id: 'archived', Icon: Archive, label: 'Archived' },
  ];

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const activeRef = navRefs.current[activeView];
      if (activeRef) {
        setIndicatorStyle(prev => ({
          left: activeRef.offsetLeft,
          width: activeRef.offsetWidth,
          opacity: 1,
          transition: prev.opacity === 0 ? 'none' : 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
        }));
      }
    };
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeView, isMobile]);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: '72px',
        padding: '16px clamp(20px, 3vw, 48px)',
        backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        borderBottom: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: '-30px',
          left: 0,
          right: 0,
          height: '30px',
          background: `linear-gradient(to bottom, ${isDark ? '#1a1a1a' : '#f8f9fa'}, transparent)`,
          pointerEvents: 'none'
        }}
      />

      {/* Left: Logo */}
      <div
        style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }}
        onClick={() => onSetView('classrooms')}
      >
        <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
        <span style={{ color: isDark ? '#f5f5f5' : '#111827', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
        <span style={{ fontSize: '0.7rem', color: isDark ? '#a3a3a3' : '#6b7280', marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructor</span>
      </div>

      {/* Center: Navigation */}
      <div
        className="header-center-nav"
        style={{
          display: isMobile ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          opacity: 1,
          pointerEvents: 'auto',
          position: 'relative'
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            top: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '50px',
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 4px 16px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.35)',
            transition: indicatorStyle.transition || 'none',
            opacity: indicatorStyle.opacity,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {navItems.map(item => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              ref={el => { navRefs.current[item.id] = el; }}
              onClick={() => onSetView(item.id)}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '50px',
                background: 'transparent',
                border: '1px solid transparent',
                color: active ? '#10b981' : (isDark ? '#a3a3a3' : '#6b7280'),
                fontWeight: active ? '700' : '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <item.Icon size={18} />
              {item.label}
            </button>
          );
        })}

        <button
          ref={el => { navRefs.current['settings'] = el; }}
          onClick={() => onSetView('settings')}
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px',
            borderRadius: '50px',
            backgroundColor: 'transparent',
            color: isDark ? '#a3a3a3' : '#6b7280',
            border: 'none',
            cursor: 'pointer',
            marginLeft: '8px'
          }}
        >
          <Settings size={20} />
          <span style={{ marginLeft: '8px', fontWeight: '600', fontSize: '0.9rem' }}>Settings</span>
        </button>
      </div>

      {/* Right: Profile */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: '16px', marginRight: '24px' }}>
        <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
      </div>
    </header>
  );
}

