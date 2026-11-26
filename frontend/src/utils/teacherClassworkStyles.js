import { getTeacherClassworkModalStyles } from './teacherClassworkModalStyles';
import { getTeacherClassworkCardStyles } from './teacherClassworkCardStyles';
import { getTeacherClassworkStreamStyles } from './teacherClassworkStreamStyles';

export const getStyles = (isDark) => ({
  container: {
    height: '100vh',
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isDark ? '#141615' : '#f4f5f7',
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    position: 'relative',
    overflow: 'hidden',
    transition: 'background-color 0.25s ease'
  },
  header: {
    height: '72px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    backgroundColor: isDark ? '#3C3C3C' : '#EEF0F3',
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
  sidebarBtnText: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: isDark ? '#E8EAED' : '#334155',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  badge: {
    fontSize: '0.7rem',
    backgroundColor: isDark ? '#4A4A4A' : '#EEF0F3',
    color: isDark ? '#E8EAED' : '#475569',
    padding: '3px 8px',
    borderRadius: '10px',
    marginLeft: '6px',
    fontStyle: 'normal',
    transform: 'translateY(-5px)',
    border: isDark ? '1px solid #5A5A5A' : '1px solid #cbd5e1'
  },

  // MAIN CONTENT & BIG BOX CONTAINER
  mainContent: {
    flex: 1,
    padding: '20px 24px 24px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden'
  },
  bigBoxContainer: {
    backgroundColor: isDark ? '#323232' : '#ffffff',
    flex: 1,
    borderRadius: '24px',
    boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.25)' : '0 10px 25px rgba(0,0,0,0.05)',
    border: isDark ? '1px solid #4A4A4A' : 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
    transition: 'background-color 0.25s ease'
  },

  // TOP NAVIGATION BAR INSIDE THE BIG BOX
  classroomNavHeader: {
    height: '56px',
    padding: '0 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#323232' : '#ffffff',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    flexShrink: 0,
    zIndex: 10,
    transition: 'background-color 0.25s ease'
  },
  classroomTabsGroup: {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    gap: '8px'
  },
  classroomTabBtn: {
    background: 'none',
    border: 'none',
    height: '100%',
    padding: '0 18px',
    fontSize: '0.94rem',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s ease, border-bottom 0.2s ease'
  },
  iconActionBtn: {
    background: 'none',
    border: 'none',
    padding: '8px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s ease'
  },

  // INNER SCROLL AREA INSIDE THE BIG BOX
  bigBoxInnerScroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '24px 28px 32px 28px'
  },

  // Classwork Layout
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 0 20px 0',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    marginBottom: '24px'
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 24px',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '50px',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '0.95rem',
    cursor: 'pointer',
    boxShadow: isDark
      ? '0 0 16px rgba(16, 185, 129, 0.35), 0 2px 6px rgba(0, 0, 0, 0.35)'
      : '0 2px 6px rgba(16, 185, 129, 0.24), 0 1px 2px rgba(0, 0, 0, 0.05)',
    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease'
  },
  list: { display: 'flex', flexDirection: 'column', gap: '20px' },
  itemWrapper: { display: 'flex', flexDirection: 'column', gap: '10px' },
  itemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  titlePill: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: isDark ? '#383838' : '#f1f5f9',
    padding: '10px 20px',
    borderRadius: '50px',
    color: isDark ? '#E8EAED' : '#1e293b',
    fontWeight: '700',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 0.15s',
    border: isDark ? '1px solid #4A4A4A' : 'none'
  },
  itemDuePill: { marginLeft: '12px', fontSize: '0.75rem', color: isDark ? '#a3a3a3' : '#64748b', fontWeight: '600' },
  threeDots: { color: isDark ? '#a3a3a3' : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative' },
  dropdownMenu: {
    position: 'absolute',
    top: '28px',
    right: '0',
    backgroundColor: isDark ? '#323232' : '#ffffff',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
    zIndex: 30,
    minWidth: '130px'
  },
  dropdownItem: { padding: '8px 14px', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' },

  detailCard: { backgroundColor: isDark ? '#323232' : 'white', borderRadius: '16px', padding: '0', border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0', boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.04)', overflow: 'hidden' },
  detailHeaderBar: { display: 'flex', alignItems: 'center', gap: '18px', backgroundColor: isDark ? '#383838' : '#f8fafc', padding: '18px 24px', borderRadius: '12px', margin: '12px', border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0' },
  detailTitle: { fontSize: '1.25rem', fontWeight: 'bold', color: isDark ? '#E8EAED' : '#1e293b' },
  detailDue: { fontSize: '0.85rem', color: isDark ? '#a3a3a3' : '#64748b', marginTop: '2px' },
  detailBody: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', padding: '5px 28px 20px 28px' },
  detailLeft: { flex: 1, minWidth: 0, overflow: 'hidden' },
  postedText: { fontSize: '0.8rem', color: isDark ? '#a3a3a3' : '#94a3b8', marginBottom: '8px' },
  detailInstruction: { margin: 0, color: isDark ? '#E8EAED' : '#334155', fontSize: '0.98rem', lineHeight: 1.5, minWidth: 0, maxWidth: '100%' },
  detailStats: { display: 'flex', alignItems: 'stretch', gap: '0', paddingLeft: '20px', flexShrink: 0 },
  statCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 20px', minWidth: '70px' },
  statColDivider: { width: '1px', backgroundColor: isDark ? '#4A4A4A' : '#e2e8f0', alignSelf: 'stretch' },
  statNum: { fontSize: '1.4rem', fontWeight: 'bold', color: isDark ? '#E8EAED' : '#1e293b', fontVariantNumeric: 'tabular-nums' },
  statLabel: { fontSize: '0.85rem', color: isDark ? '#a3a3a3' : '#64748b', marginTop: '4px', whiteSpace: 'nowrap' },
  detailDivider: { height: '1px', backgroundColor: isDark ? '#4A4A4A' : '#e2e8f0', margin: '0 28px' },
  detailFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 28px',
    gap: '12px',
    flexWrap: 'wrap'
  },
  viewActivityLink: { color: '#10b981', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '700' },
  viewGradingBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 20px',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
    border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0'}`,
    borderRadius: '50px',
    color: isDark ? '#34d399' : '#059669',
    fontWeight: '700',
    fontSize: '0.88rem',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    boxShadow: isDark
      ? '0 0 12px rgba(16, 185, 129, 0.12)'
      : '0 1px 3px rgba(16, 185, 129, 0.10)'
  },
  liveMonitorBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '9px 22px',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '50px',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: '0.88rem',
    cursor: 'pointer',
    boxShadow: isDark
      ? '0 0 16px rgba(16, 185, 129, 0.35), 0 2px 6px rgba(0, 0, 0, 0.3)'
      : '0 2px 8px rgba(16, 185, 129, 0.25), 0 1px 2px rgba(0, 0, 0, 0.05)',
    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease'
  },

  ...getTeacherClassworkStreamStyles(isDark),
  ...getTeacherClassworkCardStyles(isDark),
  ...getTeacherClassworkModalStyles(isDark)
});
