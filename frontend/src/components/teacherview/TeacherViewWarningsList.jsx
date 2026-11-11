export default function TeacherViewWarningsList({
  allLogs,
  studentSearch,
  students,
  setSelectedStudentId,
  theme,
  isCompact,
  setSidebarOpen
}) {
  if (allLogs.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '30px 15px',
          color: theme.textMuted,
          fontSize: '0.85rem',
          fontStyle: 'italic'
        }}
      >
        No violations or warnings recorded.
      </div>
    );
  }

  const filteredLogs = allLogs.filter((log) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      (log.studentName || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      {filteredLogs.map((log, idx) => (
        <div
          key={`${log.id || 'log'}-${idx}`}
          onClick={() => {
            const matched = Object.values(students).find(
              (s) =>
                s.isLive !== false &&
                s.status !== 'Offline' &&
                (s.id === log.studentId ||
                  s.name === log.studentName ||
                  s.id === log.studentName ||
                  s.name === log.studentId)
            );
            if (matched) setSelectedStudentId(matched.id || matched.name);
            if (isCompact) setSidebarOpen(false);
          }}
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: theme.textPrimary }}>
              {log.studentName}
            </span>
            <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>{log.time}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: log.color || '#ef4444'
              }}
            />
            <span style={{ fontSize: '0.78rem', color: log.color || '#ef4444', fontWeight: '600' }}>
              {log.action}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
