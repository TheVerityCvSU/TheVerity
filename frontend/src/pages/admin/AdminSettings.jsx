import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Shield, Code2, Bell, Users, Database } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  DEFAULT_SETTINGS,
  loadSystemSettings,
  saveSystemSettings,
} from '../../data/adminSettings';
import { getStyles } from './adminSettingsStyles';

import GeneralPreferencesTab from '../../components/admin/settings/GeneralPreferencesTab';
import KioskSecurityTab from '../../components/admin/settings/KioskSecurityTab';
import ExamDefaultsTab from '../../components/admin/settings/ExamDefaultsTab';
import NotificationsUITab from '../../components/admin/settings/NotificationsUITab';
import RolesPermissionsTab from '../../components/admin/settings/RolesPermissionsTab';
import SystemDataTab from '../../components/admin/settings/SystemDataTab';
import Skeleton from '../../components/Skeleton';

export default function SystemSettingsTab({ currentUser: propCurrentUser }) {
  const [activeTab, setActiveTab] = useState('general');
  const [direction, setDirection] = useState(1);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const { isDark, toggle: toggleDark } = useDarkMode();
  const { currentUser: hookUser } = useCurrentUser();
  const currentUser = propCurrentUser || hookUser;
  const currentUserName = currentUser?.name || currentUser?.email || 'Admin';

  const styles = getStyles(isDark);
  const T = styles.T;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const data = await loadSystemSettings();
      if (mounted && data) {
        setSettings(data);
      }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isInitialLoad = useRef(true);
  useEffect(() => {
    if (loading) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveSystemSettings(settings, activeTab, currentUserName);
    }, 600);
    return () => clearTimeout(timer);
  }, [settings, loading, activeTab, currentUserName]);

  const tabs = [
    { id: 'general', Icon: Sparkles, label: 'General' },
    { id: 'kiosk', Icon: Shield, label: 'Kiosk & Security' },
    { id: 'exam', Icon: Code2, label: 'Exam Defaults' },
    { id: 'notifications', Icon: Bell, label: 'Notifications & UI' },
    { id: 'roles', Icon: Users, label: 'Roles & Permissions' },
    { id: 'data', Icon: Database, label: 'System & Data' },
  ];

  const update = (section, val) => setSettings((prev) => ({ ...prev, [section]: val }));

  return (
    <div style={styles.pageWrap}>
      {/* TAB BAR */}
      <div style={styles.tabBar}>
        {tabs.map(({ id, Icon, label }, index) => (
          <motion.button
            key={id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const currentIndex = tabs.findIndex((t) => t.id === activeTab);
              setDirection(index > currentIndex ? 1 : -1);
              setActiveTab(id);
            }}
            style={styles.tabBtn(activeTab === id)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </motion.button>
        ))}
      </div>

      {/* TAB PANELS */}
      {loading ? (
        <div style={{ padding: '24px 0' }}>
          <Skeleton.Settings />
        </div>
      ) : (
        <AnimatePresence mode="wait" custom={direction}>
          {activeTab === 'general' && (
            <GeneralPreferencesTab
              key="general"
              data={settings.general}
              onChange={(v) => update('general', v)}
              direction={direction}
              styles={styles}
              T={T}
            />
          )}
          {activeTab === 'kiosk' && (
            <KioskSecurityTab
              key="kiosk"
              data={settings.security}
              onChange={(v) => update('security', v)}
              direction={direction}
              styles={styles}
              T={T}
            />
          )}
          {activeTab === 'exam' && (
            <ExamDefaultsTab
              key="exam"
              data={settings.examDefaults}
              onChange={(v) => update('examDefaults', v)}
              direction={direction}
              styles={styles}
              T={T}
            />
          )}
          {activeTab === 'notifications' && (
            <NotificationsUITab
              key="notifications"
              notifData={settings.notifications}
              uiData={settings.uiPrefs}
              onNotifChange={(v) => update('notifications', v)}
              onUiChange={(v) => update('uiPrefs', v)}
              isDark={isDark}
              onDarkToggle={toggleDark}
              direction={direction}
              styles={styles}
              T={T}
            />
          )}
          {activeTab === 'roles' && (
            <RolesPermissionsTab
              key="roles"
              data={settings.roles}
              onChange={(v) => update('roles', v)}
              direction={direction}
              styles={styles}
              T={T}
            />
          )}
          {activeTab === 'data' && (
            <SystemDataTab
              key="data"
              data={settings.data}
              onChange={(v) => update('data', v)}
              currentUserName={currentUserName}
              direction={direction}
              styles={styles}
              T={T}
            />
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
