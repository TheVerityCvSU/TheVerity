export const getModalStyles = (isDark) => ({
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
  },
  modalCard: {
    backgroundColor: isDark ? '#323232' : '#ffffff',
    border: isDark ? '1px solid #4A4A4A' : 'none',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '750px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.4)' : '0 20px 40px rgba(0,0,0,0.2)',
    overflow: 'hidden'
  },
  modalHeader: {
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0'
  },
  closeModalBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: isDark ? '#a3a3a3' : '#64748b',
    display: 'flex',
    alignItems: 'center'
  },
  modalCodeBody: {
    margin: 0,
    padding: '20px',
    backgroundColor: isDark ? '#141414' : '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    overflowY: 'auto',
    flex: 1
  },
  confirmModalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  confirmModalCard: {
    backgroundColor: isDark ? '#242424' : '#ffffff',
    color: isDark ? '#E8EAED' : '#1e293b',
    borderRadius: '18px',
    padding: '24px 28px',
    width: '90%',
    maxWidth: '460px',
    boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  }
});

