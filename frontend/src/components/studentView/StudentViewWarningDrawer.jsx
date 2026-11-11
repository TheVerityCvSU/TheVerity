import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';
import { studentViewStyles as styles } from '../../utils/studentViewStyles';

export default function StudentViewWarningDrawer({
  isDark,
  proctorLogs,
  warningHeight,
  isWarningCollapsed,
  setIsWarningCollapsed,
  isWarningMaximized,
  toggleWarningMaximize,
  isResizingWarning
}) {
  return (
    <div
      style={{
        ...styles.warningSection,
        height: isWarningCollapsed ? '42px' : isWarningMaximized ? '100%' : `${warningHeight}px`,
        minHeight: isWarningCollapsed ? '42px' : '70px',
        maxHeight: isWarningCollapsed ? '42px' : isWarningMaximized ? '100%' : '450px',
        padding: isWarningCollapsed ? '10px 18px' : '14px 18px',
        ...(isDark ? { backgroundColor: '#222222' } : {}),
        transition: isResizingWarning ? 'none' : 'height 0.2s ease'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isWarningCollapsed ? 0 : '10px'
        }}
      >
        <div
          onClick={() => setIsWarningCollapsed((prev) => !prev)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}
          title={isWarningCollapsed ? 'Expand warnings' : 'Collapse warnings'}
        >
          <span style={{ fontSize: '0.95rem', color: isDark ? '#E8EAED' : '#1f2937', fontWeight: 'bold' }}>
            Warnings
          </span>
          {proctorLogs.length > 0 && (
            <span
              style={{
                fontSize: '0.72rem',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: '#eab308',
                color: '#000',
                fontWeight: 'bold'
              }}
            >
              {proctorLogs.length}
            </span>
          )}
          {isWarningCollapsed ? (
            <ChevronDown size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
          ) : (
            <ChevronUp size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {!isWarningCollapsed && (
            <span style={{ fontSize: '0.85rem', color: isDark ? '#9ca3af' : '#6b7280', fontWeight: '600' }}>
              Time
            </span>
          )}
          <button
            onClick={toggleWarningMaximize}
            title={isWarningMaximized ? 'Restore' : 'Maximize warnings'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '3px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              color: isDark ? '#6b7280' : '#9ca3af'
            }}
          >
            {isWarningMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>
      {!isWarningCollapsed && (
        <div style={styles.logContainer}>
          {proctorLogs.length === 0 ? (
            <span style={{ color: isDark ? '#888888' : '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem' }}>
              Monitoring active...
            </span>
          ) : (
            proctorLogs.map((log) => {
              const isCrash = Boolean(
                log.isCrash ||
                  (log.action && log.action.toLowerCase().includes('crash')) ||
                  (log.message && log.message.toLowerCase().includes('crash'))
              );
              const text = isCrash ? 'System Crash' : log.message;
              const textColor = isCrash ? '#dc2626' : log.color || '#ef4444';
              return (
                <div key={log.id} style={{ ...styles.logRow, fontSize: '0.88rem', marginBottom: '8px' }}>
                  <span
                    style={{
                      color: textColor,
                      fontWeight: 'bold',
                      paddingRight: '12px',
                      flex: 1,
                      minWidth: 0,
                      wordBreak: 'break-word'
                    }}
                  >
                    {text}
                  </span>
                  <span
                    style={{
                      color: isDark ? '#a3a3a3' : '#6b7280',
                      background: 'none',
                      backgroundColor: 'transparent',
                      flexShrink: 0,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {log.time}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
