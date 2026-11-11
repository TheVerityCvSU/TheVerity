import { CheckCircle2, XCircle, AlertTriangle, Loader2, Plus, X } from 'lucide-react';

export default function StudentViewTestCaseTabs({
  testCases = [],
  activeTestCaseId,
  setActiveTestCaseId,
  handleAddTestCase,
  handleDeleteTestCase,
  isDark
}) {
  const safeCases = Array.isArray(testCases) ? testCases : [];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        borderBottom: isDark ? '1px solid #2e2e2e' : '1px solid #e5e7eb',
        backgroundColor: isDark ? '#222222' : '#f9fafb',
        gap: '6px',
        overflowX: 'auto',
        flexShrink: 0
      }}
    >
      {safeCases.map((tc, idx) => {
        const isActive = tc.id === activeTestCaseId;
        return (
          <button
            key={tc.id}
            type="button"
            onClick={() => setActiveTestCaseId(tc.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              border: isActive
                ? isDark
                  ? '1px solid #10b981'
                  : '1px solid #059669'
                : isDark
                ? '1px solid #383838'
                : '1px solid #d1d5db',
              backgroundColor: isActive
                ? isDark
                  ? '#064e3b'
                  : '#ecfdf5'
                : isDark
                ? '#2a2a2a'
                : '#ffffff',
              color: isActive ? (isDark ? '#6ee7b7' : '#065f46') : isDark ? '#d1d5db' : '#4b5563',
              fontSize: '0.8rem',
              fontWeight: isActive ? '700' : '500',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {tc.status === 'running' && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            {tc.status === 'passed' && <CheckCircle2 size={13} color="#10b981" />}
            {tc.status === 'failed' && <XCircle size={13} color="#ef4444" />}
            {tc.status === 'error' && <AlertTriangle size={13} color="#f59e0b" />}
            {tc.status === 'idle' && (
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: isDark ? '#6b7280' : '#9ca3af'
                }}
              />
            )}
            <span>{tc.name || `Case ${idx + 1}`}</span>

            {safeCases.length > 1 && (
              <span
                onClick={(e) => {
                  if (typeof handleDeleteTestCase === 'function') handleDeleteTestCase(tc.id, e);
                }}
                title="Delete this test case"
                style={{
                  marginLeft: '4px',
                  color: isDark ? '#9ca3af' : '#9ca3af',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '3px',
                  padding: '1px'
                }}
              >
                <X size={12} />
              </span>
            )}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => {
          if (typeof handleAddTestCase === 'function') handleAddTestCase();
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          borderRadius: '6px',
          border: isDark ? '1px dashed #4b5563' : '1px dashed #9ca3af',
          backgroundColor: 'transparent',
          color: isDark ? '#9ca3af' : '#6b7280',
          fontSize: '0.8rem',
          fontWeight: '500',
          cursor: 'pointer'
        }}
        title="Add a new test case"
      >
        <Plus size={13} />
        <span>Add Case</span>
      </button>
    </div>
  );
}
