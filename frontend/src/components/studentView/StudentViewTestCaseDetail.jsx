import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import StudentViewTestCaseTabs from './StudentViewTestCaseTabs';

export default function StudentViewTestCaseDetail({
  testCases = [],
  activeTestCaseId,
  setActiveTestCaseId,
  handleAddTestCase,
  handleDeleteTestCase,
  handleUpdateTestCase,
  submitted,
  isDark
}) {
  const safeCases = Array.isArray(testCases) ? testCases : [];
  const activeCase = safeCases.find((tc) => tc.id === activeTestCaseId) || safeCases[0];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
        overflow: 'hidden',
        minHeight: 0
      }}
    >
      <StudentViewTestCaseTabs
        testCases={safeCases}
        activeTestCaseId={activeTestCaseId}
        setActiveTestCaseId={setActiveTestCaseId}
        handleAddTestCase={handleAddTestCase}
        handleDeleteTestCase={handleDeleteTestCase}
        isDark={isDark}
      />

      {/* Active Case Form & Details */}
      {activeCase && (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            padding: '12px 14px',
            overflowY: 'auto'
          }}
        >
          {/* Expected Output */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  color: isDark ? '#9ca3af' : '#4b5563',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Expected Output
              </label>
            </div>
            <textarea
              value={activeCase.expectedOutput || ''}
              onChange={(e) => handleUpdateTestCase(activeCase.id, 'expectedOutput', e.target.value)}
              disabled={submitted}
              placeholder={submitted ? 'Expected output (read only)' : 'Expected output from your code...'}
              style={{
                flex: 1,
                minHeight: '75px',
                padding: '8px 10px',
                backgroundColor: isDark ? '#242424' : '#f9fafb',
                color: isDark ? '#E8EAED' : '#111827',
                border: isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db',
                borderRadius: '6px',
                fontFamily: "Consolas, 'Cascadia Code', monospace",
                fontSize: '0.85rem',
                resize: 'none',
                outline: 'none',
                opacity: submitted ? 0.7 : 1,
                cursor: submitted ? 'not-allowed' : 'text'
              }}
            />
          </div>

          {/* Actual Output & Result Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  color: isDark ? '#9ca3af' : '#4b5563',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Actual Output
              </label>
              {activeCase.status === 'passed' && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <CheckCircle2 size={13} /> Passed
                </span>
              )}
              {activeCase.status === 'failed' && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <XCircle size={13} /> Failed
                </span>
              )}
              {activeCase.status === 'error' && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <AlertTriangle size={13} /> Error
                </span>
              )}
              {activeCase.status === 'running' && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Running...
                </span>
              )}
              {activeCase.status === 'idle' && (
                <span style={{ fontSize: '0.72rem', color: isDark ? '#6b7280' : '#9ca3af' }}>Not run yet</span>
              )}
            </div>
            <div
              style={{
                flex: 1,
                minHeight: '75px',
                padding: '8px 10px',
                backgroundColor:
                  activeCase.status === 'passed'
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.1)'
                      : '#f0fdf4'
                    : activeCase.status === 'failed'
                    ? isDark
                      ? 'rgba(239, 68, 68, 0.1)'
                      : '#fef2f2'
                    : isDark
                    ? '#242424'
                    : '#f9fafb',
                border:
                  activeCase.status === 'passed'
                    ? '1px solid #10b981'
                    : activeCase.status === 'failed'
                    ? '1px solid #ef4444'
                    : isDark
                    ? '1px solid #3c3c3c'
                    : '1px solid #d1d5db',
                borderRadius: '6px',
                fontFamily: "Consolas, 'Cascadia Code', monospace",
                fontSize: '0.85rem',
                color: activeCase.errorMessage ? '#ef4444' : isDark ? '#E8EAED' : '#111827',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {activeCase.status === 'running' ? (
                <span style={{ color: '#3b82f6', fontStyle: 'italic' }}>Executing test case...</span>
              ) : activeCase.errorMessage ? (
                <span style={{ color: '#ef4444' }}>{activeCase.errorMessage}</span>
              ) : activeCase.actualOutput ? (
                activeCase.actualOutput
              ) : (
                <span style={{ color: isDark ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>
                  {activeCase.status === 'passed'
                    ? '[Empty output produced]'
                    : 'Click "Run Case" or "Run All" to execute test.'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
