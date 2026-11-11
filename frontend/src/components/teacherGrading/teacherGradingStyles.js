export const getTeacherGradingStyles = (isDark, isMobile) => ({
  container: {
    height: '100vh',
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isDark ? '#141414' : '#f8fafc',
    color: isDark ? '#f8fafc' : '#0f172a',
    position: 'relative',
    overflow: 'hidden',
    transition: 'background-color 0.25s ease'
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: '64px',
    background: isDark ? 'rgba(20, 20, 20, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: isDark ? '1px solid #2e2e2e' : '1px solid #e2e8f0',
    flexShrink: 0,
    transition: 'background 0.25s ease'
  },
  instructorTag: {
    fontSize: '0.68rem',
    fontWeight: '700',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    color: isDark ? '#e2e8f0' : '#475569',
    padding: '3px 8px',
    borderRadius: '8px',
    marginLeft: '8px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  headerNavBtn: (isActive) => ({
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '50px',
    background: 'transparent',
    border: 'none',
    color: isActive ? '#10b981' : (isDark ? '#a3a3a3' : '#64748b'),
    fontWeight: isActive ? '700' : '600',
    fontSize: '0.88rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }),
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: isMobile ? '16px 14px 40px' : '20px clamp(16px, 3vw, 40px) 48px',
    boxSizing: 'border-box'
  },
  contentWrapper: {
    maxWidth: '1240px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  breadcrumbBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px'
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '10px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#262626' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontSize: '0.88rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    boxShadow: isDark ? '0 2px 6px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.04)'
  },
  heroCard: {
    backgroundColor: isDark ? '#242424' : '#ffffff',
    borderRadius: '16px',
    border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    padding: isMobile ? '18px' : '24px 28px',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.03)',
    transition: 'all 0.25s ease'
  },
  heroTopRow: {
    display: 'flex',
    alignItems: isMobile ? 'flex-start' : 'center',
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    gap: '20px'
  },
  heroLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    minWidth: 0,
    flex: 1
  },
  heroIconBox: {
    width: '54px',
    height: '54px',
    borderRadius: '12px',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ecfdf5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  heroPreTitle: {
    fontSize: '0.72rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#10b981',
    marginBottom: '2px'
  },
  heroTitle: {
    fontSize: isMobile ? '1.25rem' : '1.5rem',
    fontWeight: '800',
    color: isDark ? '#f8fafc' : '#0f172a',
    margin: 0,
    lineHeight: 1.25,
    wordBreak: 'break-word'
  },
  heroMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '8px'
  },
  metaBadgeGray: {
    fontSize: '0.74rem',
    fontWeight: '600',
    padding: '3px 9px',
    borderRadius: '6px',
    backgroundColor: isDark ? '#323232' : '#f1f5f9',
    color: isDark ? '#94a3b8' : '#475569',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  heroRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: isMobile ? 'flex-start' : 'flex-end',
    gap: '12px',
    flexShrink: 0
  },
  statsPillRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 14px',
    borderRadius: '10px',
    backgroundColor: isDark ? '#1a1a1a' : '#f8fafc',
    border: isDark ? '1px solid #333333' : '1px solid #e2e8f0',
    gap: '12px'
  },
  statPillItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '50px'
  },
  statPillNum: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: isDark ? '#f8fafc' : '#0f172a'
  },
  statPillLabel: {
    fontSize: '0.68rem',
    color: isDark ? '#94a3b8' : '#64748b',
    fontWeight: '600'
  },
  statPillDivider: {
    width: '1px',
    height: '24px',
    backgroundColor: isDark ? '#333333' : '#e2e8f0'
  },
  toggleInstructionsBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    border: isDark ? '1px solid #383838' : '1px solid #cbd5e1',
    color: isDark ? '#94a3b8' : '#475569',
    fontSize: '0.8rem',
    fontWeight: '700',
    cursor: 'pointer'
  },
  instructionsDrawer: {
    marginTop: '16px'
  },
  instructionsDivider: {
    height: '1px',
    backgroundColor: isDark ? '#383838' : '#e2e8f0',
    marginBottom: '16px'
  },
  instructionsHeading: {
    margin: '0 0 10px 0',
    fontSize: '0.92rem',
    fontWeight: '700',
    color: isDark ? '#f8fafc' : '#0f172a'
  },
  instructionsContent: {
    fontSize: '0.92rem',
    lineHeight: 1.6,
    color: isDark ? '#cbd5e1' : '#334155'
  },
  workspaceGrid: {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: '20px',
    alignItems: 'flex-start'
  }
});

