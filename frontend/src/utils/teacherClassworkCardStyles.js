export const getTeacherClassworkCardStyles = (isDark) => ({
  // Stream Feed Styles
  streamFeedCard: {
    backgroundColor: isDark ? '#383838' : '#ffffff',
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    padding: '18px 20px',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.02)'
  },
  assignmentStreamCard: {
    backgroundColor: isDark ? '#383838' : '#ffffff',
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.02)'
  },
  assignmentIconBadge: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: isDark ? '#1c2d24' : '#e6f4ea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  assignmentStreamTitle: {
    fontSize: '0.92rem',
    fontWeight: '700',
    color: isDark ? '#E8EAED' : '#1f2937'
  },
  assignmentStreamDate: {
    fontSize: '0.78rem',
    color: isDark ? '#a3a3a3' : '#64748b',
    marginTop: '3px'
  },
  streamCardDots: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px'
  },
  emptyFeedBox: {
    padding: '32px 20px',
    borderRadius: '12px',
    border: isDark ? '1px dashed #4A4A4A' : '1px dashed #cbd5e1',
    textAlign: 'center'
  },

  // People Tab
  peopleSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: '2px solid #10b981',
    marginBottom: '16px'
  },
  peopleSectionTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: '800',
    color: isDark ? '#E8EAED' : '#1e293b'
  },
  peopleList: {
    display: 'flex',
    flexDirection: 'column'
  },
  peopleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 14px',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #f1f5f9'
  },
  peopleAvatarGreen: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95rem',
    fontWeight: '800'
  },
  peopleAvatarBlue: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95rem',
    fontWeight: '800'
  },

  // Grades Tab
  activitySelectionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
    width: '100%'
  },
  activityChipBtn: {
    padding: '7px 16px',
    borderRadius: '50px',
    border: 'none',
    fontSize: '0.84rem',
    cursor: 'pointer',
    maxWidth: '100%',
    lineHeight: 1.35,
    whiteSpace: 'normal',
    textAlign: 'left',
    transition: 'all 0.15s ease'
  },
  bulkGradeActionBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#10b981',
    color: 'white',
    fontWeight: '700',
    fontSize: '0.82rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
  },
  gradingColumnsLayout: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start'
  },
  gradingRosterCol: {
    width: '280px',
    flexShrink: 0,
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    overflow: 'hidden',
    backgroundColor: isDark ? '#383838' : '#f8fafc'
  },
  rosterHeaderBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#323232' : '#ffffff'
  },
  gradingStudentList: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '480px',
    overflowY: 'auto'
  },
  gradingStudentRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #f1f5f9',
    cursor: 'pointer',
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
    transition: 'all 0.15s'
  },
  gradeBadgeGraded: {
    fontSize: '0.75rem',
    color: isDark ? '#34d399' : '#059669',
    fontWeight: '700',
    backgroundColor: isDark ? '#133527' : '#ecfdf5',
    padding: '3px 8px',
    borderRadius: '6px'
  },
  gradeBadgeTurnedIn: {
    fontSize: '0.72rem',
    color: isDark ? '#60a5fa' : '#2563eb',
    fontWeight: '700',
    backgroundColor: isDark ? '#1e2d42' : '#eff6ff',
    padding: '3px 8px',
    borderRadius: '6px'
  },
  gradingEvalCol: {
    flex: 1,
    minWidth: 0,
    borderRadius: '12px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0',
    padding: '24px',
    backgroundColor: isDark ? '#323232' : '#ffffff'
  },
  codePreviewPre: {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    padding: '16px',
    borderRadius: '10px',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '0.85rem',
    maxHeight: '220px',
    overflow: 'auto',
    margin: '6px 0 0 0'
  },
  playbackActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '6px',
    border: isDark ? '1px solid #4A4A4A' : '1px solid #cbd5e1',
    background: isDark ? '#3A3A3A' : 'white',
    color: isDark ? '#E8EAED' : '#334155',
    fontWeight: '700',
    fontSize: '0.8rem',
    cursor: 'pointer'
  },
  saveGradeBtn: {
    padding: '9px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
  }
});
