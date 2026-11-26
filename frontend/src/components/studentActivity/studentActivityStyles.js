export const getActivityStyles = (isDark) => ({
  container: {
    height: '100dvh',
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
    color: isDark ? '#E8EAED' : 'inherit',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
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
  }
});
