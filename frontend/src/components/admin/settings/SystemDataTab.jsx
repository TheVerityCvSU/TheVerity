import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Clipboard, Download, Server, RefreshCw, Check, Globe, Wifi } from 'lucide-react';
import { tabVariants } from '../../../data/adminSettings';
import { Toggle } from './SettingControls';
import { 
  apiFetch,
  getConnectionStatus, 
  subscribeConnectionStatus, 
  switchToCloudMode, 
  switchToLanMode, 
  setCustomLanServer,
  getCloudUrl,
  getLocalApiUrl
} from '../../../data/api';
import { logSecurityEvent } from '../../../data/securityLogger';
import { useDarkMode } from '../../../hooks/useDarkMode';
import { getStyles } from '../../../pages/admin/adminSettingsStyles';

export default function SystemDataTab({ data, onChange, currentUserName = 'Admin', direction, styles: propStyles, T: propT }) {
  const { isDark } = useDarkMode();
  const styles = propStyles || getStyles(isDark);
  const T = propT || styles.T;

  const [exporting, setExporting] = useState(false);
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [syncResultMsg, setSyncResultMsg] = useState(null);

  const [netStatus, setNetStatus] = useState(() => getConnectionStatus());
  const [customServerInput, setCustomServerInput] = useState(() => {
    return localStorage.getItem('verity_lan_server') || getLocalApiUrl() || 'http://localhost:3001';
  });
  const [switchingMode, setSwitchingMode] = useState(false);
  const [serverFeedback, setServerFeedback] = useState(null);

  useEffect(() => {
    const unsub = subscribeConnectionStatus((status) => {
      setNetStatus(status);
    });
    return () => unsub();
  }, []);

  const handleSwitchToCloudServer = async () => {
    setSwitchingMode(true);
    setServerFeedback(null);
    try {
      switchToCloudMode();
      setServerFeedback({ type: 'success', message: 'Switched to Online Cloud Server.' });
      logSecurityEvent({ user: currentUserName, type: 'Server Switch', severity: 'Normal', desc: 'Switched active server to Online Cloud Server' });
    } catch (e) {
      setServerFeedback({ type: 'error', message: 'Failed to switch to Online Cloud Server.' });
    } finally {
      setSwitchingMode(false);
      setTimeout(() => setServerFeedback(null), 4000);
    }
  };

  const handleSwitchToLanServer = async () => {
    setSwitchingMode(true);
    setServerFeedback(null);
    try {
      const res = await switchToLanMode();
      if (res && res.success) {
        setServerFeedback({ type: 'success', message: `Switched to Local ComLab Server (${res.url || 'localhost:3001'}).` });
        logSecurityEvent({ user: currentUserName, type: 'Server Switch', severity: 'Normal', desc: `Switched active server to Local LAN Server (${res.url})` });
      } else {
        setServerFeedback({ type: 'error', message: 'Could not connect to Local Server. Please check that local server is running.' });
      }
    } catch (e) {
      setServerFeedback({ type: 'error', message: 'Failed to switch to Local Server.' });
    } finally {
      setSwitchingMode(false);
      setTimeout(() => setServerFeedback(null), 4000);
    }
  };

  const handleConnectCustomServer = async (e) => {
    if (e) e.preventDefault();
    if (!customServerInput.trim()) return;
    setSwitchingMode(true);
    setServerFeedback(null);
    try {
      const res = await setCustomLanServer(customServerInput.trim());
      if (res && res.success) {
        setServerFeedback({ type: 'success', message: `Connected to ${res.mode === 'cloud' ? 'Online Server' : 'LAN Server'} (${res.url}).` });
        logSecurityEvent({ user: currentUserName, type: 'Server Switch', severity: 'Normal', desc: `Configured and connected to server ${res.url}` });
      } else {
        setServerFeedback({ type: 'error', message: res?.error || 'Could not connect to the specified server address.' });
      }
    } catch (err) {
      setServerFeedback({ type: 'error', message: err.message || 'Connection failed.' });
    } finally {
      setSwitchingMode(false);
      setTimeout(() => setServerFeedback(null), 5000);
    }
  };

  const update = (key, val) => onChange({ ...data, [key]: val });

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
      if (!res.ok) {
        console.warn('Failed to export audit logs: HTTP', res.status);
        setExporting(false);
        return;
      }
      const json = await res.json().catch(() => ({ logs: [] }));
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

        {/* Audit Export */}
        <div>
          <h3 style={styles.sectionTitle}><Download size={18} color={T.blue} /><span>Audit Export</span></h3>
          <p style={styles.sectionSub}>Export global security and activity audit reports as CSV.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleExportAuditCSV} disabled={exporting}
              style={{ ...styles.secBtn, opacity: exporting ? 0.6 : 1 }}>
              <Download size={16} color="#16a34a" />
              <span>{exporting ? 'Exporting...' : 'Export Global Audit Report (.CSV)'}</span>
            </motion.button>
          </div>
        </div>

        <div style={styles.divider} />

        {/* Server & Cloud Sync */}
        <div>
          <h3 style={styles.sectionTitle}><Server size={18} color={T.blue} /><span>Server Architecture & Cloud Sync</span></h3>
          <p style={styles.sectionSub}>Switch between the Online Cloud server (Supabase / Render) and the Local ComLab LAN server (localhost / offline router), or synchronize databases.</p>

          <AnimatePresence>
            {serverFeedback && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  backgroundColor: serverFeedback.type === 'success' 
                    ? (isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7') 
                    : (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2'),
                  color: serverFeedback.type === 'success' ? '#16a34a' : '#dc2626',
                  border: serverFeedback.type === 'success' ? '1px solid #86efac' : '1px solid #fca5a5',
                  width: 'fit-content'
                }}
              >
                {serverFeedback.message}
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {/* Online Cloud Server Card */}
              <div 
                style={{ 
                  padding: '16px 20px', 
                  borderRadius: '16px', 
                  backgroundColor: isDark ? '#262626' : '#f8fafc', 
                  border: netStatus.activeMode === 'cloud' 
                    ? (isDark ? '2px solid #22c55e' : '2px solid #16a34a') 
                    : (isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0'),
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: netStatus.activeMode === 'cloud' ? '0 4px 16px rgba(34, 197, 94, 0.15)' : 'none'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Globe size={16} color={netStatus.activeMode === 'cloud' ? '#16a34a' : T.muted} />
                      <span style={{ fontSize: '0.88rem', fontWeight: '700', color: T.text }}>Online Cloud Server</span>
                    </div>
                    {netStatus.activeMode === 'cloud' ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#16a34a', backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7', padding: '3px 10px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} /> Active Server
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: T.muted, backgroundColor: isDark ? '#333' : '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                        Standby
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: T.muted }}>
                    Active Endpoint: <strong style={{ color: T.text, wordBreak: 'break-all' }}>{netStatus.cloudUrl || getCloudUrl()}</strong>
                  </div>
                </div>

                <div>
                  {netStatus.activeMode === 'cloud' ? (
                    <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px' }}>
                      <Check size={14} /> Currently serving all admin queries & data
                    </div>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSwitchToCloudServer}
                      disabled={switchingMode}
                      style={{
                        width: '100%',
                        padding: '9px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        cursor: switchingMode ? 'not-allowed' : 'pointer',
                        opacity: switchingMode ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                      }}
                    >
                      <Globe size={14} />
                      <span>Switch to Online Cloud Server</span>
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Local ComLab LAN Server Card */}
              <div 
                style={{ 
                  padding: '16px 20px', 
                  borderRadius: '16px', 
                  backgroundColor: isDark ? '#262626' : '#f8fafc', 
                  border: netStatus.activeMode === 'lan' 
                    ? (isDark ? '2px solid #0ea5e9' : '2px solid #0284c7') 
                    : (isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0'),
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: netStatus.activeMode === 'lan' ? '0 4px 16px rgba(14, 165, 233, 0.15)' : 'none'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Wifi size={16} color={netStatus.activeMode === 'lan' ? '#0284c7' : T.muted} />
                      <span style={{ fontSize: '0.88rem', fontWeight: '700', color: T.text }}>Local ComLab LAN Server</span>
                    </div>
                    {netStatus.activeMode === 'lan' ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0284c7', backgroundColor: isDark ? 'rgba(14, 165, 233, 0.2)' : '#e0f2fe', padding: '3px 10px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} /> Active Server
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: T.muted, backgroundColor: isDark ? '#333' : '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                        Standby
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: T.muted }}>
                    Local Endpoint: <strong style={{ color: T.text, wordBreak: 'break-all' }}>{netStatus.localUrl || getLocalApiUrl()}</strong>
                  </div>
                </div>

                <div>
                  {netStatus.activeMode === 'lan' ? (
                    <div style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px' }}>
                      <Check size={14} /> Currently serving all admin queries & data
                    </div>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSwitchToLanServer}
                      disabled={switchingMode}
                      style={{
                        width: '100%',
                        padding: '9px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: '#0284c7',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        cursor: switchingMode ? 'not-allowed' : 'pointer',
                        opacity: switchingMode ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                      }}
                    >
                      <Wifi size={14} />
                      <span>Switch to Local LAN Server</span>
                    </motion.button>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Server Configuration Input */}
            <form onSubmit={handleConnectCustomServer} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
              <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: '600', color: T.muted }}>Custom LAN / Server Address:</label>
                <input
                  type="text"
                  value={customServerInput}
                  onChange={(e) => setCustomServerInput(e.target.value)}
                  placeholder="e.g. http://localhost:3001 or http://192.168.1.50:3001"
                  style={{
                    padding: '9px 14px',
                    borderRadius: '10px',
                    border: isDark ? '1px solid #3f3f46' : '1px solid #cbd5e1',
                    backgroundColor: isDark ? '#18181b' : '#ffffff',
                    color: T.text,
                    fontSize: '0.85rem',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ alignSelf: 'flex-end' }}>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={switchingMode}
                  style={{
                    ...styles.secBtn,
                    padding: '9px 18px',
                    cursor: switchingMode ? 'not-allowed' : 'pointer',
                    opacity: switchingMode ? 0.7 : 1
                  }}
                >
                  <Server size={15} color={T.blue} />
                  <span>{switchingMode ? 'Connecting...' : 'Connect to Address'}</span>
                </motion.button>
              </div>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
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

