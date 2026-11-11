export const getRosterStyles = (isDark, isMobile) => ({
  rosterCard: {
    width: isMobile ? '100%' : '340px',
    flexShrink: 0,
    backgroundColor: isDark ? '#242424' : '#ffffff',
    borderRadius: '16px',
    border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.03)'
  },
  rosterHeader: {
    padding: '16px 16px 12px',
    borderBottom: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#202020' : '#ffffff'
  },
  rosterTitle: {
    margin: 0,
    fontSize: '0.98rem',
    fontWeight: '700',
    color: isDark ? '#f8fafc' : '#0f172a'
  },
  rosterCountBadge: {
    fontSize: '0.72rem',
    fontWeight: '800',
    padding: '2px 7px',
    borderRadius: '50px',
    backgroundColor: isDark ? '#333333' : '#f1f5f9',
    color: isDark ? '#94a3b8' : '#475569'
  },
  bulkGradeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 11px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
  },
  bulkToast: {
    marginTop: '10px',
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
    color: isDark ? '#34d399' : '#059669',
    fontSize: '0.75rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  filterPillsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '12px'
  },
  filterPillBtn: (isActive) => ({
    flex: 1,
    padding: '5px 8px',
    borderRadius: '7px',
    border: 'none',
    fontSize: '0.74rem',
    fontWeight: isActive ? '700' : '500',
    cursor: 'pointer',
    backgroundColor: isActive ? (isDark ? '#34d399' : '#10b981') : 'transparent',
    color: isActive ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
    transition: 'all 0.15s ease',
    textAlign: 'center'
  }),
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '10px',
    padding: '6px 10px',
    borderRadius: '8px',
    backgroundColor: isDark ? '#1a1a1a' : '#f1f5f9',
    border: isDark ? '1px solid #333333' : '1px solid #e2e8f0'
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '0.82rem'
  },
  clearSearchBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: isDark ? '#94a3b8' : '#64748b',
    display: 'flex',
    alignItems: 'center'
  },
  studentList: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '560px',
    overflowY: 'auto'
  },
  studentRow: (isSelected) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: isDark ? '1px solid #2e2e2e' : '1px solid #f1f5f9',
    borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent',
    backgroundColor: isSelected
      ? (isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5')
      : 'transparent',
    transition: 'all 0.15s ease'
  }),
  studentAvatar: (status) => ({
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    backgroundColor: status === 'graded' ? '#10b981' : (status === 'turned_in' ? '#3b82f6' : (isDark ? '#4b5563' : '#cbd5e1')),
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: '800',
    flexShrink: 0
  }),
  studentRowName: (isSelected) => ({
    fontSize: '0.88rem',
    fontWeight: isSelected ? '700' : '600',
    color: isSelected ? '#10b981' : (isDark ? '#f8fafc' : '#0f172a'),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }),
  studentRowSub: {
    fontSize: '0.74rem',
    color: isDark ? '#94a3b8' : '#64748b',
    marginTop: '2px'
  },
  statusBadgeGraded: {
    fontSize: '0.75rem',
    fontWeight: '800',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#d1fae5',
    color: isDark ? '#34d399' : '#065f46',
    display: 'flex',
    alignItems: 'center',
    gap: '3px'
  },
  statusBadgeTurnedIn: {
    fontSize: '0.72rem',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.18)' : '#dbeafe',
    color: isDark ? '#60a5fa' : '#1e40af'
  },
  emptyRoster: {
    padding: '36px 16px',
    textAlign: 'center'
  }
});

