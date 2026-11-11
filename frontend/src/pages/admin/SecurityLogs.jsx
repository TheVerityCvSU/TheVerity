import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, AlertCircle, ShieldAlert } from 'lucide-react';
import { getSecurityLogs, logSecurityEvent } from '../../data/securityLogger';
import { useDarkMode } from '../../hooks/useDarkMode';
import { apiFetch } from '../../data/api';

const getStyles = (isDark) => ({
  pageWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    overflowY: 'auto',
    minWidth: 0,
    MsOverflowStyle: 'none',
    scrollbarWidth: 'none',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', flexShrink: 0 },
  statCard: { backgroundColor: isDark ? '#2c2c2c' : 'white', borderRadius: '20px', padding: '20px 24px', boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '110px', border: isDark ? '1px solid #3a3a3a' : 'none' },
  statLabel: { fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '6px', fontWeight: '500' },
  statNum: { fontSize: '2.2rem', fontWeight: '800', color: isDark ? '#f1f5f9' : '#0f172a', lineHeight: 1.1 },
  mainCard: { backgroundColor: isDark ? '#2c2c2c' : 'white', borderRadius: '20px', padding: '24px', boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.05)', flex: 1, border: isDark ? '1px solid #3a3a3a' : 'none' },
  cardTitle: { margin: '0 0 2px', fontSize: '1rem', fontWeight: '800', color: isDark ? '#f1f5f9' : '#1e293b' },
  tableWrap: { overflowX: 'auto' },
  searchPill: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: isDark ? '#2a2a2a' : '#f8fafc', border: `1px solid ${isDark ? '#3a3a3a' : '#e2e8f0'}`, borderRadius: '9999px', padding: '8px 16px', flex: 1 },
  searchInput: { border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '0.85rem', color: isDark ? '#e2e8f0' : '#334155', width: '100%' },
  addBlueBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', backgroundColor: '#007bff', border: 'none', borderRadius: '9999px', color: 'white', fontWeight: '700', fontSize: '0.83rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,123,255,0.3)', whiteSpace: 'nowrap' },
});

