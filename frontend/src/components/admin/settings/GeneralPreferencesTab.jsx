import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon } from 'lucide-react';
import { tabVariants } from '../../../data/adminSettings';
import { Toggle } from './SettingControls';
import AdminCheckUpdateCard from './AdminCheckUpdateCard';

export default function GeneralPreferencesTab({ data, onChange, direction, styles, T }) {
  const update = (key, val) => onChange({ ...data, [key]: val });

  return (
    <motion.div custom={direction} variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={styles.card}>
        {/* Maintenance Mode */}
        <div>
          <h3 style={styles.sectionTitle}><AlertOctagon size={18} color={T.red} /><span>System Maintenance Mode</span></h3>
          <p style={styles.sectionSub}>Temporarily restrict examinee kiosk logins during system updates.</p>
          <Toggle
            on={data.maintenanceMode}
            onToggle={() => update('maintenanceMode', !data.maintenanceMode)}
            label="Enable System Maintenance Mode"
            subtext="Locks out student examination logins and displays custom offline message."
            accent={T.red}
            T={T}
          />
          <AnimatePresence>
            {data.maintenanceMode && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: '16px', overflow: 'hidden' }}>
                <label style={styles.label}>Custom System Offline Message</label>
                <textarea rows={3} value={data.offlineMessage} onChange={e => update('offlineMessage', e.target.value)} style={styles.textarea} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={styles.divider} />

        {/* Software Updates */}
        <AdminCheckUpdateCard styles={styles} T={T} />
      </div>
    </motion.div>
  );
}

