import React from 'react';
import { Plus } from 'lucide-react';

export default function CompilerTestCasesPane({
  testCases = [],
  setTestCases,
  theme,
  isDark,
}) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {testCases.map((tc) => (
        <div
          key={tc.id}
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            backgroundColor: isDark ? '#262626' : '#f9fafb',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ color: theme.textMain, fontSize: '0.9rem' }}>{tc.name}</strong>
            {tc.status === 'passed' && (
              <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem' }}>Passed</span>
            )}
            {tc.status === 'failed' && (
              <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.8rem' }}>Failed</span>
            )}
            {tc.status === 'running' && (
              <span style={{ color: '#3b82f6', fontStyle: 'italic', fontSize: '0.8rem' }}>Running...</span>
            )}
            {tc.status === 'error' && (
              <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.8rem' }}>Error</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: theme.textMuted, marginBottom: '4px' }}>Input</div>
              <input
                type="text"
                value={tc.input}
                onChange={(e) =>
                  setTestCases((prev) =>
                    prev.map((t) => (t.id === tc.id ? { ...t, input: e.target.value } : t))
                  )
                }
                style={{
                  width: '100%',
                  padding: '6px',
                  borderRadius: '4px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.editorBg,
                  color: theme.textMain,
                  fontSize: '0.8rem',
                }}
                placeholder="e.g. 5 10"
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: theme.textMuted, marginBottom: '4px' }}>
                Expected Output
              </div>
              <input
                type="text"
                value={tc.expectedOutput}
                onChange={(e) =>
                  setTestCases((prev) =>
                    prev.map((t) => (t.id === tc.id ? { ...t, expectedOutput: e.target.value } : t))
                  )
                }
                style={{
                  width: '100%',
                  padding: '6px',
                  borderRadius: '4px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.editorBg,
                  color: theme.textMain,
                  fontSize: '0.8rem',
                }}
                placeholder="Expected result"
              />
            </div>
          </div>
          {(tc.status === 'failed' || tc.status === 'error') && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px',
                borderRadius: '4px',
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.2)' : '#fecaca'}`,
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold', marginBottom: '4px' }}>
                Actual Output:
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: '0.8rem',
                  color: isDark ? '#fca5a5' : '#b91c1c',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                }}
              >
                {tc.actualOutput || tc.errorMessage || 'No output'}
              </pre>
            </div>
          )}
        </div>
      ))}
      <button
        onClick={() =>
          setTestCases((prev) => [
            ...prev,
            { id: Date.now(), name: `Test ${prev.length + 1}`, input: '', expectedOutput: '', isHidden: false },
          ])
        }
        style={{
          padding: '8px',
          borderRadius: '6px',
          border: `1px dashed ${theme.border}`,
          backgroundColor: 'transparent',
          color: theme.textMuted,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '0.85rem',
          fontWeight: '600',
        }}
      >
        <Plus size={14} /> Add Test Case
      </button>
    </div>
  );
}