export default function SecurityAuditLogsTab() {
  const { isDark } = useDarkMode();
  const sh = getStyles(isDark);

  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [density, setDensity] = useState('Comfortable');

  useEffect(() => {
    let isMounted = true;
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`)
      .then(res => res.ok ? res.json() : {})
      .then(d => {
        if (!isMounted) return;
        const s = d.settings?.global_config || d.settings;
        if (s?.uiPrefs?.auditTableDensity) {
          setDensity(s.uiPrefs.auditTableDensity);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const fetchLogs = async () => {
    const fetched = await getSecurityLogs();
    setLogs(fetched.filter(l => 
      l.type !== 'Alt-Tab / Copy-Paste Violation' && 
      l.type !== 'Exit Tab Violation' && 
      l.type !== 'Copy/Paste Violation'
    ));
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const total = logs.length;
  const high = logs.filter(l => l.severity === 'High').length;
  const warnings = logs.filter(l => l.severity === 'Warning').length;
  const adminActions = logs.filter(l => (l.user || '').toLowerCase().includes('admin')).length;
  const maliciousCount = logs.filter(l => 
    (l.type || '').toLowerCase().includes('malicious') || 
    (l.desc || '').toLowerCase().includes('malicious')
  ).length;

  const isMaliciousLog = (l) =>
    (l.type || '').toLowerCase().includes('malicious') ||
    (l.desc || '').toLowerCase().includes('malicious');

  const filteredLogs = logs.filter(l => {
    const matchesSeverity = filter === 'All'
      ? true
      : (filter === 'Malicious Scripts' ? isMaliciousLog(l) : l.severity === filter);
    const q = query.toLowerCase();
    const matchesQuery = !q
      || (l.user || '').toLowerCase().includes(q)
      || (l.type || '').toLowerCase().includes(q)
      || (l.desc || '').toLowerCase().includes(q);
    return matchesSeverity && matchesQuery;
  });

  const simulateTamper = () => {
    logSecurityEvent({
      user: 'Unknown / 192.168.99.1',
      type: 'Tamper Attempt',
      severity: 'High',
      desc: 'Blocked unauthorized access — possible SQL injection or privilege escalation attempt'
    });
    setTimeout(fetchLogs, 200);
  };

  const simulateMaliciousScript = () => {
    logSecurityEvent({
      user: 'Student Demo / Workspace',
      type: 'Malicious Script Attempt',
      severity: 'High',
      desc: 'Blocked malicious script execution attempt: [Rule: PROCESS_SPAWN] Restricted API: Process.Start is prohibited in Program.cs (Line 14:12)'
    });
    setTimeout(fetchLogs, 200);
  };

  const rowBg = isDark ? '#333' : '#f1f5f9';
  const headerBg = isDark ? '#374151' : '#a3aeb9';
  const headerColor = isDark ? '#f1f5f9' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';

  return (
    <div style={sh.pageWrap}>
      <div style={sh.statsGrid}>
        {[
          ['Total Events', isDark ? '#f1f5f9' : '#0f172a', total],
          ['Malicious Scripts', '#dc2626', maliciousCount],
          ['High Severity', '#ef4444', high],
          ['Warnings', '#f59e0b', warnings],
          ['Admin Actions', '#007bff', adminActions]
        ].map(([label, color, val]) => (
          <div key={label} style={sh.statCard}>
            <div style={sh.statLabel}>{label}</div>
            <div style={{ ...sh.statNum, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={sh.mainCard}>
        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={sh.cardTitle}>Live Security Audit Log</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: muted }}>Real-time record of system events & sandbox violations — auto-refreshes every 3 seconds</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ ...sh.searchPill, maxWidth: '200px' }}>
              <Search size={15} color={muted} />
              <input
                className="search-clean-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search logs..."
                style={sh.searchInput}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={simulateMaliciousScript}
              style={{ ...sh.addBlueBtn, backgroundColor: '#dc2626', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}
              title="Simulate blocked malicious code execution"
            >
              <ShieldAlert size={15} />
              <span>Simulate Malicious Script</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={simulateTamper}
              style={{ ...sh.addBlueBtn, backgroundColor: '#ea580c', boxShadow: '0 4px 12px rgba(234,88,12,0.3)' }}
            >
              <AlertCircle size={15} />
              <span>Simulate Tamper</span>
            </motion.button>
          </div>
        </div>

        {/* Malicious Script Warning Banner */}
        {maliciousCount > 0 && (
          <div style={{
            padding: '12px 18px',
            borderRadius: '14px',
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#fee2e2',
            border: '1px solid #f87171',
            color: isDark ? '#fca5a5' : '#b91c1c',
            fontSize: '0.84rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert size={20} color="#dc2626" style={{ flexShrink: 0 }} />
              <span>
                <strong>Security Warning:</strong> {maliciousCount} malicious script execution attempt(s) detected and blocked by the sandbox.
              </span>
            </div>
            {filter !== 'Malicious Scripts' && (
              <button
                onClick={() => setFilter('Malicious Scripts')}
                style={{
                  padding: '5px 14px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  fontSize: '0.76rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(220,38,38,0.3)'
                }}
              >
                View Malicious Logs
              </button>
            )}
          </div>
        )}

        {/* Filter + Count Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['All', 'High', 'Warning', 'Malicious Scripts', 'Normal'].map(f => (
              <motion.button
                key={f}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 16px', borderRadius: '9999px',
                  border: isDark ? '1px solid #4a5568' : '1px solid #cbd5e1',
                  cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700',
                  backgroundColor: filter === f 
                    ? (f === 'Malicious Scripts' ? '#dc2626' : (isDark ? '#f1f5f9' : '#0f172a')) 
                    : (isDark ? '#2a2a2a' : 'white'),
                  color: filter === f 
                    ? (f === 'Malicious Scripts' ? 'white' : (isDark ? '#0f172a' : 'white')) 
                    : (f === 'Malicious Scripts' ? '#ef4444' : (isDark ? '#cbd5e1' : '#334155'))
                }}
              >
                {f}
              </motion.button>
            ))}
          </div>
          <span style={{ fontSize: '0.78rem', color: muted, fontWeight: '600' }}>
            Showing {filteredLogs.length} of {total} events
          </span>
        </div>

        {/* Table */}
        <div style={sh.tableWrap}>
          <div style={{ backgroundColor: headerBg, borderRadius: '9999px', padding: density === 'Compact' ? '8px 20px' : '12px 20px', display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 2fr', alignItems: 'center', fontWeight: '700', color: headerColor, fontSize: density === 'Compact' ? '0.75rem' : '0.85rem', marginBottom: '8px' }}>
            <div>Timestamp</div><div>Performed By</div><div>Event Type</div><div>Severity</div><div>Description</div>
          </div>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: muted }}>
              {loading ? 'Loading security events...' : 'No events match the current filter.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: density === 'Compact' ? '4px' : '8px' }}>
              {filteredLogs.map((log, i) => {
                const isMalicious = isMaliciousLog(log);
                return (
                  <div key={log.id || i} style={{
                    backgroundColor: isMalicious 
                      ? (isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2') 
                      : rowBg,
                    border: isMalicious ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                    borderRadius: '9999px',
                    padding: density === 'Compact' ? '6px 24px' : '10px 24px',
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 2fr',
                    alignItems: 'center',
                    fontSize: density === 'Compact' ? '0.75rem' : '0.85rem'
                  }}>
                    <div style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                    </div>
                    <div style={{ fontWeight: '600', color: isMalicious ? (isDark ? '#f87171' : '#b91c1c') : (isDark ? '#f1f5f9' : '#1e293b') }}>
                      {log.user || 'System'}
                    </div>
                    <div>
                      {isMalicious ? (
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #f87171',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <ShieldAlert size={12} />
                          {log.type}
                        </span>
                      ) : (
                        <span style={{ color: isDark ? '#cbd5e1' : '#334155' }}>{log.type || 'Event'}</span>
                      )}
                    </div>
                    <div>
                      <span style={{
                        padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700',
                        backgroundColor: log.severity === 'High' ? '#fee2e2' : log.severity === 'Warning' ? '#fef3c7' : (isDark ? '#374151' : '#e2e8f0'),
                        color: log.severity === 'High' ? '#ef4444' : log.severity === 'Warning' ? '#d97706' : (isDark ? '#cbd5e1' : '#475569')
                      }}>
                        {log.severity || 'Normal'}
                      </span>
                    </div>
                    <div style={{ color: isMalicious ? (isDark ? '#fca5a5' : '#991b1b') : (isDark ? '#94a3b8' : '#64748b'), fontWeight: isMalicious ? '600' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.desc}>
                      {log.desc || '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}