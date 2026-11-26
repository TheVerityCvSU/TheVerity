import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  fetchClassroomsMap,
  checkServerHealth,
  runServerDiagnostic,
  fetchUserAuditLogs
} from '../../data/adminDashboard';
import DiagnosticModal from '../../components/admin/DiagnosticModal';
import UserAuditModal from '../../components/admin/UserAuditModal';
import Skeleton from '../../components/Skeleton';
import { getStyles } from './dashboardOverviewStyles';

export default function DashboardOverview({ stats, users, loading = false, query, msg }) {
  const { isDark } = useDarkMode();
  const sh = getStyles(isDark);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [viewOrigin, setViewOrigin] = useState({ x: '50%', y: '50%' });
  const [serverOnline, setServerOnline] = useState(null);
  const [flagHistory, setFlagHistory] = useState([]);
  const [flagHistoryLoading, setFlagHistoryLoading] = useState(false);
  const [classroomsMap, setClassroomsMap] = useState({});

  useEffect(() => {
    fetchClassroomsMap().then(setClassroomsMap);
    const handleServerChanged = () => {
      fetchClassroomsMap().then(setClassroomsMap);
    };
    window.addEventListener('verity:server-changed', handleServerChanged);
    window.addEventListener('verity:classrooms-changed', handleServerChanged);
    return () => {
      window.removeEventListener('verity:server-changed', handleServerChanged);
      window.removeEventListener('verity:classrooms-changed', handleServerChanged);
    };
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      const ok = await checkServerHealth();
      setServerOnline(ok);
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    const goOnline = () => checkHealth();
    const goOffline = () => setServerOnline(false);
    const onServerChanged = () => checkHealth();
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('verity:server-changed', onServerChanged);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('verity:server-changed', onServerChanged);
    };
  }, []);

  const runDiagnostic = async () => {
    setShowDiagnostic(true);
    setDiagnosticData(null);
    const data = await runServerDiagnostic();
    setDiagnosticData(data);
  };

  const fmtFlagTime = (iso) => {
    if (!iso) return 'No flags';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return iso;
    }
  };

  const filtered = users
    .filter(u => u.role !== 'Admin')
    .filter(u => {
      const q = query.toLowerCase();
      return (u.name || '').toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
        || (u.role || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const timeA = a.lastFlagTime ? new Date(a.lastFlagTime).getTime() : 0;
      const timeB = b.lastFlagTime ? new Date(b.lastFlagTime).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      const loginA = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
      const loginB = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
      if (loginA !== loginB) return loginB - loginA;
      return (a.name || '').localeCompare(b.name || '');
    });

  const fmt = iso => {
    if (!iso) return 'Never';
    try {
      return new Date(iso).toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return iso;
    }
  };

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(tick);
  }, []);

  const isOnline = (lastLogin) => {
    if (!lastLogin) return false;
    try {
      return (now - new Date(lastLogin).getTime()) < 30 * 60 * 1000;
    } catch {
      return false;
    }
  };

  const activeUsersCount = (stats?.activeUsers !== undefined && stats?.activeUsers > 0)
    ? stats.activeUsers
    : (users && users.length > 0 ? users.filter(u => u.role !== 'Admin' && u.status !== 'Pending' && u.status !== 'Disabled').length : 0);

  return (
    <div style={sh.pageWrap}>
      {msg && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '9999px',
          fontSize: '0.85rem',
          fontWeight: '600',
          backgroundColor: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: msg.type === 'success' ? '#15803d' : '#b91c1c'
        }}>
          {msg.text}
        </div>
      )}

      {/* Top 4 Stat Cards */}
      <div style={{
        position: 'sticky',
        top: 0,
        backgroundColor: isDark ? '#3C3C3C' : '#EEF0F3',
        zIndex: 10,
        padding: '0 0 16px 0'
      }}>
        <div style={sh.statsGrid}>
          <div style={sh.statCard}>
            <div style={sh.statLabel}>Total Active users</div>
            <div style={sh.statNum}>{activeUsersCount}</div>
          </div>
          <div style={sh.statCard}>
            <div style={sh.statLabel}>Alt-Tab & Copy-Paste Flags</div>
            <div style={{ ...sh.statNum, color: '#f59e0b' }}>{stats.altTabCopyPasteFlags || 0}</div>
          </div>
          <div style={sh.statCard}>
            <div style={sh.statLabel}>Security Flags Today</div>
            <div style={{ ...sh.statNum, color: '#ef4444' }}>{stats.securityFlagsToday || 0}</div>
          </div>
          <div style={sh.statCard}>
            <div style={sh.statLabel}>System Status</div>
            <div style={{
              fontSize: '1.4rem',
              fontWeight: '800',
              color: serverOnline === false ? '#ef4444' : '#22c55e',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{
                width: '10px',
                height: '10px',
                backgroundColor: serverOnline === false ? '#ef4444' : serverOnline === null ? '#f59e0b' : '#22c55e',
                borderRadius: '50%',
                boxShadow: serverOnline === false ? '0 0 10px #ef4444' : serverOnline === null ? '0 0 10px #f59e0b' : '0 0 10px #22c55e',
                flexShrink: 0,
              }} />
              {serverOnline === null ? 'Checking...' : serverOnline ? 'Online' : 'Offline'}
            </div>
            <div style={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '500' }}>
              {serverOnline === false ? 'Server unreachable' : serverOnline === null ? 'Connecting...' : '100% Uptime'}
              {' • '}
              <span style={{ cursor: 'pointer', color: '#007bff' }} onClick={runDiagnostic}>Run Diagnostic</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Table Container */}
      <div style={sh.mainCard}>
        <h2 style={{ ...sh.cardTitle, marginBottom: '16px' }}>Integrity Logs</h2>

        <div style={sh.tableWrap}>
          {/* Capsule Table Header */}
          <div style={{
            backgroundColor: isDark ? '#374151' : '#a3aeb9',
            borderRadius: '9999px',
            padding: '12px 24px',
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1.5fr 0.8fr',
            alignItems: 'center',
            fontWeight: '700',
            color: isDark ? '#f1f5f9' : '#0f172a',
            fontSize: '0.88rem',
            marginBottom: '10px'
          }}>
            <div>Name</div>
            <div>Role</div>
            <div>Status</div>
            <div>Flags & Time</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {/* Table Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton.Row key={i} />)
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.9rem' }}>
                No users found
              </div>
            ) : (
              filtered.map(u => (
                <div key={u.email} className="table-row-pill" style={{ padding: '10px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 0.8fr', alignItems: 'center', fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>{u.name}</div>
                  <div><span style={sh.rolePill}>{u.role}</span></div>
                  <div>
                    <span style={isOnline(u.lastLogin) ? sh.statusGreenPill : sh.statusRedPill}>
                      {isOnline(u.lastLogin) ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                    {u.lastFlagTime ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#f59e0b' }}>
                          {fmtFlagTime(u.lastFlagTime)}
                        </span>
                        <span style={{ fontSize: '0.73rem', color: isDark ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={u.lastFlagDesc || 'Alt-Tab / Security Flag'}>
                          {u.lastFlagDesc || 'Alt-Tab Violation'} {u.flagCount > 1 ? `(${u.flagCount}x)` : ''}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: isDark ? '#64748b' : '#94a3b8' }}>
                        No flags
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={async (e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setViewOrigin({
                          x: `${rect.left + rect.width / 2}px`,
                          y: `${rect.top + rect.height / 2}px`,
                        });
                        setViewUser(u);
                        setFlagHistory([]);
                        setFlagHistoryLoading(true);
                        try {
                          const logs = await fetchUserAuditLogs(u.name || u.email);
                          setFlagHistory(logs);
                        } catch {
                          setFlagHistory([]);
                        } finally {
                          setFlagHistoryLoading(false);
                        }
                      }}
                      style={sh.actionTextLink}
                      className="btn-anim"
                    >
                      View
                    </motion.button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <DiagnosticModal
        isOpen={showDiagnostic}
        isDark={isDark}
        diagnosticData={diagnosticData}
        onClose={() => setShowDiagnostic(false)}
        styles={sh}
      />

      <UserAuditModal
        viewUser={viewUser}
        viewOrigin={viewOrigin}
        isDark={isDark}
        onClose={() => setViewUser(null)}
        flagHistory={flagHistory}
        flagHistoryLoading={flagHistoryLoading}
        classroomsMap={classroomsMap}
        styles={sh}
        fmt={fmt}
      />
    </div>
  );
}
