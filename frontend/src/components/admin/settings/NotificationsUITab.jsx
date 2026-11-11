import React from 'react';
import { motion } from 'framer-motion';
import { Bell, LayoutList, Moon, Sun, Clipboard } from 'lucide-react';
import { tabVariants } from '../../../data/adminSettings';
import { Toggle } from './SettingControls';

export default function NotificationsUITab({
  notifData,
  uiData,
  onNotifChange,
  onUiChange,
  isDark,
  onDarkToggle,
  direction,
  styles,
  T
}) {
  const updateN = (key, val) => onNotifChange({ ...notifData, [key]: val });
  const updateU = (key, val) => onUiChange({ ...uiData, [key]: val });

  return (
    <motion.div custom={direction} variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Alert Notifications */}
      <div style={styles.card}>
        <div>
          <h3 style={styles.sectionTitle}><Bell size={18} color={T.blue} /><span>Notifications & Alert Behavior</span></h3>
          <p style={styles.sectionSub}>Control when and how warnings appear on the instructor's dashboard during live exams.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Toggle
              on={notifData.soundAlerts}
              onToggle={() => updateN('soundAlerts', !notifData.soundAlerts)}
              label="Enable Sound Alerts for Security Flags"
              subtext="Plays an audio chime on the instructor's dashboard when a student triggers a security event (e.g. Alt-Tab detected)."
              T={T}
            />
            <Toggle
              on={notifData.notifyOnSubmission}
              onToggle={() => updateN('notifyOnSubmission', !notifData.notifyOnSubmission)}
              label="Notify on Exam Submission"
              subtext="Shows a pop-up notification on the instructor's screen whenever a student submits their code."
              T={T}
            />
            <Toggle
              on={notifData.showToastWarnings}
              onToggle={() => updateN('showToastWarnings', !notifData.showToastWarnings)}
              label="Show Toast Notifications for Minor Warnings"
              subtext="Displays small side-panel toasts for low-severity events (e.g. long typing pause) instead of covering the full screen."
              T={T}
            />
          </div>
        </div>
      </div>

      {/* UI Preferences */}
      <div style={styles.card}>
        <div>
          <h3 style={styles.sectionTitle}><LayoutList size={18} color={T.blue} /><span>Dashboard UI Preferences</span></h3>
          <p style={styles.sectionSub}>Personalize the look and layout of the admin and instructor dashboard.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Dark Mode */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 18px', backgroundColor: T.bg, borderRadius: '16px', border: `1px solid ${T.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isDark ? <Moon size={18} color="#818cf8" /> : <Sun size={18} color={T.amber} />}
                <div>
                  <span style={{ fontSize: '0.88rem', fontWeight: '700', color: T.text, display: 'block' }}>
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: T.muted, display: 'block', marginTop: '2px' }}>
                    Toggle between light and dark themes for the entire dashboard.
                  </span>
                </div>
              </div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={onDarkToggle}
                style={{
                  width: '50px', height: '26px', borderRadius: '9999px',
                  backgroundColor: isDark ? '#818cf8' : '#cbd5e1',
                  position: 'relative', display: 'flex', alignItems: 'center',
                  padding: '3px', cursor: 'pointer', flexShrink: 0, transition: 'background 0.25s ease',
                }}
              >
                <motion.div
                  animate={{ x: isDark ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{ width: '20px', height: '20px', backgroundColor: '#ffffff', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                />
              </motion.div>
            </div>

            {/* Audit Table Density */}
            <div style={{ padding: '14px 18px', backgroundColor: T.bg, borderRadius: '16px', border: `1px solid ${T.border}` }}>
              <label style={{ ...styles.label, marginBottom: '10px' }}>Audit Log Table Density</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['Compact', 'Comfortable'].map(opt => (
                  <motion.button
                    key={opt}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => updateU('auditTableDensity', opt)}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '12px',
                      border: `2px solid ${uiData.auditTableDensity === opt ? T.blue : T.border}`,
                      backgroundColor: uiData.auditTableDensity === opt ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : T.card,
                      cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem',
                      color: uiData.auditTableDensity === opt ? T.blue : T.subtext,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {opt === 'Compact' ? <Clipboard size={15} /> : <LayoutList size={15} />}
                      <span>{opt}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: '500', marginTop: '3px', color: T.muted }}>
                      {opt === 'Compact' ? 'More rows visible, smaller text' : 'Larger text, easier to read'}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

