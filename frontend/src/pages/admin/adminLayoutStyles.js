export const getLayoutStyles = (isDark) => ({
  header: {
    height: '72px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    backgroundColor: isDark ? '#3C3C3C' : '#EEF0F3',
    borderBottom: 'none',
    zIndex: 50,
    transition: 'background-color 0.25s ease'
  },
  sidebar: (collapsed) => ({
    width: collapsed ? '84px' : '240px',
    minWidth: collapsed ? '84px' : '240px',
    padding: '20px 14px 20px',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
    background: 'transparent',
    overflowY: 'auto',
    overflowX: 'hidden'
  }),
  sidebarBtn: () => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '16px',
    padding: '10px 18px',
    width: '100%',
    height: '42px',
    borderRadius: '14px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    position: 'relative',
    zIndex: 1
  }),
  badge: {
    fontSize: '0.72rem',
    fontWeight: '800',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.12)',
    color: isDark ? '#93c5fd' : '#2563eb',
    padding: '3px 9px',
    borderRadius: '10px',
    marginLeft: '8px',
    fontStyle: 'normal',
    transform: 'translateY(-5px)',
    border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(59, 130, 246, 0.25)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 24px 24px',
    minWidth: 0,
    overflow: 'hidden'
  },
  tabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflowY: 'auto',
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  }
});

