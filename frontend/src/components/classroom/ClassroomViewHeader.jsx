import React, { useState, useLayoutEffect, useRef } from 'react';
import { Home, Calendar, Archive, Code2, Settings, Plus } from 'lucide-react';
import ProfileMenu from '../ProfileMenu';

export default function ClassroomViewHeader({
  isDark,
  isMobile,
  textColor,
  textMuted,
  bgColor,
  currentUser,
  onNavigateView,
  onBack,
  onOpenSettings,
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
    { id: 'compiler', label: 'Compiler', Icon: Code2 }
  ];

  return (
    <header
      onMouseEnter={() => setIsHeaderHovered(true)}
      onMouseLeave={() => setIsHeaderHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px clamp(20px, 3vw, 48px)',
        backgroundColor: bgColor,
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
        background: `linear-gradient(to bottom, ${bgColor}, transparent)`,
        pointerEvents: 'none'
      }} />

      <div
        style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }}
        onClick={() => { if (onNavigateView) onNavigateView('classrooms'); else onBack(); }}
      >
        <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
        <span style={{ color: textColor, fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
        <span style={{ fontSize: '0.7rem', color: textMuted, marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</span>
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

        {navItems.map(item => {
          const active = item.id === 'classrooms';
          return (
            <button
              key={item.id}
              ref={el => headerNavRefs.current[item.id] = el}
              onClick={() => { if (onNavigateView) onNavigateView(item.id === 'stream' ? 'classrooms' : item.id); }}
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
                color: active ? '#10b981' : textMuted,
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
          onClick={onOpenSettings}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: '50px', backgroundColor: 'transparent', color: textMuted, border: 'none', cursor: 'pointer', marginLeft: '8px' }}
        >
          <Settings size={20} />
          <span style={{ marginLeft: '8px', fontWeight: '600', fontSize: '0.9rem' }}>Settings</span>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: '16px', marginRight: '24px' }}>
        <button
          onClick={() => {
            try {
              sessionStorage.setItem('verity_open_join_modal', 'true');
            } catch (_) {}
            if (onNavigateView) onNavigateView('classrooms');
            else if (onBack) onBack();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 20px',
            borderRadius: '50px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
            opacity: 1,
            pointerEvents: 'auto'
          }}
        >
          <Plus size={18} /> Add course
        </button>
        <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
      </div>
    </header>
  );
}
