import React from 'react';

export default function CompilerOutputPane({
  output = [],
  isRunning,
  programStarted,
  inputValue,
  setInputValue,
  onSendInput,
  termEndRef,
  isDark,
}) {
  return (
    <div
      style={{
        padding: '10px 16px',
        fontFamily: '"Consolas", "Courier New", monospace',
        fontSize: '0.82rem',
        lineHeight: '1.7',
      }}
    >
      {output.length === 0 ? (
        <span style={{ color: isDark ? '#555' : '#9ca3af', fontStyle: 'italic' }}>
          Press Run to compile and execute your C# code…
        </span>
      ) : (
        output.map((line, i) => (
          <div
            key={i}
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color:
                line.type === 'err'
                  ? '#f87171'
                  : line.type === 'info'
                  ? isDark
                    ? '#6b7280'
                    : '#9ca3af'
                  : line.type === 'exit-ok'
                  ? isDark
                    ? '#6b7280'
                    : '#9ca3af'
                  : line.type === 'exit-err'
                  ? '#f87171'
                  : isDark
                  ? '#d4d4d4'
                  : '#1e1e1e',
              fontStyle: line.type === 'info' ? 'italic' : 'normal',
            }}
          >
            {line.text}
          </div>
        ))
      )}
      {isRunning && programStarted && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: '8px',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: isDark ? '#252525' : '#f3f4f6',
            border: isDark ? '1px solid #3c3c3c' : '1px solid #e5e7eb',
          }}
        >
          <span style={{ marginRight: '8px', color: '#10b981', fontWeight: 'bold' }}>{'>'}</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSendInput(inputValue);
                setInputValue('');
              }
            }}
            autoFocus
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: isDark ? '#E8EAED' : '#111827',
              fontFamily: '"Consolas", "Courier New", monospace',
              fontSize: '0.82rem',
            }}
            placeholder="Type input here and press Enter..."
          />
        </div>
      )}
      <div ref={termEndRef} />
    </div>
  );
}

