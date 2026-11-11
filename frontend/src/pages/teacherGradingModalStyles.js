export const getModalStyles = (isDark) => ({
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  codeModalCard: {
    backgroundColor: isDark ? '#202020' : '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '850px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
    border: isDark ? '1px solid #3d3d3d' : 'none',
    overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 22px',
    borderBottom: isDark ? '1px solid #333333' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#262626' : '#ffffff'
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: '800',
    color: isDark ? '#f8fafc' : '#0f172a'
  },
  modalCopyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#2e2e2e' : '#f8fafc',
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontSize: '0.8rem',
    fontWeight: '700',
    cursor: 'pointer'
  },
  closeModalBtn: {
    background: 'none',
    border: 'none',
    color: isDark ? '#94a3b8' : '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '4px'
  },
  modalCodeBody: {
    flex: 1,
    margin: 0,
    padding: '24px',
    backgroundColor: isDark ? '#141414' : '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: '"Fira Code", Menlo, Monaco, Consolas, monospace',
    fontSize: '0.88rem',
    lineHeight: 1.6,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  bulkModalCard: {
    backgroundColor: isDark ? '#242424' : '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
    border: isDark ? '1px solid #3d3d3d' : 'none',
    overflow: 'hidden'
  },
  cancelModalBtn: {
    padding: '9px 18px',
    borderRadius: '8px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#2e2e2e' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#475569',
    fontSize: '0.86rem',
    fontWeight: '700',
    cursor: 'pointer'
  },
  applyBulkBtn: {
    padding: '9px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: '0.86rem',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
  }
});
