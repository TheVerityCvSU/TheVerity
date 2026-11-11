import React, { useState, useRef } from 'react';
import { Home, Calendar, Archive, Settings } from 'lucide-react';
import ProfileMenu from '../ProfileMenu';

export default function TeacherGradingHeader({
  currentUser,
  isDark,
  isMobile,
  styles,
  onBack,
  onNavigateView,
  onLogout
}) {
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [headerIndicatorStyle, setHeaderIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const headerNavRefs = useRef({});

  const navItems = [
    { id: 'classrooms', label: 'Home', Icon: Home },
    { id: 'calendar', label: 'Calendar', Icon: Calendar },
    { id: 'archived', label: 'Archived', Icon: Archive },
    { id: 'settings', label: 'Settings', Icon: Settings }
  ];

  return (
    <header
      style={styles.header}
      onMouseEnter={() => setIsHeaderHovered(true)}
      onMouseLeave={() => {
        setIsHeaderHovered(false);
        setHeaderIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }}
        onClick={() => {
          if (onBack) onBack();
          else if (onNavigateView) onNavigateView('classrooms');
        }}
      >
        <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
        <span style={{ color: isDark ? '#f5f5f5' : '#111827', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
        <span style={styles.instructorTag}>Instructor</span>
      </div>

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
        <div style={{
          position: 'absolute',
          left: headerIndicatorStyle.left,
          width: headerIndicatorStyle.width,
          top: 0,
          bottom: 0,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: '50px',
          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(16,185,129,0.15)',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.35)',
          transition: headerIndicatorStyle.transition || 'none',
          opacity: headerIndicatorStyle.opacity,
          pointerEvents: 'none',
          zIndex: 0
        }} />

        {navItems.map(item => (
          <button
            key={item.id}
            ref={el => headerNavRefs.current[item.id] = el}
            onClick={() => {
              if (onNavigateView) onNavigateView(item.id);
              else if (onBack) onBack();
            }}
            onMouseEnter={(e) => {
              setHeaderIndicatorStyle({
                left: e.currentTarget.offsetLeft,
                width: e.currentTarget.offsetWidth,
                opacity: 1,
                transition: 'all 0.28s cubic-bezier(0.25, 1, 0.5, 1)'
              });
            }}
            style={styles.headerNavBtn(item.id === 'classrooms')}
          >
            <item.Icon size={17} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: '16px', marginRight: '24px' }}>
        <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
      </div>
    </header>
  );
}

