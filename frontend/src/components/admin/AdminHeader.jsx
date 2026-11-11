import React from 'react';
import { Menu, Bell } from 'lucide-react';
import ProfileMenu from '../ProfileMenu';

export default function AdminHeader({
  isDark,
  currentSidebarCollapsed,
  onToggleSidebar,
  onSelectDashboard,
  currentShowNotifications,
  onToggleNotifications,
  currentNotifications,
  onMarkAllNotificationsRead,
  currentUser,
  onLogout,
  layoutStyles
}) {
  return (
    <header style={layoutStyles.header}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: 'none',
            border: 'none',
            padding: '6px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDark ? '#d4d4d4' : '#64748b',
            flexShrink: 0,
            marginRight: '16px'
          }}
          title={!currentSidebarCollapsed ? 'Unpin sidebar' : 'Pin sidebar'}
          className="icon-btn-anim"
        >
          <Menu size={24} color={isDark ? '#d4d4d4' : '#64748b'} />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            fontSize: '2.5rem',
            fontWeight: '900',
            fontStyle: 'italic',
            cursor: 'pointer'
          }}
          onClick={onSelectDashboard}
        >
          <span style={{ color: '#3b82f6', textShadow: '0 0 15px rgba(59, 130, 246, 0.5)' }}>V</span>
          <span style={{ color: isDark ? '#f5f5f5' : '#1e293b' }}>erity</span>
          <span style={layoutStyles.badge}>Admin</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginRight: '24px' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={onToggleNotifications}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: isDark ? '#3a3a3a' : '#e2e8f0',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '2px 2px 5px rgba(0,0,0,0.06)'
            }}
            title="Notifications"
          >
            <Bell size={18} color={isDark ? '#94a3b8' : '#475569'} />
            {currentNotifications.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                width: '8px',
                height: '8px',
                backgroundColor: '#ef4444',
                borderRadius: '50%',
                border: `1.5px solid ${isDark ? '#3C3C3C' : 'white'}`
              }} />
            )}
          </button>
          {currentShowNotifications && (
            <div style={{
              position: 'absolute',
              top: '52px',
              right: 0,
              width: '320px',
              backgroundColor: isDark ? '#1e1e1e' : 'white',
              borderRadius: '16px',
              boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.4)' : '0 10px 25px rgba(0,0,0,0.12)',
              zIndex: 200,
              padding: '16px',
              border: isDark ? '1px solid #3a3a3a' : '1px solid #e2e8f0'
            }} className="animate-scale-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>Notifications</h3>
                {currentNotifications.length > 0 && (
                  <span
                    onClick={onMarkAllNotificationsRead}
                    style={{ fontSize: '0.75rem', color: '#007bff', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Mark all as read
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentNotifications.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                    No new notifications.
                  </div>
                ) : (
                  currentNotifications.map(n => (
                    <div
                      key={n.id}
                      style={{
                        padding: '12px',
                        backgroundColor: isDark ? '#2a2a2a' : '#f8fafc',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        color: isDark ? '#cbd5e1' : '#334155',
                        border: isDark ? '1px solid #3a3a3a' : 'none'
                      }}
                    >
                      <strong style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>{n.title}</strong>
                      <br />
                      <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{n.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
      </div>
    </header>
  );
}

