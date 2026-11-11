export const getStyles = (isDark, isMobile = false) => ({
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 0 20px 0',
    borderBottom: isDark ? '1px solid #2e2e2e' : '1px solid #e2e8f0',
    marginBottom: '24px'
  },
  list: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '16px' 
  },
  itemWrapper: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '8px' 
  },
  itemHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  detailCard: { 
    backgroundColor: isDark ? '#2E2E2E' : 'white', 
    borderRadius: '16px', 
    padding: '0', 
    border: isDark ? '1px solid #484848' : '1px solid #e2e8f0', 
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.04)', 
    overflow: 'hidden' 
  },
  detailHeaderBar: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '18px', 
    backgroundColor: isDark ? '#262626' : '#f8fafc', 
    padding: '18px 24px', 
    borderRadius: '12px', 
    margin: '12px', 
    border: isDark ? '1px solid #444444' : '1px solid #e2e8f0' 
  },
  detailTitle: { 
    fontSize: '1.25rem', 
    fontWeight: 'bold', 
    color: isDark ? '#E8EAED' : '#1e293b' 
  },
  detailBody: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    gap: '20px', 
    padding: '5px 28px 20px 28px' 
  },
  detailLeft: { 
    flex: 1 
  },
  postedText: { 
    fontSize: '0.8rem', 
    color: isDark ? '#737373' : '#94a3b8', 
    marginBottom: '8px' 
  },
  detailInstruction: { 
    margin: 0, 
    color: isDark ? '#E8EAED' : '#334155', 
    fontSize: '0.98rem', 
    lineHeight: 1.5 
  },
  cardAttachments: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', 
    gap: '12px', 
    marginTop: '15px', 
    width: '100%'
  },
  viewActivityLink: { 
    color: '#10b981', 
    fontSize: '0.92rem', 
    cursor: 'pointer', 
    fontWeight: '700' 
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(3px)'
  },
  infoModalContent: {
    backgroundColor: isDark ? '#222222' : '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    width: '90%',
    maxWidth: '440px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4)',
    border: isDark ? '1px solid #383838' : 'none',
    color: isDark ? '#E8EAED' : 'inherit'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    color: isDark ? '#a3a3a3' : '#64748b'
  },
  infoFieldLabel: {
    fontSize: '0.78rem',
    fontWeight: '700',
    color: isDark ? '#a3a3a3' : '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  infoFieldValue: {
    fontSize: '1rem',
    fontWeight: '600',
    color: isDark ? '#E8EAED' : '#1e293b',
    marginTop: '3px'
  },
  infoCloseActionBtn: {
    padding: '8px 22px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer'
  }
});
