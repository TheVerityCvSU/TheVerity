import React, { useState, useLayoutEffect, useRef } from 'react';
import { BarChart3, Users, Home, Shield, Settings } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { markNotificationsAsRead } from '../../data/adminNotifications';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminSidebar from '../../components/admin/AdminSidebar';
import SelectUsersModal from '../../components/admin/SelectUsersModal';
import { getLayoutStyles } from './adminLayoutStyles';

export default function AdminLayout({
  children,
  activeTab,
  setActiveTab,
  sidebarCollapsed,
  setSidebarCollapsed,
  query,
  setQuery,
  dashboardSearchFocused,
  setDashboardSearchFocused,
  notifications,
  setNotifications,
  showNotifications,
  setShowNotifications,
  isModalOpen,
  setIsModalOpen,
  newUser,
  setNewUser,
  handleAddUser,
  currentUser,
  onLogout,
  showSelectUsersPopup,
  setShowSelectUsersPopup
}) {
  const { isDark } = useDarkMode();
  const layoutStyles = getLayoutStyles(isDark);
  const [localActiveTab, setLocalActiveTab] = useState(activeTab || 'dashboard');
  const [localSidebarCollapsed, setLocalSidebarCollapsed] = useState(sidebarCollapsed || false);
  const [localNotifications, setLocalNotifications] = useState(notifications || []);
  const [localShowNotifications, setLocalShowNotifications] = useState(showNotifications || false);
  const [localShowSelectUsersPopup, setLocalShowSelectUsersPopup] = useState(showSelectUsersPopup || false);

  const currentActiveTab = activeTab !== undefined ? activeTab : localActiveTab;
  const currentSidebarCollapsed = sidebarCollapsed !== undefined ? sidebarCollapsed : localSidebarCollapsed;
  const currentNotifications = notifications !== undefined ? notifications : localNotifications;
  const currentShowNotifications = showNotifications !== undefined ? showNotifications : localShowNotifications;
  const currentShowSelectUsersPopup = showSelectUsersPopup !== undefined ? showSelectUsersPopup : localShowSelectUsersPopup;

  const finalSetActiveTab = setActiveTab || setLocalActiveTab;
  const finalSetSidebarCollapsed = setSidebarCollapsed || setLocalSidebarCollapsed;
  const finalSetNotifications = setNotifications || setLocalNotifications;
  const finalSetShowNotifications = setShowNotifications || setLocalShowNotifications;
  const finalSetShowSelectUsersPopup = setShowSelectUsersPopup || setLocalShowSelectUsersPopup;

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 120);
  };

  const isExpanded = !currentSidebarCollapsed || isHovered;
  const effectiveSidebarCollapsed = !isExpanded;

  const navRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState(() => {
    try {
      const savedTop = sessionStorage.getItem('verity_admin_nav_indicator_top');
      const savedHeight = sessionStorage.getItem('verity_admin_nav_indicator_height');
      if (savedTop !== null && !isNaN(Number(savedTop))) {
        return {
          top: Number(savedTop),
          height: savedHeight ? Number(savedHeight) : 42,
          opacity: 1,
          transition: true
        };
      }
    } catch { /* ignore */ }
    return { top: 0, height: 42, opacity: 0, transition: false };
  });

  useLayoutEffect(() => {
    const update = () => {
      const activeRef = navRefs.current[currentActiveTab];
      if (activeRef) {
        try {
          sessionStorage.setItem('verity_admin_nav_indicator_top', String(activeRef.offsetTop));
          sessionStorage.setItem('verity_admin_nav_indicator_height', String(activeRef.offsetHeight));
        } catch { /* ignore */ }

        setIndicatorStyle(prev => {
          const distance = Math.abs(activeRef.offsetTop - prev.top);
          const bounceOvershoot = distance > 0 ? Math.min(0.42, Math.max(0.03, 16 / distance)) : 0;
          const bounceRatio = (1 + bounceOvershoot).toFixed(3);
          const duration = distance > 150 ? '0.46s' : '0.38s';
          const transitionStr = `top ${duration} cubic-bezier(0.34, ${bounceRatio}, 0.64, 1), height 0.25s ease, opacity 0.2s ease`;

          if (prev.top === activeRef.offsetTop && prev.height === activeRef.offsetHeight && prev.opacity === 1 && prev.transition === transitionStr) return prev;
          return { top: activeRef.offsetTop, height: activeRef.offsetHeight, opacity: 1, transition: transitionStr };
        });
      } else {
        setIndicatorStyle(prev => prev.opacity === 0 ? prev : { ...prev, opacity: 0 });
      }
    };

    update();
    const timer = setTimeout(update, 20);
    return () => clearTimeout(timer);
  }, [currentActiveTab, effectiveSidebarCollapsed]);

  const navItems = [
    { id: 'dashboard', Icon: BarChart3, label: 'Dashboard Overview' },
    { id: 'users', Icon: Users, label: 'User Management' },
    { id: 'classes', Icon: Home, label: 'Global Classes' },
    { id: 'security', Icon: Shield, label: 'Security & Audit Logs' },
    { id: 'settings', Icon: Settings, label: 'Settings' },
  ];

  const handleMarkAllRead = () => {
    markNotificationsAsRead(currentNotifications);
    finalSetNotifications([]);
    finalSetShowNotifications(false);
  };

  const handleNotificationClick = (n) => {
    markNotificationsAsRead([n]);
    finalSetNotifications(prev => prev.filter(item => item.id !== n.id));
    finalSetShowNotifications(false);

    const nid = (n.id || '').toLowerCase();
    const ntext = `${n.title || ''} ${n.text || ''}`.toLowerCase();

    if (nid.includes('instructor') || ntext.includes('instructor') || nid.includes('user') || ntext.includes('registration')) {
      finalSetActiveTab('users');
    } else if (nid.includes('security') || nid.includes('malicious') || ntext.includes('security') || ntext.includes('malicious') || ntext.includes('flag')) {
      finalSetActiveTab('security');
    } else if (nid.includes('maintenance') || ntext.includes('maintenance')) {
      finalSetActiveTab('settings');
    } else if (nid.includes('class') || ntext.includes('class')) {
      finalSetActiveTab('classes');
    } else {
      finalSetActiveTab('dashboard');
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      minHeight: '100vh',
      backgroundColor: isDark ? '#3C3C3C' : '#EEF0F3',
      fontFamily: 'Arial, Helvetica, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      transition: 'background-color 0.25s ease'
    }}>
      <AdminHeader
        isDark={isDark}
        currentSidebarCollapsed={currentSidebarCollapsed}
        onToggleSidebar={() => finalSetSidebarCollapsed(!currentSidebarCollapsed)}
        onSelectDashboard={() => finalSetActiveTab('dashboard')}
        currentShowNotifications={currentShowNotifications}
        onToggleNotifications={() => finalSetShowNotifications(!currentShowNotifications)}
        currentNotifications={currentNotifications}
        onMarkAllNotificationsRead={handleMarkAllRead}
        onNotificationClick={handleNotificationClick}
        currentUser={currentUser}
        onLogout={onLogout}
        layoutStyles={layoutStyles}
      />

      <SelectUsersModal
        isOpen={currentShowSelectUsersPopup}
        isDark={isDark}
        onClose={() => finalSetShowSelectUsersPopup(false)}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <AdminSidebar
          layoutStyles={layoutStyles}
          effectiveSidebarCollapsed={effectiveSidebarCollapsed}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          currentActiveTab={currentActiveTab}
          onSelectTab={finalSetActiveTab}
          isDark={isDark}
          navItems={navItems}
          indicatorStyle={indicatorStyle}
          navRefs={navRefs}
        />

        <div style={layoutStyles.mainContent}>
          <div style={layoutStyles.tabContent}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
