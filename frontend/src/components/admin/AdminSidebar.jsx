import React from 'react';

export default function AdminSidebar({
  layoutStyles,
  effectiveSidebarCollapsed,
  onMouseEnter,
  onMouseLeave,
  currentActiveTab,
  onSelectTab,
  isDark,
  navItems,
  indicatorStyle,
  navRefs
}) {
  return (
    <aside
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={layoutStyles.sidebar(effectiveSidebarCollapsed)}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, position: 'relative' }}>
        {/* Liquid sliding indicator */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: indicatorStyle.top,
          height: indicatorStyle.height,
          background: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255,255,255,0.25)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: '14px',
          boxShadow: isDark
            ? '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 4px 16px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.5)',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.35)',
          transition: indicatorStyle.transition || 'none',
          opacity: indicatorStyle.opacity,
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {navItems.map(({ id, Icon, label }) => {
          const active = currentActiveTab === id;
          return (
            <button
              key={id}
              ref={el => {
                if (navRefs?.current) {
                  navRefs.current[id] = el;
                }
              }}
              onClick={() => onSelectTab(id)}
              style={layoutStyles.sidebarBtn(effectiveSidebarCollapsed)}
              title={effectiveSidebarCollapsed ? label : ''}
            >
              <Icon size={20} color={active ? '#3b82f6' : (isDark ? '#a3a3a3' : '#475569')} style={{ flexShrink: 0 }} />
              {!effectiveSidebarCollapsed && (
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: active ? '700' : '600',
                  color: active ? '#3b82f6' : (isDark ? '#e5e5e5' : '#334155'),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

