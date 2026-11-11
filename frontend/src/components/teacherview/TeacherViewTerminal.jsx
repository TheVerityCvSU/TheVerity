import { Terminal as TerminalIcon, Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react';

export default function TeacherViewTerminal({
  terminalMode,
  setTerminalMode,
  evaluating,
  evalOutput,
  setEvalOutput,
  activeStudent,
  theme,
  isDark,
  isMobile
}) {
  if (terminalMode === 'collapsed') {
    return (
      <div
        onClick={() => setTerminalMode('normal')}
        style={{
          height: '32px',
          backgroundColor: theme.terminalHeader,
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          cursor: 'pointer',
          flexShrink: 0
        }}
        title="Click to expand terminal"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon size={14} color={theme.textMuted} />
          <span style={{ fontSize: '0.78rem', fontWeight: '600', color: theme.textSecondary }}>
            Terminal (Collapsed)
          </span>
        </div>
        <ChevronUp size={16} color={theme.textSecondary} />
      </div>
    );
  }

  return (
    <div
      style={{
        flex: terminalMode === 'maximized' ? 1 : 1,
        minHeight: terminalMode === 'maximized' ? '100%' : isMobile ? '140px' : '180px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.terminalBg,
        borderTop: `1px solid ${theme.border}`,
        overflow: 'hidden'
      }}
    >
      {/* Terminal Header */}
      <div
        style={{
          height: '36px',
          backgroundColor: theme.terminalHeader,
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon size={14} color={theme.accent} />
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: theme.textPrimary }}>
            Terminal Output
          </span>
          {evaluating && (
            <span
              style={{
                fontSize: '0.7rem',
                color: theme.accent,
                backgroundColor: theme.accentBg,
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: '600'
              }}
            >
              Running...
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {evalOutput && (
            <button
              onClick={() => setEvalOutput('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.textMuted,
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: '600',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
              title="Clear terminal output"
            >
              Clear
            </button>
          )}

          {/* Maximize / Restore */}
          <button
            onClick={() => setTerminalMode((prev) => (prev === 'maximized' ? 'normal' : 'maximized'))}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: theme.textSecondary,
              display: 'flex',
              alignItems: 'center'
            }}
            title={terminalMode === 'maximized' ? 'Restore height' : 'Maximize terminal'}
          >
            {terminalMode === 'maximized' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Minimize / Collapse */}
          <button
            onClick={() => setTerminalMode('collapsed')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: theme.textSecondary,
              display: 'flex',
              alignItems: 'center'
            }}
            title="Minimize terminal"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div
        style={{
          flex: 1,
          padding: '12px 16px',
          overflowY: 'auto',
          overflowX: 'auto',
          fontFamily: 'Consolas, "Fira Code", monospace',
          fontSize: '0.85rem',
          lineHeight: '1.45',
          color: isDark ? '#e4e4e7' : '#18181b',
          backgroundColor: isDark ? '#141416' : '#ffffff'
        }}
      >
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'inherit'
          }}
        >
          {evalOutput
            ? evalOutput
            : activeStudent.status === 'Submitted'
            ? 'Exam completed. Click "Run" in the toolbar to execute the submitted code.'
            : activeStudent.terminal || 'Monitoring student terminal activity in real-time...'}
        </pre>
      </div>
    </div>
  );
}
