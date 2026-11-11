import { studentViewTerminalStyles } from './studentViewTerminalStyles';

export const studentViewStyles = {
  container: {
    height: '100vh',
    width: '100%',
    display: 'flex',
    fontFamily: 'Arial, Helvetica, sans-serif',
    backgroundColor: '#e5e7eb',
    overflow: 'hidden'
  },
  leftSidebar: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #d1d5db',
    backgroundColor: '#f3f4f6',
    flexShrink: 0,
    minWidth: 0,
    overflow: 'hidden'
  },
  instructionSection: {
    flex: 1,
    minHeight: 0,
    padding: '20px',
    backgroundColor: '#f3f4f6',
    overflowY: 'auto'
  },
  instructionText: {
    color: '#1f2937',
    fontSize: '1rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    margin: 0
  },
  attachmentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '20px',
    width: '100%'
  },
  attachThumb: {
    maxWidth: '100%',
    maxHeight: '120px',
    borderRadius: '8px',
    objectFit: 'cover',
    display: 'block'
  },
  attachVideo: {
    maxWidth: '100%',
    maxHeight: '140px',
    borderRadius: '8px',
    backgroundColor: '#000'
  },
  attachLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#059669',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '8px 14px',
    textDecoration: 'none',
    fontSize: '0.88rem',
    fontWeight: '500',
    maxWidth: '100%',
    wordBreak: 'break-all',
    boxSizing: 'border-box'
  },
  greyPill: {
    height: '30px',
    backgroundColor: '#d1d5db',
    borderRadius: '50px',
    marginBottom: '15px',
    boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.1)'
  },
  warningSection: {
    backgroundColor: '#f9fafb',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden'
  },
  logContainer: {
    overflowY: 'auto',
    flex: 1,
    paddingRight: '5px'
  },
  logRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
    fontSize: '0.95rem'
  },
  mainArea: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  toolbar: {
    height: '60px',
    minHeight: '60px',
    backgroundColor: '#f9fafb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 20px',
    borderBottom: '1px solid #d1d5db',
    flexShrink: 0
  },
  toolGroupLeft: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '5px',
    cursor: 'pointer',
    color: '#4b5563',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  iconButton: {
    padding: '8px 12px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '5px',
    cursor: 'pointer',
    color: '#4b5563',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  },
  iconButtonSaved: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    color: '#059669'
  },
  runButton: {
    padding: '8px 20px',
    backgroundColor: '#34d399',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  stopButton: {
    padding: '8px 20px',
    backgroundColor: '#f87171',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  strictBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 11px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '5px',
    color: '#b45309',
    fontSize: '0.78rem',
    fontWeight: 'bold',
    userSelect: 'none'
  },
  toolGroupRight: {
    display: 'flex',
    gap: '15px',
    alignItems: 'center'
  },
  submitButton: {
    padding: '8px 20px',
    backgroundColor: '#22d3ee',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center'
  },
  unsubmitBtn: {
    padding: '8px 20px',
    backgroundColor: 'white',
    color: '#475569',
    border: '1px solid #d1d5db',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.15s ease'
  },
  recordingDot: {
    width: '12px',
    height: '12px',
    backgroundColor: '#dc2626',
    borderRadius: '50%',
    boxShadow: '0 0 8px rgba(220, 38, 38, 0.8)'
  },
  gearIcon: {
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center'
  },
  editorWrapper: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#1e1e1e',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column'
  },
  resizeHandle: {
    height: '6px',
    backgroundColor: '#e5e7eb',
    cursor: 'row-resize',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background-color 0.15s ease',
    borderTop: '1px solid #d1d5db',
    borderBottom: '1px solid #e5e7eb',
    userSelect: 'none'
  },
  resizeHandleGrip: {
    width: '36px',
    height: '2px',
    backgroundColor: '#9ca3af',
    borderRadius: '2px'
  },
  ...studentViewTerminalStyles
};
