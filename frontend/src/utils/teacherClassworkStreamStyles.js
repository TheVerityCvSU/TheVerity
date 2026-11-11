export const getTeacherClassworkStreamStyles = (isDark) => ({
  streamContainer: {
    maxWidth: '960px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  bannerCard: {
    height: '240px',
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '24px 28px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
  },
  bannerInfo: {
    position: 'relative',
    zIndex: 5
  },
  bannerTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: '2.4rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)'
  },
  bannerSubtitle: {
    margin: '4px 0 0 0',
    color: 'rgba(255,255,255,0.92)',
    fontSize: '1.25rem',
    fontWeight: '600',
    textShadow: '0 1px 3px rgba(0,0,0,0.2)'
  },
  customizeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    backgroundColor: isDark ? '#3A3A3A' : '#ffffff',
    border: isDark ? '1px solid #4A4A4A' : 'none',
    borderRadius: '50px',
    padding: '8px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: isDark ? '#E8EAED' : '#1e293b',
    cursor: 'pointer',
    boxShadow: isDark
      ? '0 0 14px rgba(255, 255, 255, 0.08), 0 2px 8px rgba(0,0,0,0.45)'
      : '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    zIndex: 10,
    transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1), filter 0.18s ease'
  },
  infoBtn: {
    position: 'absolute',
    bottom: '18px',
    right: '20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    zIndex: 10,
    opacity: 0.85,
    transition: 'opacity 0.2s'
  },
  streamBodyGrid: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start'
  },
  streamLeftCol: {
    width: '210px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  streamRightCol: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  streamSideCard: {
    backgroundColor: isDark ? '#383838' : '#ffffff',
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    padding: '16px',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.02)'
  },
  sideCardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sideCardLabel: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: isDark ? '#E8EAED' : '#1e293b'
  },
  cardTinyActionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '3px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  classCodeDisplay: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#10b981',
    marginTop: '10px',
    letterSpacing: '0.04em',
    cursor: 'pointer'
  },
  noWorkText: {
    fontSize: '0.82rem',
    color: isDark ? '#a3a3a3' : '#64748b'
  },
  upcomingItemRow: {
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer'
  },
  upcomingItemDate: {
    fontSize: '0.72rem',
    color: '#10b981',
    fontWeight: '700'
  },
  upcomingItemTitle: {
    fontSize: '0.82rem',
    color: isDark ? '#E8EAED' : '#1e293b',
    fontWeight: '600',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  viewAllLink: {
    fontSize: '0.82rem',
    fontWeight: '700',
    color: '#10b981',
    cursor: 'pointer'
  }
});
