import { Play, Square, ZoomIn, ZoomOut } from 'lucide-react';
import { MIN_FONT, MAX_FONT } from '../../data/compilerService';

export default function CompilerToolbar({
  runCode,
  handleStop,
  isRunning,
  fontSize,
  setFontSize,
  theme,
  isDark,
}) {
  return (
    <div
      style={{
        height: '60px',
        minHeight: '60px',
        flexShrink: 0,
        backgroundColor: theme.toolbarBg,
        borderBottom: theme.toolbarBdr,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
      }}
    >
      {/* Left group: Run + Stop */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          id="compiler-run-btn"
          onClick={runCode}
          disabled={isRunning}
          style={{
            padding: '8px 20px',
            backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : '#34d399',
            color: isDark ? '#34d399' : 'white',
            border: isDark ? '1px solid rgba(52,211,153,0.3)' : 'none',
            borderRadius: '5px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: isRunning ? 0.6 : 1,
            transition: 'all 0.15s',
          }}
        >
          <Play size={16} fill="currentColor" /> Run
        </button>

        <button
          id="compiler-stop-btn"
          onClick={handleStop}
          disabled={!isRunning}
          style={{
            padding: '8px 20px',
            backgroundColor: isDark ? 'rgba(248,113,113,0.15)' : '#f87171',
            color: isDark ? '#f87171' : 'white',
            border: isDark ? '1px solid rgba(248,113,113,0.3)' : 'none',
            borderRadius: '5px',
            cursor: isRunning ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: isRunning ? 1 : 0.5,
            transition: 'all 0.15s',
          }}
        >
          <Square size={14} fill="currentColor" /> Stop
        </button>
      </div>

      {/* Right group: Font size adjuster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            border: `1px solid ${theme.border}`,
            borderRadius: '6px',
            backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 1))}
            disabled={fontSize <= MIN_FONT}
            title="Decrease font size"
            style={{
              padding: '6px 10px',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: theme.textMuted,
              opacity: fontSize <= MIN_FONT ? 0.35 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ZoomOut size={14} />
          </button>
          <span
            style={{
              minWidth: '28px',
              textAlign: 'center',
              fontSize: '0.78rem',
              fontWeight: '700',
              color: theme.textMain,
              userSelect: 'none',
              borderLeft: `1px solid ${theme.border}`,
              borderRight: `1px solid ${theme.border}`,
              padding: '6px 2px',
            }}
          >
            {fontSize}
          </span>
          <button
            onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 1))}
            disabled={fontSize >= MAX_FONT}
            title="Increase font size"
            style={{
              padding: '6px 10px',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: theme.textMuted,
              opacity: fontSize >= MAX_FONT ? 0.35 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

