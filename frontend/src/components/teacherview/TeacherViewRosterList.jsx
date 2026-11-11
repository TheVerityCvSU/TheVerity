import { AlertTriangle } from 'lucide-react';

export default function TeacherViewRosterList({
  visibleStudents,
  studentSearch,
  mode,
  selectedStudentId,
  setSelectedStudentId,
  activeStudent,
  allLogs,
  theme,
  isDark,
  isCompact,
  setSidebarOpen
}) {
  if (visibleStudents.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '30px 15px',
          color: theme.textMuted,
          fontSize: '0.85rem'
        }}
      >
        {studentSearch
          ? 'No matching students found'
          : mode === 'live'
          ? 'No students currently active in live workspace. Students will appear here when they start coding.'
          : 'No submitted student recordings yet.'}
      </div>
    );
  }

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
      {visibleStudents.map((student) => {
        const sId = String(student.id || student.studentId || '');
        const sName = String(student.name || student.studentName || sId || 'Student');
        const isActive = sId === selectedStudentId || sName === selectedStudentId || activeStudent?.id === sId || activeStudent?.name === sName;
        const isStudentLive = student.isLive !== false && student.status === 'Live';
        const studentLogCount = allLogs.filter(
          (l) => l.studentId === sId || l.studentName === sName || l.studentId === sName || l.studentName === sId
        ).length;

        return (
          <div
            key={sId || sName}
            onClick={() => {
              setSelectedStudentId(sId || sName);
              if (isCompact) setSidebarOpen(false);
            }}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              backgroundColor: isActive ? theme.activePill : theme.inactivePill,
              border: `1px solid ${isActive ? theme.accent : theme.borderSubtle}`,
              boxShadow: isActive ? (isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.06)') : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? theme.accent : isDark ? '#4b5563' : '#cbd5e1',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                  flexShrink: 0
                }}
              >
                {((sName || 'S')[0] || 'S').toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: isActive ? '700' : '600',
                    color: theme.textPrimary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {sName}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color:
                      student.status === 'Graded'
                        ? '#3b82f6'
                        : student.status === 'Submitted'
                        ? '#10b981'
                        : isStudentLive
                        ? '#10b981'
                        : '#9ca3af',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {isStudentLive ? (
                    <>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                      Live
                    </>
                  ) : student.status === 'Submitted' ? (
                    'Submitted'
                  ) : student.status === 'Graded' ? (
                    'Graded'
                  ) : (
                    <>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                      Offline
                    </>
                  )}
                </span>
              </div>
            </div>

            {studentLogCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  padding: '2px 7px',
                  borderRadius: '9999px',
                  flexShrink: 0
                }}
                title={`${studentLogCount} warnings recorded`}
              >
                <AlertTriangle size={11} color="#ef4444" />
                <span>{studentLogCount}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
