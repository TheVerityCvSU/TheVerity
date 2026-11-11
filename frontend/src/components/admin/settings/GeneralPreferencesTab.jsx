import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, AlertOctagon } from 'lucide-react';
import { tabVariants } from '../../../data/adminSettings';
import { Toggle } from './SettingControls';
import AdminCheckUpdateCard from './AdminCheckUpdateCard';

export default function GeneralPreferencesTab({ data, onChange, direction, styles, T }) {
  const update = (key, val) => onChange({ ...data, [key]: val });

  return (
    <motion.div custom={direction} variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={styles.card}>
        {/* Academic Calendar */}
        <div>
          <h3 style={styles.sectionTitle}><Calendar size={18} color={T.blue} /><span>Academic Calendar & Term Settings</span></h3>
          <p style={styles.sectionSub}>Define current active term and system-wide semester boundaries.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div>
              <label style={styles.label}>Current Term</label>
              <select value={data.currentTerm} onChange={e => update('currentTerm', e.target.value)} style={styles.select}>
                <option>Fall 2026</option>
                <option>Spring 2027</option>
                <option>Summer 2027</option>
                <option>Winter 2026</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Term Start Date</label>
              <input type="date" value={data.termStart} onChange={e => update('termStart', e.target.value)} style={styles.input} />
            </div>
            <div>
              <label style={styles.label}>Term End Date</label>
              <input type="date" value={data.termEnd} onChange={e => update('termEnd', e.target.value)} style={styles.input} />
            </div>
          </div>
        </div>

        <div style={styles.divider} />

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

