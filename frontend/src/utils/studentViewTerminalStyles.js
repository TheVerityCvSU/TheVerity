export const studentViewTerminalStyles = {
  terminalWrapper: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #d1d5db',
    flexShrink: 0,
    minHeight: '100px',
    maxHeight: '75vh',
    overflow: 'hidden'
  },
  terminalHeader: {
    height: '36px',
    minHeight: '36px',
    padding: '0 14px',
    backgroundColor: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0
  },
  tabHeaderBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 14px',
    height: '36px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.82rem',
    letterSpacing: '0.04em',
    transition: 'all 0.15s ease',
    userSelect: 'none'
  },
  testButton: {
    padding: '8px 16px',
    border: '1px solid #10b981',
    color: '#059669',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s ease'
  },
  terminalActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    color: '#4b5563',
    fontSize: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  statusBadgeRunning: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '2px 8px',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '12px',
    color: '#059669',
    fontSize: '0.72rem',
    fontWeight: '600'
  },
  statusBadgeIdle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '2px 8px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    color: '#6b7280',
    fontSize: '0.72rem',
    fontWeight: '500'
  },
  statusDotRunning: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 4px #10b981'
  },
  statusDotIdle: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#9ca3af'
  },
  terminalBody: {
    flex: 1,
    padding: '12px 16px',
    overflowY: 'auto',
    fontFamily: "Consolas, 'Cascadia Code', 'Courier New', monospace",
    fontSize: '0.92rem',
    lineHeight: 1.5,
    color: '#111827',
    backgroundColor: '#ffffff',
    textAlign: 'left'
  },
  terminalInputRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '6px',
    backgroundColor: '#f9fafb',
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #e5e7eb'
  },
  terminalInput: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#111827',
    outline: 'none',
    width: '100%',
    fontFamily: "Consolas, 'Cascadia Code', 'Courier New', monospace",
    fontSize: '0.92rem'
  }
};
