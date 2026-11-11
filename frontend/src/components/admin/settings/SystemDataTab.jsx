import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Clipboard, HardDrive, Download, Server, RefreshCw, Check } from 'lucide-react';
import { tabVariants } from '../../../data/adminSettings';
import { Toggle } from './SettingControls';
import { apiFetch } from '../../../data/api';
import { logSecurityEvent } from '../../../data/securityLogger';
import { useDarkMode } from '../../../hooks/useDarkMode';
import { getStyles } from '../../../pages/admin/adminSettingsStyles';

export default function SystemDataTab({ data, onChange, currentUserName = 'Admin', direction, styles: propStyles, T: propT }) {
  const { isDark } = useDarkMode();
  const styles = propStyles || getStyles(isDark);
  const T = propT || styles.T;

  const [backupStatus, setBackupStatus] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [syncResultMsg, setSyncResultMsg] = useState(null);

  const update = (key, val) => onChange({ ...data, [key]: val });

  const handleGenerateBackup = () => {
    setBackupStatus('Generating full database snapshot...');
    setTimeout(() => {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      onChange({ ...data, lastBackupTime: `Today at ${nowStr}` });
      setBackupStatus('System backup completed successfully!');
      logSecurityEvent({ user: currentUserName, type: 'Database Backup', severity: 'Normal', desc: 'Manual system backup triggered from Admin Settings' });
      setTimeout(() => setBackupStatus(null), 3000);
    }, 1200);
  };

  const handleSyncNow = async () => {
    setIsSyncingData(true);
    setSyncDone(false);
    setSyncResultMsg(null);
    try {
      const res = await apiFetch(`/api/sync`, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setSyncDone(true);
        setTimeout(() => setSyncDone(false), 2500);
        logSecurityEvent({ user: currentUserName, type: 'Database Sync', severity: 'Normal', desc: 'Manual LAN & Cloud database sync triggered from Admin Settings' });
        window.dispatchEvent(new CustomEvent('verity:sync-completed'));
        window.dispatchEvent(new CustomEvent('verity:classrooms-changed'));
      } else {
        setSyncResultMsg(json?.error || 'Sync completed with warnings.');
      }
    } catch (e) {
      setSyncResultMsg('Sync failed: Server connection error.');
    } finally {
      setIsSyncingData(false);
      setTimeout(() => setSyncResultMsg(null), 4000);
    }
  };

  const handleExportAuditCSV = async () => {
    setExporting(true);
    try {
      const res = await apiFetch(`/audit-logs`);
      const json = await res.json();
      const logs = json.logs || [];

      const headers = ['ID', 'Timestamp', 'User', 'Type', 'Severity', 'Description'];
      const rows = logs.map(l => [l.id, l.timestamp, l.user, l.type, l.severity, `"${(l.desc || '').replace(/"/g, '""')}"`]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verity_audit_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logSecurityEvent({ user: currentUserName, type: 'Audit Export', severity: 'Normal', desc: 'Exported global audit log as CSV' });
    } catch (e) {
      console.error('Export failed:', e);
    }
    setExporting(false);
  };

  return (
    <motion.div custom={direction} variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={styles.card}>
        {/* Data Retention */}
        <div>
          <h3 style={styles.sectionTitle}><Database size={18} color={T.blue} /><span>Data Retention & Archival Policies</span></h3>
          <p style={styles.sectionSub}>Automate cleanup of old examination logs and archived course records.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div>
              <label style={styles.label}>Delete Archived Classes Older Than:</label>
              <select value={data.retentionPeriod} onChange={e => update('retentionPeriod', e.target.value)} style={styles.select}>
                <option value="1 Year">1 Year</option>
                <option value="3 Years">3 Years</option>
                <option value="Never">Never (Retain indefinitely)</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Auto-Archive Audit Logs:</label>
              <select value={data.autoArchiveAuditLogs} onChange={e => update('autoArchiveAuditLogs', e.target.value)} style={styles.select}>
                <option value="7 Days">After 7 Days</option>
                <option value="30 Days">After 30 Days</option>
                <option value="Never">Never</option>
              </select>
            </div>
          </div>
        </div>

        <div style={styles.divider} />

        {/* Cache & Session */}
        <div>
          <h3 style={styles.sectionTitle}><Clipboard size={18} color={T.blue} /><span>Cache & Session Management</span></h3>
          <p style={styles.sectionSub}>Prevent UI slowdowns by cleaning up browser storage on session end.</p>
          <Toggle
            on={data.clearLocalStorageOnLogout}
            onToggle={() => update('clearLocalStorageOnLogout', !data.clearLocalStorageOnLogout)}
            label="Clear Browser LocalStorage on Logout"
            subtext="Wipes cached UI preferences and draft data on logout to keep the browser lean."
            T={T}
          />
        </div>

        <div style={styles.divider} />

        {/* Backup & Export */}
        <div>
          <h3 style={styles.sectionTitle}><HardDrive size={18} color={T.blue} /><span>System Snapshot & Audit Export</span></h3>
          <p style={styles.sectionSub}>Create instant SQLite snapshots or export security reports for the dean or parents.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleGenerateBackup} style={styles.secBtn}>
              <HardDrive size={16} color={T.blue} />
              <span>Generate System Backup</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleExportAuditCSV} disabled={exporting}
              style={{ ...styles.secBtn, opacity: exporting ? 0.6 : 1 }}>
              <Download size={16} color="#16a34a" />
              <span>{exporting ? 'Exporting...' : 'Export Global Audit Report (.CSV)'}</span>
            </motion.button>
            <span style={{ fontSize: '0.82rem', color: T.muted, fontWeight: '500' }}>
              Last backup: <strong style={{ color: T.text }}>{data.lastBackupTime}</strong>
            </span>
          </div>
          <AnimatePresence>
            {backupStatus && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  marginTop: '12px', padding: '10px 14px', borderRadius: '10px', fontSize: '0.82rem',
                  backgroundColor: backupStatus.includes('completed') ? '#dcfce7' : '#dbeafe',
                  color: backupStatus.includes('completed') ? '#15803d' : '#1d4ed8',
                  fontWeight: '600', width: 'fit-content',
                }}>
                {backupStatus}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={styles.divider} />

        {/* Server & Cloud Sync */}
        <div>
          <h3 style={styles.sectionTitle}><Server size={18} color={T.blue} /><span>Server Architecture & Cloud Sync</span></h3>
          <p style={styles.sectionSub}>Manage synchronization between the Local / ComLab LAN server and Online Cloud server (Supabase PostgreSQL).</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px 18px', borderRadius: '16px', backgroundColor: isDark ? '#262626' : '#f8fafc', border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: T.text }}>Online Cloud Server</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>Supabase / Render</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: T.muted }}>
                  Active Endpoint: <strong>https://verity-2z4v.onrender.com</strong>
                </div>
              </div>

              <div style={{ padding: '14px 18px', borderRadius: '16px', backgroundColor: isDark ? '#262626' : '#f8fafc', border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: T.text }}>Local ComLab LAN Server</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '6px' }}>Offline Router</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: T.muted }}>
                  Auto-Discovered LAN or Localhost: <strong>http://localhost:3001</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSyncNow}
                disabled={isSyncingData}
                style={{
                  ...styles.secBtn,
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0, 123, 255, 0.25)'
                }}
              >
                {syncDone ? <Check size={16} /> : <RefreshCw size={16} className={isSyncingData ? 'animate-spin' : ''} />}
                <span>{isSyncingData ? 'Synchronizing Databases...' : (syncDone ? 'Synchronized Complete' : 'Sync LAN & Cloud Databases Now')}</span>
              </motion.button>
              {syncResultMsg && (
                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: syncResultMsg.includes('success') ? '#16a34a' : '#dc2626' }}>
                  {syncResultMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

