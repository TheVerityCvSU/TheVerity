import { ArrowLeft, Save, Play, Square, Check, AlertTriangle, Settings, Lock } from 'lucide-react';
import { studentViewStyles as styles } from '../../utils/studentViewStyles';

export default function StudentViewToolbar({
  isSandbox,
  isDark,
  isBackBlocked,
  submitted,
  saveStatus,
  isRunning,
  isRunningTests,
  strictCompiler,
  handleBackClick,
  handleSaveCode,
  handleRunCode,
  handleStopCode,
  handleSubmit,
  handleUnsubmit,
  setShowSettingsModal
}) {
  return (
    <div
      style={{
        ...styles.toolbar,
        ...(isDark ? { backgroundColor: '#262626', borderBottom: '1px solid #3c3c3c' } : {})
      }}
    >
      <div style={styles.toolGroupLeft}>
        <button
          onClick={handleBackClick}
          disabled={isBackBlocked}
          title={isBackBlocked ? 'Workspace exit is locked until submitted' : 'Back'}
          style={{
            ...styles.backButton,
            ...(isDark ? { backgroundColor: '#333333', borderColor: '#484848', color: '#E8EAED' } : {}),
            ...(isBackBlocked ? { opacity: 0.4, cursor: 'not-allowed' } : {})
          }}
        >
          {isBackBlocked ? <Lock size={15} /> : <ArrowLeft size={18} />} Back
        </button>

        <button
          onClick={handleSaveCode}
          disabled={submitted}
          style={{
            ...styles.iconButton,
            ...(isDark ? { backgroundColor: '#333333', borderColor: '#484848', color: '#E8EAED' } : {}),
            ...(submitted ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
            ...(saveStatus ? styles.iconButtonSaved : {})
          }}
          title={submitted ? 'Workspace is locked — saving is disabled' : 'Save draft (Ctrl+S)'}
        >
          {saveStatus ? (
            <>
              <Check size={18} color="#059669" />
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#059669', marginLeft: '4px' }}>
                Saved
              </span>
            </>
          ) : (
            <Save size={18} />
          )}
        </button>

        <button
          onClick={handleRunCode}
          disabled={isRunning || isRunningTests || submitted}
          style={{
            ...styles.runButton,
            ...(isDark
              ? { backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' }
              : {}),
            opacity: isRunning || isRunningTests || submitted ? 0.45 : 1,
            cursor: isRunning || isRunningTests || submitted ? 'not-allowed' : 'pointer'
          }}
          title={submitted ? 'Workspace is locked — execution is disabled' : 'Run code'}
        >
          <Play size={16} fill="currentColor" /> Run
        </button>

        <button
          onClick={handleStopCode}
          disabled={!isRunning || submitted}
          style={{
            ...styles.stopButton,
            ...(isDark
              ? { backgroundColor: 'rgba(248, 113, 113, 0.15)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)' }
              : {}),
            opacity: isRunning && !submitted ? 1 : 0.45,
            cursor: isRunning && !submitted ? 'pointer' : 'not-allowed'
          }}
        >
          <Square size={14} fill="currentColor" /> Stop
        </button>

        {strictCompiler && (
          <div
            style={{
              ...styles.strictBadge,
              ...(isDark
                ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' }
                : {})
            }}
            title="Strict Compiler Mode: Compiler warnings are treated as errors and will block execution."
          >
            <AlertTriangle size={13} style={{ marginRight: '5px', flexShrink: 0 }} />
            <span>Strict: Warnings = Errors</span>
          </div>
        )}
      </div>

      <div style={styles.toolGroupRight}>
        {!isSandbox &&
          (submitted ? (
            <button
              onClick={handleUnsubmit}
              style={{
                ...styles.unsubmitBtn,
                ...(isDark ? { backgroundColor: '#333333', borderColor: '#484848', color: '#E8EAED' } : {})
              }}
              title="Unsubmit to edit and re-submit your code"
            >
              Unsubmit
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              style={{
                ...styles.submitButton,
                ...(isDark
                  ? { backgroundColor: 'rgba(34, 211, 238, 0.15)', color: '#22d3ee', border: '1px solid rgba(34, 211, 238, 0.3)' }
                  : {})
              }}
            >
              Submit
            </button>
          ))}
        {!isSandbox && (
          <div
            className="recording-dot-blink"
            style={styles.recordingDot}
            title="Recording active: Your workspace activity is being recorded and proctored"
          />
        )}
        <button onClick={() => setShowSettingsModal(true)} style={styles.gearIcon} title="Settings">
          <Settings size={22} color={isDark ? '#d4d4d4' : '#6b7280'} />
        </button>
      </div>
    </div>
  );
}
