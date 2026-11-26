export const getStyles = (isDark) => ({
  container: {
    height: '100dvh',
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isDark ? '#3C3C3C' : '#EEF0F3',
    color: isDark ? '#E8EAED' : 'inherit',
    fontFamily: 'Arial, Helvetica, sans-serif',
    position: 'relative',
    overflow: 'hidden'
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: isDark ? '#E8EAED' : '#64748b',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '4px 0',
    transition: 'color 0.15s'
  },
  instructionText: {
    margin: 0,
    color: isDark ? '#E8EAED' : '#1f2937',
    fontSize: '1rem',
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap'
  },
  cardAttachments: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '12px',
    marginTop: '20px',
    width: '100%'
  },
  submissionBox: {
    backgroundColor: isDark ? '#15171c' : '#c4c8cd',
    border: isDark ? '1px solid #262932' : 'none',
    borderRadius: '24px',
    padding: '18px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: '48px'
  },
  viewCodeBtn: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: isDark ? '#262932' : 'rgba(255,255,255,0.9)',
    color: isDark ? '#E8EAED' : '#1e293b',
    border: isDark ? '1px solid #3c404d' : '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: isDark 
      ? '0 0 10px rgba(255, 255, 255, 0.04), 0 1px 4px rgba(0, 0, 0, 0.3)' 
      : '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.03)',
    transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  feedbackHeading: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: isDark ? '#E8EAED' : '#1e293b',
    marginTop: '22px',
    marginBottom: '10px',
    paddingLeft: '4px'
  },
  feedbackBox: {
    backgroundColor: isDark ? '#282828' : '#c4c8cd',
    border: isDark ? '1px solid #3E3E3E' : 'none',
    borderRadius: '24px',
    padding: '22px 28px',
    minHeight: '60px',
    display: 'flex',
    alignItems: 'center'
  },
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
  }
});
