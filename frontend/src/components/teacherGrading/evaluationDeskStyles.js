export const getEvaluationDeskStyles = (isDark, isMobile) => ({
  evalCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: isDark ? '#242424' : '#ffffff',
    borderRadius: '16px',
    border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    padding: isMobile ? '18px' : '28px',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  emptyEval: {
    padding: '60px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  evalStudentHeader: {
    display: 'flex',
    alignItems: isMobile ? 'flex-start' : 'center',
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    gap: '16px',
    paddingBottom: '18px',
    borderBottom: isDark ? '1px solid #383838' : '1px solid #e2e8f0'
  },
  evalLargeAvatar: {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    fontWeight: '800',
    flexShrink: 0
  },
  evalStudentName: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '800',
    color: isDark ? '#f8fafc' : '#0f172a'
  },
  evalStudentSub: {
    fontSize: '0.84rem',
    marginTop: '4px'
  },
  playbackActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '8px 16px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: '0.86rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
  },
  fullscreenCodeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '10px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#2e2e2e' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontSize: '0.84rem',
    fontWeight: '700',
    cursor: 'pointer'
  },
  codeSnippetSection: {
    borderRadius: '12px',
    border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    overflow: 'hidden',
    backgroundColor: isDark ? '#1a1a1a' : '#f8fafc'
  },
  codeSnippetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: isDark ? '1px solid #2e2e2e' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#202020' : '#ffffff'
  },
  codeLengthBadge: {
    fontSize: '0.72rem',
    color: isDark ? '#94a3b8' : '#64748b',
    backgroundColor: isDark ? '#2d2d2d' : '#f1f5f9',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  copyCodeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    borderRadius: '6px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: 'transparent',
    color: isDark ? '#cbd5e1' : '#475569',
    fontSize: '0.76rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  codeBlockWrapper: {
    maxHeight: '300px',
    overflowY: 'auto'
  },
  codePre: {
    margin: 0,
    padding: '16px',
    fontFamily: '"Fira Code", Menlo, Monaco, Consolas, monospace',
    fontSize: '0.86rem',
    lineHeight: 1.55,
    color: isDark ? '#e2e8f0' : '#1e293b',
    backgroundColor: isDark ? '#141414' : '#ffffff',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  emptyCodeNotice: {
    padding: '30px 16px',
    textAlign: 'center',
    color: isDark ? '#94a3b8' : '#64748b',
    fontSize: '0.86rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  gradingFormCard: {
    backgroundColor: isDark ? '#1e1e1e' : '#f8fafc',
    borderRadius: '14px',
    border: isDark ? '1px solid #333333' : '1px solid #e2e8f0',
    padding: '20px'
  },
  inputLabel: {
    display: 'block',
    fontSize: '0.84rem',
    fontWeight: '700',
    color: isDark ? '#e2e8f0' : '#334155',
    marginBottom: '4px'
  },
  scoreInput: {
    width: '84px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#262626' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '1rem',
    fontWeight: '800',
    textAlign: 'center',
    outline: 'none'
  },
  scorePresetBtn: (isActive) => ({
    padding: '6px 10px',
    borderRadius: '6px',
    border: isDark ? '1px solid #383838' : '1px solid #cbd5e1',
    backgroundColor: isActive ? '#10b981' : (isDark ? '#2a2a2a' : '#ffffff'),
    color: isActive ? '#ffffff' : (isDark ? '#e2e8f0' : '#475569'),
    fontSize: '0.78rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  }),
  feedbackTextarea: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#262626' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  quickFeedbackPill: {
    fontSize: '0.72rem',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '50px',
    border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
    color: isDark ? '#94a3b8' : '#475569',
    cursor: 'pointer'
  },
  clearGradeBtn: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: '0.76rem',
    fontWeight: '700',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  evaluateSubmitBtn: (status) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 24px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: status === 'saved' ? '#10b981' : (status === 'error' ? '#ef4444' : '#10b981'),
    color: '#ffffff',
    fontSize: '0.92rem',
    fontWeight: '800',
    cursor: status === 'saving' ? 'wait' : 'pointer',
    opacity: status === 'saving' ? 0.75 : 1,
    boxShadow: '0 2px 10px rgba(16,185,129,0.3)',
    transition: 'all 0.2s ease'
  })
});

