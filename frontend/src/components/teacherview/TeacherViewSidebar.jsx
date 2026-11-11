import { Users, AlertTriangle, Search, X, ChevronUp, PanelLeftClose } from 'lucide-react';
import TeacherViewSidebarRail from './TeacherViewSidebarRail';
import TeacherViewRosterList from './TeacherViewRosterList';
import TeacherViewWarningsList from './TeacherViewWarningsList';

export default function TeacherViewSidebar({
  sidebarOpen,
  setSidebarOpen,
  sidebarTab,
  setSidebarTab,
  studentSearch,
  setStudentSearch,
  isMobile,
  isCompact,
  windowWidth,
  isDark,
  theme,
  mode,
  visibleStudents,
  allLogs,
  students,
  selectedStudentId,
  setSelectedStudentId,
  activeStudent
}) {
  if (!sidebarOpen) {
    return (
      <TeacherViewSidebarRail
        isMobile={isMobile}
        isDark={isDark}
        allLogsLength={allLogs.length}
        onExpand={() => setSidebarOpen(true)}
      />
    );
  }

  return (
    <aside
      style={{
        position: isCompact ? 'fixed' : 'relative',
        top: isCompact ? (isMobile ? '56px' : '62px') : 'auto',
        left: 0,
        bottom: isCompact ? 0 : 'auto',
        height: isCompact ? `calc(100vh - ${isMobile ? 56 : 62}px)` : '100%',
        width: isCompact
          ? Math.min(360, windowWidth * 0.88)
          : windowWidth >= 1600
          ? '340px'
          : '300px',
        maxWidth: '100vw',
        backgroundColor: isDark ? '#282828' : '#f3f4f6',
        borderRight: isMobile ? 'none' : isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db',
        borderBottom: isMobile ? (isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db') : 'none',
        display: 'flex',
        flexDirection: 'column',
        transition: isCompact ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'width 0.2s ease',
        zIndex: isCompact ? 50 : 20,
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      {/* Header with Tabs and Close Button */}
      <div
        style={{
          padding: '12px 14px 8px 14px',
          borderBottom: isDark ? '1px solid #333333' : '1px solid #e5e7eb',
          backgroundColor: isDark ? '#262626' : '#ffffff'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: 0 }}>
            <button
              onClick={() => setSidebarTab('roster')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: sidebarTab === 'roster' ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5') : 'transparent',
                color: sidebarTab === 'roster' ? (isDark ? '#10b981' : '#059669') : (isDark ? '#9ca3af' : '#64748b'),
                fontWeight: '700',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                minWidth: 0
              }}
            >
              <Users size={14} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mode === 'live' ? `Live (${visibleStudents.length})` : `Submissions (${visibleStudents.length})`}
              </span>
            </button>

            <button
              onClick={() => setSidebarTab('warnings')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: sidebarTab === 'warnings' ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2') : 'transparent',
                color: sidebarTab === 'warnings' ? '#ef4444' : (isDark ? '#9ca3af' : '#64748b'),
                fontWeight: '700',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                minWidth: 0
              }}
            >
              <AlertTriangle size={14} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Warning
              </span>
            </button>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: isDark ? '#9ca3af' : '#6b7280',
              cursor: 'pointer',
              transition: 'color 0.15s ease',
              flexShrink: 0
            }}
            title="Collapse Panel"
          >
            {isMobile ? <ChevronUp size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Student Search Input */}
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: theme.textMuted
            }}
          />
          <input
            type="text"
            placeholder={sidebarTab === 'roster' ? 'Filter students...' : 'Filter warnings...'}
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px 7px 30px',
              borderRadius: '6px',
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.bg,
              color: theme.textPrimary,
              fontSize: '0.82rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {studentSearch && (
            <button
              onClick={() => setStudentSearch('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: theme.textMuted,
                cursor: 'pointer',
                padding: 0
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Tab Panels */}
      {sidebarTab === 'roster' ? (
        <TeacherViewRosterList
          visibleStudents={visibleStudents}
          studentSearch={studentSearch}
          mode={mode}
          selectedStudentId={selectedStudentId}
          setSelectedStudentId={setSelectedStudentId}
          activeStudent={activeStudent}
          allLogs={allLogs}
          theme={theme}
          isDark={isDark}
          isCompact={isCompact}
          setSidebarOpen={setSidebarOpen}
        />
      ) : (
        <TeacherViewWarningsList
          allLogs={allLogs}
          studentSearch={studentSearch}
          students={students}
          setSelectedStudentId={setSelectedStudentId}
          theme={theme}
          isCompact={isCompact}
          setSidebarOpen={setSidebarOpen}
        />
      )}
    </aside>
  );
}
