import React, { useState, useLayoutEffect, useRef } from 'react';
import { Home, Calendar, Archive, Code2, Settings } from 'lucide-react';
import ProfileMenu from '../ProfileMenu';

export default function ActivityDetailHeader({
  currentUser,
  isDark,
  isMobile,
  onBack,
  onNavigateView,
  onLogout
}) {
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [headerIndicatorStyle, setHeaderIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const headerNavRefs = useRef({});

  useLayoutEffect(() => {
    const activeRef = headerNavRefs.current['classrooms'];
    if (activeRef) {
      setHeaderIndicatorStyle(prev => ({
        left: activeRef.offsetLeft,
        width: activeRef.offsetWidth,
        opacity: 1,
        transition: prev.opacity === 0 ? 'none' : 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
      }));
    }
  }, [isHeaderHovered]);

  const navItems = [
    { id: 'classrooms', label: 'Home', Icon: Home },
    { id: 'calendar', label: 'Calendar', Icon: Calendar },
    { id: 'archived', label: 'Archived', Icon: Archive },
    { id: 'compiler', label: 'Compiler', Icon: Code2 },
    { id: 'settings', label: 'Settings', Icon: Settings }
  ];

  return (
    <header 
      onMouseEnter={() => setIsHeaderHovered(true)}
      onMouseLeave={() => setIsHeaderHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
        borderBottom: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{
        position: 'absolute',
        bottom: '-30px',
        left: 0,
        right: 0,
        height: '30px',
        background: `linear-gradient(to bottom, ${isDark ? '#1a1a1a' : '#f8f9fa'}, transparent)`,
        pointerEvents: 'none'
      }} />

      <div 
        style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }} 
        onClick={() => {
          if (onBack) onBack();
          else if (onNavigateView) onNavigateView('classrooms');
        }}
      >
        <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
        <span style={{ color: isDark ? '#f5f5f5' : '#111827', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
        <span style={{ fontSize: '0.7rem', color: isDark ? '#a3a3a3' : '#6b7280', marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</span>
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
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: '50px',
          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 4px 16px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.35)',
          transition: headerIndicatorStyle.transition || 'none',
          opacity: headerIndicatorStyle.opacity,
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {navItems.map(item => (
          <button
            key={item.id}
            ref={el => headerNavRefs.current[item.id] = el}
            onClick={() => {
              if (onNavigateView) onNavigateView(item.id);
              else if (onBack) onBack();
            }}
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
              color: item.id === 'classrooms' ? '#10b981' : (isDark ? '#a3a3a3' : '#6b7280'),
              fontWeight: item.id === 'classrooms' ? '700' : '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <item.Icon size={18} />
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: '16px' }}>
        <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
      </div>
    </header>
  );
}

