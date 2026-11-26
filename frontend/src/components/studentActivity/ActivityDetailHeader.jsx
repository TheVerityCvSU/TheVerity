import StudentDashboardHeader from '../dashboard/StudentDashboardHeader';

export default function ActivityDetailHeader({
  currentUser,
  isDark,
  isMobile,
  onBack,
  onNavigateView,
  onLogout
}) {
  const handleSetView = (viewId) => {
    if (onNavigateView) onNavigateView(viewId);
    else if (onBack) onBack();
  };

  const handleOpenJoinModal = () => {
    try {
      sessionStorage.setItem('verity_open_join_modal', 'true');
    } catch (_) {}
    if (onNavigateView) onNavigateView('classrooms');
    else if (onBack) onBack();
  };

  return (
    <StudentDashboardHeader
      isDark={isDark}
      isMobile={isMobile}
      activeView="classrooms"
      onSetView={handleSetView}
      currentUser={currentUser}
      onLogout={onLogout}
      onOpenJoinModal={handleOpenJoinModal}
      bgColor={isDark ? '#1a1a1a' : '#f8f9fa'}
      textColor={isDark ? '#f5f5f5' : '#111827'}
      textMuted={isDark ? '#a3a3a3' : '#6b7280'}
    />
  );
}

