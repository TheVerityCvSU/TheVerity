import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsPanel from './SettingsPanel';
import TeacherCalendar from './TeacherCalendar';
import ClassroomSettings from './ClassroomSettings';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { sortClassroomsAlphabetically } from '../utils/classroomList';
import { useTeacherClassrooms } from '../hooks/useTeacherClassrooms';
import { VIEW_ORDER, drillVariants } from '../data/teacherDashboardConstants';
import TeacherDashboardHeader from '../components/dashboard/TeacherDashboardHeader';
import TeacherClassroomsGrid from '../components/dashboard/TeacherClassroomsGrid';
import TeacherArchivedGrid from '../components/dashboard/TeacherArchivedGrid';
import TeacherMobileNav from '../components/dashboard/TeacherMobileNav';
import CreateClassModal from '../components/dashboard/CreateClassModal';
import DeleteClassModal from '../components/dashboard/DeleteClassModal';
import ArchiveConfirmModal from '../components/ArchiveConfirmModal';

export default function TeacherDashboard({ currentUser, onLogout, onEnterClassroom, socket }) {
  const { isDark } = useDarkMode();
  const [activeView, setActiveView] = useState(() => localStorage.getItem('verity_teacher_view') || 'classrooms');
  const [slideDirection, setSlideDirection] = useState(1);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isCreatingClassRef = useRef(false);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', section: '', subject: '', code: '' });
  const [settingsClassroom, setSettingsClassroom] = useState(null);

  const {
    classrooms,
    setClassrooms,
    loadingClassrooms,
    activeClassroomCounts,
    allowDelete,
    deleteClassConfirm,
    setDeleteClassConfirm,
    archiveClassConfirm,
    setArchiveClassConfirm,
    handleArchiveClass,
    handleExecuteArchiveClass,
    handleUnarchiveClass,
    handleDeleteClass,
    handleExecuteDeleteClass,
    handleCreateClass,
    activeClassrooms,
    archivedClassrooms,
  } = useTeacherClassrooms({ currentUser, socket });

  const handleSetView = (view) => {
    const currentIdx = VIEW_ORDER[activeView] ?? 0;
    const nextIdx = VIEW_ORDER[view] ?? 0;
    setSlideDirection(nextIdx >= currentIdx ? 1 : -1);
    setActiveView(view);
    localStorage.setItem('verity_teacher_view', view);
  };

  const handleOpenCreateModal = () => {
    setNewClass({ name: '', section: '', subject: '', code: '' });
    setIsModalOpen(true);
  };

  const handleSubmitCreateClass = (e) => {
    e.preventDefault();
    if (isCreatingClassRef.current) return;
    const nameTrim = (newClass.name || '').trim();
    if (!nameTrim) return;

    isCreatingClassRef.current = true;
    setIsCreatingClass(true);

    // Close immediately to prevent spam creation
    setIsModalOpen(false);
    setNewClass({ name: '', section: '', subject: '', code: '' });

    try {
      handleCreateClass({ ...newClass, name: nameTrim });
    } finally {
      setTimeout(() => {
        isCreatingClassRef.current = false;
        setIsCreatingClass(false);
      }, 400);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        minHeight: '100vh',
        backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TeacherDashboardHeader
        isDark={isDark}
        isMobile={isMobile}
        activeView={activeView}
        onSetView={handleSetView}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      {/* Main Content Body */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
        padding: '32px clamp(20px, 3vw, 48px)',
        maxWidth: '1600px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <AnimatePresence mode="wait" custom={slideDirection}>
          {activeView === 'calendar' && (
            <motion.div key="calendar" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <TeacherCalendar classrooms={classrooms} />
            </motion.div>
          )}

          {activeView === 'archived' && (
            <motion.div key="archived" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <TeacherArchivedGrid
                isDark={isDark}
                isMobile={isMobile}
                archivedClassrooms={archivedClassrooms}
                activeClassroomCounts={activeClassroomCounts}
                onEnterClassroom={onEnterClassroom}
                onArchiveClass={handleArchiveClass}
                onUnarchiveClass={handleUnarchiveClass}
                onDeleteClass={handleDeleteClass}
                allowDelete={allowDelete}
                currentUser={currentUser}
              />
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div key="settings" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <SettingsPanel role="Instructor" />
            </motion.div>
          )}

          {activeView === 'classroomSettings' && settingsClassroom && (
            <motion.div key="classroomSettings" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <ClassroomSettings
                classroom={settingsClassroom}
                onClose={() => { setSettingsClassroom(null); handleSetView('classrooms'); }}
                onUpdate={(updated) => {
                  setClassrooms(prev => sortClassroomsAlphabetically(prev.map(c => c.id === updated.id ? { ...c, ...updated } : c)));
                  setSettingsClassroom(updated);
                }}
              />
            </motion.div>
          )}

          {activeView === 'classrooms' && (
            <motion.div key="classrooms" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <TeacherClassroomsGrid
                isDark={isDark}
                isMobile={isMobile}
                activeClassrooms={activeClassrooms}
                loadingClassrooms={loadingClassrooms}
                activeClassroomCounts={activeClassroomCounts}
                onOpenCreateModal={handleOpenCreateModal}
                onEnterClassroom={onEnterClassroom}
                onArchiveClass={handleArchiveClass}
                onUnarchiveClass={handleUnarchiveClass}
                onSettings={(c) => {
                  setSettingsClassroom(c);
                  handleSetView('classroomSettings');
                }}
                onDeleteClass={handleDeleteClass}
                allowDelete={allowDelete}
                currentUser={currentUser}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      {isMobile && (
        <TeacherMobileNav
          isDark={isDark}
          activeView={activeView}
          onSetView={handleSetView}
        />
      )}

      {/* Modals */}
      <CreateClassModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitCreateClass}
        isSubmitting={isCreatingClass}
        isDark={isDark}
        newClass={newClass}
        setNewClass={setNewClass}
      />

      <DeleteClassModal
        confirmData={deleteClassConfirm}
        onCancel={() => setDeleteClassConfirm(null)}
        onConfirm={handleExecuteDeleteClass}
        isDark={isDark}
      />

      <ArchiveConfirmModal
        isOpen={Boolean(archiveClassConfirm)}
        itemName={archiveClassConfirm?.name}
        isDark={isDark}
        onCancel={() => setArchiveClassConfirm(null)}
        onConfirm={handleExecuteArchiveClass}
      />
    </motion.div>
  );
}
