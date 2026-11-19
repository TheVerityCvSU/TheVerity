export const getModalStyles = (isDark) => ({
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDark ? 'rgba(17, 17, 17, 0.75)' : 'rgba(235, 235, 235, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
    padding: '20px'
  },
  modalCard: {
    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
    border: isDark ? '1px solid #2C2C2E' : '1px solid #E5E7EB',
    borderRadius: '20px',
    width: '90%',
    maxWidth: '750px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 20px 40px -10px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    textAlign: 'left'
  },
  modalHeader: {
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: isDark ? '1px solid #2C2C2E' : '1px solid #E5E7EB',
    textAlign: 'left'
  },
  closeModalBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: isDark ? '#9CA3AF' : '#64748B',
    display: 'flex',
    alignItems: 'center',
    padding: '6px',
    borderRadius: '8px'
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
    backgroundColor: isDark ? 'rgba(17, 17, 17, 0.75)' : 'rgba(235, 235, 235, 0.75)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  confirmModalCard: {
    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
    color: isDark ? '#F9FAFB' : '#111827',
    borderRadius: '24px',
    padding: '28px',
    width: '90%',
    maxWidth: '460px',
    textAlign: 'left',
    boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 20px 40px -10px rgba(0, 0, 0, 0.12)',
    border: isDark ? '1px solid #2C2C2E' : '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    position: 'relative'
  }
});
