export const getInitialAppScreen = (isAdminApp) => {
  let savedUser = null;
  try {
    const savedUserStr = localStorage.getItem('currentUser') || localStorage.getItem('verity_user');
    savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
  } catch (_) {}

  if (isAdminApp) {
    if (savedUser && savedUser.role === 'Admin') return 'admin_dashboard';
    return 'admin_login';
  }

  if (!savedUser) return 'login';

  const savedScreen = localStorage.getItem('currentScreen');
  if (savedScreen && savedScreen !== 'admin_login' && savedScreen !== 'admin_dashboard') {
    return savedScreen;
  }

  if (savedUser.role === 'Admin') return 'admin_dashboard';
  if (savedUser.role === 'Teacher') return 'teacher_dashboard';
  return 'student_dashboard';
};

export const getDefaultFallbackScreen = (screen, role, proctoringReturnScreen, workspaceReturnScreen) => {
  const isTeacher = role === 'Teacher';
  switch (screen) {
    case 'teacher_proctoring':
    case 'teacher_live_monitoring':
    case 'teacher_playback':
      return proctoringReturnScreen || 'teacher_grading';
    case 'teacher_grading':
      return 'teacher_classwork';
    case 'teacher_classwork':
      return 'teacher_dashboard';
    case 'student_workspace':
      return workspaceReturnScreen || 'classroom_view';
    case 'student_activity_detail':
      return workspaceReturnScreen === 'student_dashboard' ? 'student_dashboard' : 'classroom_view';
    case 'classroom_view':
      return 'student_dashboard';
    case 'sandbox_workspace':
      return 'student_dashboard';
    default:
      return isTeacher ? 'teacher_dashboard' : 'student_dashboard';
  }
};
