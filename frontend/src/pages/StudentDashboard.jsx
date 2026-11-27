import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsPanel from './SettingsPanel';
import StudentCalendar from './StudentCalendar';
import PageLoader from '../components/PageLoader';
import { lazyWithRetry } from '../utils/lazyWithRetry';

const CompilerView = lazyWithRetry(() => import('./CompilerView'));
import VideoPreviewModal from '../components/VideoPreviewModal';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { VIEW_ORDER, drillVariants } from '../data/studentDashboardConstants';
import { useStudentClassrooms } from '../hooks/useStudentClassrooms';
import { useStudentActivities } from '../hooks/useStudentActivities';
import StudentDashboardHeader from '../components/dashboard/StudentDashboardHeader';
import StudentHeroStats from '../components/dashboard/StudentHeroStats';
import StudentClassroomsGrid from '../components/dashboard/StudentClassroomsGrid';
import StudentTodoSidebar from '../components/dashboard/StudentTodoSidebar';
import StudentArchivedGrid from '../components/dashboard/StudentArchivedGrid';
import StudentMobileNav from '../components/dashboard/StudentMobileNav';
import JoinClassModal from '../components/dashboard/JoinClassModal';
import ArchiveConfirmModal from '../components/ArchiveConfirmModal';

export default function StudentDashboard({
  currentUser,
  onLogout,
  onEnterClassroom,
  onOpenAssignment,
  socket,
  onOpenSandbox
}) {
  const { isDark } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [activeView, setActiveView] = useState(() => localStorage.getItem('verity_student_view') || 'classrooms');
  const [slideDirection, setSlideDirection] = useState(1);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const handleSync = (e) => {
      const target = e.detail || localStorage.getItem('verity_student_view') || 'classrooms';
      const currentIdx = VIEW_ORDER[activeView] ?? 0;
      const nextIdx = VIEW_ORDER[target] ?? 0;
      setSlideDirection(nextIdx >= currentIdx ? -1 : 1);
      setActiveView(target);
    };
    window.addEventListener('verity:student-view-sync', handleSync);
    return () => window.removeEventListener('verity:student-view-sync', handleSync);
  }, [activeView]);

  const {
    classrooms,
    loadingClassrooms,
    activeClassrooms,
    archivedClassrooms,
    archiveClassConfirm,
    setArchiveClassConfirm,
    handleArchiveClass,
    handleExecuteArchiveClass,
    handleUnarchiveClass,
    isModalOpen,
    setIsModalOpen,
    classCode,
    setClassCode,
    joinError,
    setJoinError,
    isJoining,
    handleJoinClass,
  } = useStudentClassrooms({ currentUser, socket });

  useEffect(() => {
    if (sessionStorage.getItem('verity_open_join_modal') === 'true') {
      sessionStorage.removeItem('verity_open_join_modal');
      setJoinError('');
      setClassCode('');
      setIsModalOpen(true);
    }
  }, [setIsModalOpen, setJoinError, setClassCode]);

  const {
    dashboardStats,
    loadingActivities,
    displayedUpcomingActivities,
    videoLessons,
    unseenVideo,
    currentVideoDuration,
    activePlayingVideo,
    setActivePlayingVideo,
    handleStartSession,
    handleVideoDurationLoaded,
  } = useStudentActivities({ currentUser, classrooms, activeClassrooms, onOpenAssignment });

  const handleEnterClassroom = (classroom) => {
    setIsFadingOut(true);
    setTimeout(() => onEnterClassroom(classroom), 250);
  };

  const handleSetView = (view) => {
    if (view === 'workspace' && onOpenSandbox) {
      onOpenSandbox();
      return;
    }
    const currentIdx = VIEW_ORDER[activeView] ?? 0;
    const nextIdx = VIEW_ORDER[view] ?? 0;
    setSlideDirection(nextIdx >= currentIdx ? -1 : 1);
    setActiveView(view);
    localStorage.setItem('verity_student_view', view);
  };

  const bgColor = isDark ? '#1a1a1a' : '#f8f9fa';
  const textColor = isDark ? '#f5f5f5' : '#111827';
  const textMuted = isDark ? '#a3a3a3' : '#6b7280';
  const cardBg = isDark ? '#262626' : '#ffffff';

  useEffect(() => {
    document.documentElement.style.backgroundColor = bgColor;
    document.body.style.backgroundColor = bgColor;
    return () => {
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
    };
  }, [bgColor]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        minHeight: '100vh',
        backgroundColor: bgColor,
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        color: textColor,
      }}
    >
      <StudentDashboardHeader
        isDark={isDark}
        isMobile={isMobile}
        activeView={activeView}
        onSetView={handleSetView}
        currentUser={currentUser}
        onLogout={onLogout}
        onOpenJoinModal={() => { setJoinError(''); setClassCode(''); setIsModalOpen(true); }}
        bgColor={bgColor}
        textColor={textColor}
        textMuted={textMuted}
      />

      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: activeView === 'compiler' ? 'hidden' : 'visible',
        padding: activeView === 'compiler' ? 0 : '32px clamp(20px, 3vw, 48px)',
        maxWidth: '100%',
        margin: 0,
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <AnimatePresence mode="wait" custom={slideDirection}>
          {activeView === 'classrooms' && (
            <motion.div
              key="classrooms"
              custom={slideDirection}
              variants={drillVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <StudentHeroStats
                currentUser={currentUser}
                dashboardStats={dashboardStats}
                textColor={textColor}
                textMuted={textMuted}
                cardBg={cardBg}
                isDark={isDark}
              />

              <div style={{
                display: 'flex',
                gap: '32px',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'flex-start',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <StudentClassroomsGrid
                  isMobile={isMobile}
                  loadingClassrooms={loadingClassrooms}
                  activeClassrooms={activeClassrooms}
                  cardBg={cardBg}
                  textMuted={textMuted}
                  handleEnterClassroom={handleEnterClassroom}
                  handleArchiveClass={handleArchiveClass}
                  handleUnarchiveClass={handleUnarchiveClass}
                  onOpenJoinModal={() => setIsModalOpen(true)}
                />

                <StudentTodoSidebar
                  isDark={isDark}
                  isMobile={isMobile}
                  cardBg={cardBg}
                  textColor={textColor}
                  textMuted={textMuted}
                  unseenVideo={unseenVideo}
                  videoLessons={videoLessons}
                  currentVideoDuration={currentVideoDuration}
                  onStartSession={handleStartSession}
                  onDurationLoaded={handleVideoDurationLoaded}
                  loadingActivities={loadingActivities}
                  displayedUpcomingActivities={displayedUpcomingActivities}
                  classrooms={classrooms}
                  onOpenAssignment={onOpenAssignment}
                  onEnterClassroom={handleEnterClassroom}
                />
              </div>
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div key="settings" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <SettingsPanel role="Student" />
            </motion.div>
          )}

          {activeView === 'compiler' && (
            <motion.div key="compiler" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Suspense fallback={<PageLoader />}>
                <CompilerView />
              </Suspense>
            </motion.div>
          )}

          {activeView === 'calendar' && (
            <motion.div key="calendar" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <StudentCalendar classrooms={classrooms} currentUser={currentUser} />
            </motion.div>
          )}

          {activeView === 'archived' && (
            <motion.div
              key="archived"
              custom={slideDirection}
              variants={drillVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', width: '100%' }}
            >
              <StudentArchivedGrid
                isMobile={isMobile}
                isDark={isDark}
                textColor={textColor}
                archivedClassrooms={archivedClassrooms}
                handleEnterClassroom={handleEnterClassroom}
                handleArchiveClass={handleArchiveClass}
                handleUnarchiveClass={handleUnarchiveClass}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {isMobile && (
        <StudentMobileNav
          isDark={isDark}
          activeView={activeView}
          onSetView={handleSetView}
        />
      )}

      {activePlayingVideo && (
        <VideoPreviewModal
          src={activePlayingVideo.src}
          name={activePlayingVideo.title}
          onClose={() => setActivePlayingVideo(null)}
        />
      )}

      <JoinClassModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setJoinError(''); setClassCode(''); }}
        onSubmit={handleJoinClass}
        isDark={isDark}
        classCode={classCode}
        setClassCode={setClassCode}
        joinError={joinError}
        isJoining={isJoining}
        cardBg={cardBg}
        textColor={textColor}
        textMuted={textMuted}
      />

      <ArchiveConfirmModal
        isOpen={Boolean(archiveClassConfirm)}
        itemName={archiveClassConfirm?.name}
        title="Archive course?"
        subtitle="Move course to Archived Classrooms"
        confirmLabel="Archive course"
        description={
          <p style={{ margin: 0 }}>
            Are you sure you want to archive{' '}
            <span style={{ fontWeight: 600, color: isDark ? '#FBBF24' : '#B45309' }}>
              {archiveClassConfirm?.name || 'this course'}
            </span>
            ? You can still review past materials and activities in Archived Classrooms, while To-Do and Calendar updates stay hidden until you unarchive it.
          </p>
        }
        isDark={isDark}
        onCancel={() => setArchiveClassConfirm(null)}
        onConfirm={handleExecuteArchiveClass}
      />
    </motion.div>
  );
}
