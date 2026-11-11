export const getTeacherClassworkModalStyles = (isDark) => ({
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    backdropFilter: 'blur(4px)',
    padding: '24px 16px',
    boxSizing: 'border-box'
  },
  modalCard: {
    backgroundColor: isDark ? '#323232' : 'white',
    padding: '28px 32px',
    borderRadius: '20px',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '88vh',
    overflowY: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.5)' : '0 20px 40px rgba(0,0,0,0.2)',
    border: isDark ? '1px solid #4A4A4A' : 'none'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  closeModalBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: isDark ? '#a3a3a3' : '#9ca3af',
    padding: '4px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #d1d5db',
    backgroundColor: isDark ? '#3A3A3A' : 'white',
    color: isDark ? '#E8EAED' : '#1e293b',
    fontSize: '0.95rem',
    boxSizing: 'border-box'
  },
  fieldLabel: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: isDark ? '#E8EAED' : '#475569',
    marginTop: '6px'
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.82rem',
    color: isDark ? '#E8EAED' : '#4b5563',
    cursor: 'pointer'
  },
  attachIcons: {
    display: 'flex',
    gap: '12px',
    color: isDark ? '#a3a3a3' : '#6b7280'
  },
  attachIcon: {
    cursor: 'pointer'
  },
  attachmentList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: '10px',
    marginTop: '6px',
    width: '100%'
  },
  cardAttachments: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '12px',
    marginTop: '15px',
    width: '100%'
  },
  attachThumb: {
    maxWidth: '240px',
    maxHeight: '160px',
    borderRadius: '8px',
    objectFit: 'cover',
    display: 'block',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0'
  },
  attachVideo: {
    maxWidth: '380px',
    maxHeight: '220px',
    width: '100%',
    borderRadius: '8px',
    backgroundColor: '#000'
  },
  attachLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: isDark ? '#34d399' : '#059669',
    backgroundColor: isDark ? '#3A3A3A' : '#f8fafc',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '8px 14px',
    textDecoration: 'none',
    fontSize: '0.88rem',
    fontWeight: '500',
    maxWidth: '100%',
    wordBreak: 'break-all',
    boxSizing: 'border-box'
  },
  bottomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '20px',
    paddingBottom: '4px'
  },
  gradingGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.9rem',
    color: isDark ? '#E8EAED' : '#4b5563',
    cursor: 'pointer'
  },
  assignBtn: {
    padding: '10px 32px',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '50px',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '0.95rem',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(16,185,129,0.2)'
  },
  infoFieldRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #f1f5f9'
  },
  infoFieldLabel: {
    fontSize: '0.85rem',
    color: isDark ? '#a3a3a3' : '#64748b'
  },
  infoFieldValue: {
    fontSize: '0.92rem',
    color: isDark ? '#E8EAED' : '#1e293b',
    fontWeight: '600'
  }
});
