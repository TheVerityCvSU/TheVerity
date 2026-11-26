import { ArrowLeft, Play, Square, Settings, PlayCircle } from 'lucide-react';

export default function TeacherViewHeader({
  onBack,
  onLogout,
  isMobile,
  isDark,
  theme,
  assignment,
  classroom,
  mode,
  activeStudent,
  displayCode,
  evaluating,
  handleEvaluate,
  handleStopCode,
  setShowGradeModal,
  setShowSettingsModal
}) {
  const isStudentCompleted = activeStudent?.status === 'Submitted' || activeStudent?.status === 'Graded';
  const canRunCode = isStudentCompleted || (mode === 'playback' && Boolean(displayCode && String(displayCode).trim()));
  const isStudentLive = activeStudent?.isLive !== false && activeStudent?.status === 'Live';

  return (
    <header
      style={{
        height: isMobile ? '56px' : '62px',
        backgroundColor: theme.headerBg,
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 12px' : '0 20px',
        flexShrink: 0,
        zIndex: 40,
        gap: '12px'
      }}
    >
      {/* Left Section: Back button and Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px', minWidth: 0 }}>
        <button
          onClick={onBack || onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: isMobile ? '6px 8px' : '6px 12px',
            backgroundColor: isDark ? '#3f3f46' : '#e2e8f0',
            border: 'none',
            borderRadius: '8px',
            color: theme.textPrimary,
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.85rem',
            transition: 'background-color 0.15s ease'
          }}
          title="Return to previous screen"
        >
          <ArrowLeft size={16} />
          {!isMobile && <span>Back</span>}
        </button>

        {/* Breadcrumb info */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span
              style={{
                fontSize: isMobile ? '0.85rem' : '1rem',
                fontWeight: '700',
                color: theme.textPrimary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {assignment?.title || (mode === 'live' ? 'Live Proctoring Session' : 'Replay & Submissions')}
            </span>

            {/* Status Indicator */}
            {mode === 'live' ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  letterSpacing: '0.04em',
                  flexShrink: 0
                }}
              >
                <span
                  className="recording-dot-blink"
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444'
                  }}
                />
                LIVE MONITORING
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: isDark ? '#18181b' : '#f1f5f9',
                  border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0',
                  color: isDark ? '#f4f4f5' : '#0f172a',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  letterSpacing: '0.04em',
                  flexShrink: 0
                }}
              >
                <PlayCircle size={12} />
                VCR REPLAY
              </span>
            )}
          </div>

          {classroom?.name && !isMobile && (
            <span
              style={{
                fontSize: '0.75rem',
                color: theme.textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {classroom.name}
            </span>
          )}
        </div>
      </div>

      {/* Center Section: Active Student Name Badge */}
      {!isMobile && activeStudent && activeStudent.name !== 'Waiting for students...' && activeStudent.name !== 'Select a student submission' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            backgroundColor: isDark ? '#202023' : '#f8fafc',
            border: `1px solid ${theme.border}`,
            borderRadius: '9999px',
            maxWidth: '320px',
            minWidth: 0
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: isStudentLive ? theme.accent : isDark ? '#4b5563' : '#94a3b8',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: '700',
              flexShrink: 0
            }}
          >
            {((activeStudent.name || activeStudent.studentName || activeStudent.id || 'S')[0] || 'S').toUpperCase()}
          </div>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: '600',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: theme.textPrimary
            }}
          >
            {activeStudent.name || activeStudent.studentName || activeStudent.id || 'Student'}
          </span>
        </div>
      )}

      {/* Right Section: Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px' }}>
        {canRunCode && (
          <>
            <button
              onClick={handleEvaluate}
              disabled={evaluating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: isMobile ? '6px 10px' : '7px 14px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: evaluating ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.82rem',
                opacity: evaluating ? 0.7 : 1,
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
              }}
              title="Run & Evaluate Code"
            >
              <Play size={14} fill="currentColor" />
              {!isMobile && <span>Run</span>}
            </button>

            <button
              onClick={handleStopCode}
              disabled={!evaluating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: isMobile ? '6px 8px' : '7px 12px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: evaluating ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '0.82rem',
                opacity: evaluating ? 1 : 0.4
              }}
              title="Stop Execution"
            >
              <Square size={12} fill="currentColor" />
              {!isMobile && <span>Stop</span>}
            </button>
          </>
        )}

        {isStudentCompleted && (
          <button
            onClick={() => setShowGradeModal(true)}
            style={{
              padding: isMobile ? '6px 10px' : '7px 14px',
              backgroundColor: isDark ? '#3b82f6' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.82rem',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
            }}
            title="Grade or update student grade"
          >
            {activeStudent.status === 'Graded' ? 'Grade: Done' : 'Grade'}
          </button>
        )}

        {/* Settings Button */}
        <button
          onClick={() => setShowSettingsModal(true)}
          style={{
            background: 'transparent',
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            padding: isMobile ? '6px' : '7px 9px',
            cursor: 'pointer',
            color: theme.textSecondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Appearance and Editor Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
