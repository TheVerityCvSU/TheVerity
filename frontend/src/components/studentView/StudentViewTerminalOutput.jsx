import { normalize } from '../../utils/studentViewUtils';
import { studentViewStyles as styles } from '../../utils/studentViewStyles';

export default function StudentViewTerminalOutput({
  output,
  isDark,
  isRunning,
  programStarted,
  inputValue,
  setInputValue,
  handleTerminalInput,
  submitted,
  copiedInternallyRef,
  addProctorLog,
  terminalBodyRef,
  terminalEndRef
}) {
  const renderFormattedOutput = (rawText) => {
    if (!rawText) return null;
    const lines = rawText.split('\n');
    return lines.map((line, idx) => {
      let color = isDark ? '#E8EAED' : '#1f2937';
      let fontWeight = 'normal';
      let fontStyle = 'normal';

      if (/error CS\d+/i.test(line) || /The build failed/i.test(line) || /\[Process terminated/i.test(line)) {
        color = isDark ? '#f87171' : '#dc2626';
        fontWeight = '600';
      } else if (/warning CS\d+/i.test(line)) {
        color = isDark ? '#fbbf24' : '#d97706';
        fontWeight = '600';
      } else if (/Initializing compiler environment/i.test(line) || /Compiling and running/i.test(line)) {
        color = isDark ? '#38bdf8' : '#0284c7';
      } else if (/\[Process exited with code 0\]/i.test(line)) {
        color = isDark ? '#34d399' : '#059669';
        fontWeight = '600';
      } else if (/\[Process exited with code/i.test(line)) {
        color = isDark ? '#f87171' : '#dc2626';
        fontWeight = '600';
      } else if (/\[Process stopped by user\]/i.test(line)) {
        color = isDark ? '#9ca3af' : '#6b7280';
        fontStyle = 'italic';
      }

      return (
        <div
          key={idx}
          style={{
            color,
            fontWeight,
            fontStyle,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            padding: '1px 0'
          }}
        >
          {line || '\u00A0'}
        </div>
      );
    });
  };

  return (
    <div
      ref={terminalBodyRef}
      style={{
        ...styles.terminalBody,
        ...(isDark ? { backgroundColor: '#1e1e1e', color: '#E8EAED' } : {})
      }}
    >
      {renderFormattedOutput(output)}
      {isRunning && programStarted && (
        <div
          style={{
            ...styles.terminalInputRow,
            ...(isDark ? { backgroundColor: '#252525', borderColor: '#3c3c3c' } : {})
          }}
        >
          <span style={{ marginRight: '8px', color: submitted ? '#9ca3af' : '#10b981', fontWeight: 'bold' }}>
            {'>'}
          </span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleTerminalInput}
            onPaste={(e) => {
              const pasted = e.clipboardData?.getData('text/plain') || '';
              const key = normalize(pasted);
              if (key && copiedInternallyRef?.current && !copiedInternallyRef.current.has(key)) {
                e.preventDefault();
                e.stopPropagation();
                addProctorLog('Strict Clipboard: External Paste in Terminal Blocked', '#ef4444');
                if (window.electronAPI?.clearClipboard) {
                  window.electronAPI.clearClipboard().catch(() => { });
                }
              }
            }}
            autoFocus={!submitted}
            disabled={submitted}
            style={{
              ...styles.terminalInput,
              ...(isDark ? { color: '#E8EAED' } : {}),
              ...(submitted ? { opacity: 0.6, cursor: 'not-allowed' } : {})
            }}
            placeholder={
              submitted ? 'Workspace is locked — execution is disabled' : 'Type input here and press Enter...'
            }
          />
        </div>
      )}
      <div ref={terminalEndRef} />
    </div>
  );
}
