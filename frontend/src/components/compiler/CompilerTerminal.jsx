import React from 'react';
import { TerminalSquare, CheckSquare, Trash2, PlayCircle, ZoomIn, ZoomOut } from 'lucide-react';
import CompilerOutputPane from './CompilerOutputPane';
import CompilerTestCasesPane from './CompilerTestCasesPane';

export default function CompilerTerminal({
  termH,
  termCollapsed,
  setTermCollapsed,
  isResizingTerminal,
  onDividerDown,
  bottomTab,
  setBottomTab,
  output = [],
  setOutput,
  isRunning,
  programStarted,
  inputValue,
  setInputValue,
  onSendInput,
  termEndRef,
  testCases = [],
  setTestCases,
  isRunningTests,
  hasTested,
  passedTestsCount = 0,
  handleRunAllTestCases,
  theme,
  isDark,
}) {
  return (
    <>
      {/* ══ RESIZE HANDLE ═══ */}
      <div
        onMouseDown={onDividerDown}
        onTouchStart={onDividerDown}
        style={{
          height: '10px',
          flexShrink: 0,
          zIndex: 15,
          cursor: 'row-resize',
          touchAction: 'none',
          backgroundColor: isResizingTerminal ? '#10b981' : isDark ? '#262626' : '#e5e7eb',
          borderTop: isResizingTerminal ? '1px solid #10b981' : `1px solid ${theme.handleBdr}`,
          borderBottom: isResizingTerminal ? '1px solid #10b981' : `1px solid ${theme.handleBdr}`,
          boxShadow: isResizingTerminal ? '0 0 10px rgba(16, 185, 129, 0.45)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        }}
        title="Drag up or down to resize terminal"
      >
        <div
          style={{
            width: '48px',
            height: '4px',
            borderRadius: '4px',
            backgroundColor: isResizingTerminal ? '#ffffff' : isDark ? '#555555' : '#9ca3af',
          }}
        />
      </div>

      {/* ══ TERMINAL DRAWER ══════ */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.termBg,
          borderTop: `1px solid ${theme.border}`,
          flexShrink: 0,
          overflow: 'hidden',
          height: termCollapsed ? '36px' : `${termH}px`,
          minHeight: termCollapsed ? '36px' : '60px',
          maxHeight: '85vh',
          transition: isResizingTerminal ? 'none' : 'height 0.15s ease',
        }}
      >
        {/* Terminal Header */}
        <div
          onMouseDown={(e) => {
            if (e.target.closest('button') || e.target.closest('input')) return;
            onDividerDown(e);
          }}
          onTouchStart={(e) => {
            if (e.target.closest('button') || e.target.closest('input')) return;
            onDividerDown(e);
          }}
          onDoubleClick={() => setTermCollapsed((p) => !p)}
          style={{
            height: '36px',
            minHeight: '36px',
            flexShrink: 0,
            backgroundColor: theme.termHdrBg,
            borderBottom: termCollapsed ? 'none' : theme.termHdrBdr,
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'row-resize',
            userSelect: 'none',
          }}
          title="Drag up or down to resize, double-click to toggle"
        >
          {/* Left: TABS */}
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <button
              onClick={() => {
                setBottomTab('terminal');
                setTermCollapsed(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 14px',
                height: '36px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: '700',
                letterSpacing: '0.04em',
                backgroundColor: bottomTab === 'terminal' && !termCollapsed ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
                color: bottomTab === 'terminal' && !termCollapsed ? (isDark ? '#10b981' : '#059669') : theme.textMuted,
                borderBottom: bottomTab === 'terminal' && !termCollapsed ? '2px solid #10b981' : '2px solid transparent',
                userSelect: 'none',
                transition: 'all 0.15s ease',
                marginLeft: '-14px',
              }}
            >
              <TerminalSquare size={15} />
              <span>TERMINAL</span>
            </button>
            <button
              onClick={() => {
                setBottomTab('testcases');
                setTermCollapsed(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 14px',
                height: '36px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: '700',
                letterSpacing: '0.04em',
                backgroundColor: bottomTab === 'testcases' && !termCollapsed ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
                color: bottomTab === 'testcases' && !termCollapsed ? (isDark ? '#10b981' : '#059669') : theme.textMuted,
                borderBottom: bottomTab === 'testcases' && !termCollapsed ? '2px solid #10b981' : '2px solid transparent',
                userSelect: 'none',
                transition: 'all 0.15s ease',
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
                  marginLeft: '4px',
                }}
              >
                {hasTested ? `${passedTestsCount}/${testCases.length}` : testCases.length}
              </span>
            </button>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {bottomTab === 'terminal' ? (
              <button
                onClick={() => setOutput([])}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '5px',
                  border: `1px solid ${theme.border}`,
                  background: isDark ? '#333' : '#fff',
                  color: theme.textMuted,
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={13} /> Clear
              </button>
            ) : (
              <button
                onClick={handleRunAllTestCases}
                disabled={isRunningTests || isRunning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '5px',
                  border: `1px solid ${isDark ? 'rgba(52, 211, 153, 0.3)' : '#10b981'}`,
                  backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : '#10b981',
                  color: isDark ? '#34d399' : '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: isRunningTests || isRunning ? 'not-allowed' : 'pointer',
                  opacity: isRunningTests || isRunning ? 0.6 : 1,
                }}
              >
                <PlayCircle size={13} /> Run All
              </button>
            )}
            <button
              onClick={() => setTermCollapsed((p) => !p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                border: 'none',
                background: 'transparent',
                color: theme.textMuted,
                cursor: 'pointer',
              }}
            >
              {termCollapsed ? <ZoomIn size={14} /> : <ZoomOut size={14} />}
            </button>
          </div>
        </div>

        {/* Body */}
        {!termCollapsed && (
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: theme.termBg }}>
            {bottomTab === 'terminal' ? (
              <CompilerOutputPane
                output={output}
                isRunning={isRunning}
                programStarted={programStarted}
                inputValue={inputValue}
                setInputValue={setInputValue}
                onSendInput={onSendInput}
                termEndRef={termEndRef}
                isDark={isDark}
              />
            ) : (
              <CompilerTestCasesPane
                testCases={testCases}
                setTestCases={setTestCases}
                theme={theme}
                isDark={isDark}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
