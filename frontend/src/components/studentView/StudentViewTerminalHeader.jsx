import {
  TerminalSquare,
  CheckSquare,
  Trash2,
  Plus,
  Play,
  PlayCircle,
  Minimize2,
  Maximize2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { studentViewStyles as styles } from '../../utils/studentViewStyles';

export default function StudentViewTerminalHeader({
  bottomTab,
  setBottomTab,
  isDark,
  submitted,
  isTerminalCollapsed,
  isTerminalMaximized,
  handleDividerMouseDown,
  toggleTerminalCollapse,
  toggleTerminalMaximize,
  testCases,
  passedTestsCount,
  hasTested,
  handleClearTerminal,
  handleAddTestCase,
  handleRunTestCase,
  handleRunAllTestCases,
  isRunningTests,
  isRunning
}) {
  return (
    <div
      onMouseDown={(e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        handleDividerMouseDown(e);
      }}
      onTouchStart={(e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        handleDividerMouseDown(e);
      }}
      onDoubleClick={toggleTerminalCollapse}
      style={{
        ...styles.terminalHeader,
        cursor: 'row-resize',
        ...(isDark ? { backgroundColor: '#262626', borderBottom: '1px solid #3c3c3c' } : {})
      }}
      title="Drag up or down to resize, double-click to toggle"
    >
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <button
          type="button"
          onClick={() => setBottomTab('terminal')}
          style={{
            ...styles.tabHeaderBtn,
            backgroundColor: bottomTab === 'terminal' ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
            color: bottomTab === 'terminal' ? (isDark ? '#10b981' : '#059669') : isDark ? '#9ca3af' : '#6b7280',
            borderBottom: bottomTab === 'terminal' ? '2px solid #10b981' : '2px solid transparent',
            fontWeight: bottomTab === 'terminal' ? '700' : '500'
          }}
        >
          <TerminalSquare size={15} />
          <span>TERMINAL</span>
        </button>

        <button
          type="button"
          onClick={() => setBottomTab('testcases')}
          style={{
            ...styles.tabHeaderBtn,
            backgroundColor: bottomTab === 'testcases' ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
            color: bottomTab === 'testcases' ? (isDark ? '#10b981' : '#059669') : isDark ? '#9ca3af' : '#6b7280',
            borderBottom: bottomTab === 'testcases' ? '2px solid #10b981' : '2px solid transparent',
            fontWeight: bottomTab === 'testcases' ? '700' : '500'
          }}
        >
          <CheckSquare size={15} />
          <span>TEST CASES</span>
          <span
            style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '10px',
              backgroundColor:
                hasTested && passedTestsCount === testCases.length && testCases.length > 0
                  ? '#10b981'
                  : testCases.some((t) => t.status === 'failed')
                  ? '#ef4444'
                  : isDark
                  ? '#374151'
                  : '#e5e7eb',
              color: hasTested || testCases.some((t) => t.status === 'failed') ? '#ffffff' : isDark ? '#d1d5db' : '#4b5563',
              fontWeight: 'bold',
              marginLeft: '4px'
            }}
          >
            {hasTested ? `${passedTestsCount}/${testCases.length}` : testCases.length}
          </span>
        </button>
      </div>

      {/* Action controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {bottomTab === 'terminal' ? (
          <button
            type="button"
            onClick={handleClearTerminal}
            style={{
              ...styles.terminalActionBtn,
              ...(isDark ? { backgroundColor: '#333333', borderColor: '#484848', color: '#E8EAED' } : {})
            }}
            title="Clear Terminal Output"
          >
            <Trash2 size={13} style={{ marginRight: '4px' }} />
            <span>Clear</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={handleAddTestCase}
              disabled={submitted}
              style={{
                ...styles.terminalActionBtn,
                backgroundColor: isDark ? '#1e1e1e' : '#f0fdf4',
                borderColor: isDark ? '#10b981' : '#bbf7d0',
                color: isDark ? '#10b981' : '#16a34a',
                fontWeight: '600',
                opacity: submitted ? 0.5 : 1,
                cursor: submitted ? 'not-allowed' : 'pointer'
              }}
              title={submitted ? 'Disabled after submission' : 'Add a new test case'}
            >
              <Plus size={13} style={{ marginRight: '3px' }} />
              <span>Add Test Case</span>
            </button>

            <button
              type="button"
              onClick={() => handleRunTestCase()}
              disabled={isRunningTests || isRunning || submitted}
              style={{
                ...styles.terminalActionBtn,
                backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : '#ecfdf5',
                borderColor: isDark ? 'rgba(52, 211, 153, 0.3)' : '#10b981',
                color: isDark ? '#34d399' : '#065f46',
                fontWeight: '600',
                opacity: isRunningTests || isRunning || submitted ? 0.45 : 1,
                cursor: isRunningTests || isRunning || submitted ? 'not-allowed' : 'pointer'
              }}
              title={submitted ? 'Disabled after submission' : 'Run selected test case'}
            >
              <Play size={11} fill="currentColor" style={{ marginRight: '4px' }} />
              <span>Run Case</span>
            </button>

            <button
              type="button"
              onClick={handleRunAllTestCases}
              disabled={isRunningTests || isRunning || submitted}
              style={{
                ...styles.terminalActionBtn,
                backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : '#10b981',
                borderColor: isDark ? 'rgba(52, 211, 153, 0.3)' : '#10b981',
                color: isDark ? '#34d399' : '#ffffff',
                fontWeight: '700',
                opacity: isRunningTests || isRunning || submitted ? 0.45 : 1,
                cursor: isRunningTests || isRunning || submitted ? 'not-allowed' : 'pointer'
              }}
              title={submitted ? 'Disabled after submission' : 'Run all test cases'}
            >
              <PlayCircle size={13} style={{ marginRight: '4px' }} />
              <span>Run All</span>
            </button>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            marginLeft: '6px',
            borderLeft: isDark ? '1px solid #3c3c3c' : '1px solid #e5e7eb',
            paddingLeft: '8px'
          }}
        >
          <button
            type="button"
            onClick={toggleTerminalMaximize}
            title={isTerminalMaximized ? 'Restore panel' : 'Maximize panel'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              color: isDark ? '#6b7280' : '#9ca3af'
            }}
          >
            {isTerminalMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            type="button"
            onClick={toggleTerminalCollapse}
            title={isTerminalCollapsed ? 'Show panel' : 'Hide panel'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              color: isDark ? '#6b7280' : '#9ca3af'
            }}
          >
            {isTerminalCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}
