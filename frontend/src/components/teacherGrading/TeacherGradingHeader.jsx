import TeacherDashboardHeader from '../dashboard/TeacherDashboardHeader';

export default function TeacherGradingHeader({
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

  return (
    <TeacherDashboardHeader
      isDark={isDark}
      isMobile={isMobile}
      activeView="classrooms"
      onSetView={handleSetView}
      currentUser={currentUser}
      onLogout={onLogout}
    />
  );
}

