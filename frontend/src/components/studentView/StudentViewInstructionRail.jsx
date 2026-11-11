import { ChevronDown, PanelLeft } from 'lucide-react';

export default function StudentViewInstructionRail({
  isMobile,
  isDark,
  proctorLogsLength,
  onExpand
}) {
  return (
    <div
      style={{
        width: isMobile ? '100%' : '44px',
        height: isMobile ? '44px' : '100%',
        backgroundColor: isDark ? '#252525' : '#f1f5f9',
        borderRight: isMobile ? 'none' : isDark ? '1px solid #3c3c3c' : '1px solid #cbd5e1',
        borderBottom: isMobile ? (isDark ? '1px solid #3c3c3c' : '1px solid #cbd5e1') : 'none',
        display: 'flex',
        flexDirection: isMobile ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: isMobile ? '0 12px' : '14px 0',
        gap: '12px',
        flexShrink: 0,
        transition: 'width 0.2s ease, height 0.2s ease',
        zIndex: 5
      }}
    >
      <button
        onClick={onExpand}
        style={{
          background: 'transparent',
          border: isDark ? '1px solid #484848' : '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '6px',
          cursor: 'pointer',
          color: isDark ? '#10b981' : '#059669',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? '#333333' : '#ffffff',
          transition: 'all 0.15s ease'
        }}
        title="Expand Instructions (Ctrl+B)"
      >
        {isMobile ? <ChevronDown size={16} /> : <PanelLeft size={16} />}
      </button>
      {!isMobile && (
        <div
          onClick={onExpand}
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            color: isDark ? '#9ca3af' : '#64748b',
            fontWeight: '600',
            fontSize: '0.82rem',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            userSelect: 'none',
            marginTop: '10px'
          }}
          title="Click to expand instruction panel"
        >
          INSTRUCTIONS
        </div>
      )}
      {isMobile && (
        <span
          onClick={onExpand}
          style={{
            fontSize: '0.85rem',
            fontWeight: '600',
            color: isDark ? '#9ca3af' : '#64748b',
            cursor: 'pointer'
          }}
        >
          Show Instructions
        </span>
      )}
      {proctorLogsLength > 0 && (
        <div
          style={{
            marginTop: isMobile ? '0' : 'auto',
            marginLeft: isMobile ? 'auto' : '0',
            marginBottom: isMobile ? '0' : '12px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#eab308'
          }}
          title={`${proctorLogsLength} warning(s)`}
        />
      )}
    </div>
  );
}
