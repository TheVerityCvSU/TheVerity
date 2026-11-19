import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import ImagePreviewModal from '../components/ImagePreviewModal';
import VideoPreviewModal from '../components/VideoPreviewModal';
import IframePreviewModal from '../components/IframePreviewModal';
import StudentMobileNav from '../components/dashboard/StudentMobileNav';
import { getStyles } from './classroomViewStyles';
import { useClassroomClasswork, isMaterialItem } from '../hooks/useClassroomClasswork';
import { useClassroomSubmissions } from '../hooks/useClassroomSubmissions';
import { useClassroomBannerTheme } from '../hooks/useClassroomBannerTheme';
import { useClassroomTabs, tabSlideVariants, classroomSlideVariants } from '../hooks/useClassroomTabs';
import ClassroomViewHeader from '../components/classroom/ClassroomViewHeader';
import ClassroomHeroBanner from '../components/classroom/ClassroomHeroBanner';
import ClassroomOverviewTab from '../components/classroom/ClassroomOverviewTab';
import ClassroomClassworkTab from '../components/classroom/ClassroomClassworkTab';
import ClassroomMaterialsTab from '../components/classroom/ClassroomMaterialsTab';
import ClassInfoModal from '../components/classroom/ClassInfoModal';

export default function ClassroomView({
  classroom,
  currentUser,
  onBack,
  onOpenAssignment,
  onStartAssignment,
  socket,
  onNavigateView,
  onLogout
}) {
  const { isDark } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const styles = getStyles(isDark, isMobile);
  const textColor = isDark ? '#f8f9fa' : '#1e293b';
  const textMuted = isDark ? '#a3a3a3' : '#64748b';
  const cardBg = isDark ? '#262626' : '#ffffff';
  const bgColor = isDark ? '#1a1a1a' : '#f8f9fa';

  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [previewIframe, setPreviewIframe] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isClassInfoModalOpen, setIsClassInfoModalOpen] = useState(false);

  useEffect(() => {
    setIsFadingOut(false);
  }, []);

  const { activeTab, tabDirection, transitionMode, handleTabChange } = useClassroomTabs(classroom);
  const { bannerTheme } = useClassroomBannerTheme({ classroom, socket });

  const handleInstructionClick = (e) => {
    const anchor = e.target.closest('a');
    if (anchor && anchor.href) {
      e.preventDefault();
      e.stopPropagation();
      const targetUrl = anchor.href;
      setPreviewIframe({ url: targetUrl, name: anchor.innerText?.trim() || targetUrl, type: 'link' });
    }
  };

  const {
    assignments,
    visibleClasswork,
    visibleMaterials,
    unseenMaterials,
    loadingAssignments,
    expandedId,
    setExpandedId,
    expandedInstructionId,
    setExpandedInstructionId,
    markMaterialsAsSeen,
    markSingleMaterialAsSeen
  } = useClassroomClasswork({ classroom, currentUser, socket, activeTab });

  const { submittedTasks, handleUnsubmitAssignment } = useClassroomSubmissions({
    assignments,
    classroom,
    currentUser,
    socket,
    isMaterialItem
  });

  const upcomingItems = useMemo(() => {
    return assignments
      .filter(item => !isMaterialItem(item) && !submittedTasks[item.id])
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return new Date(b.posted || 0) - new Date(a.posted || 0);
      });
  }, [assignments, submittedTasks]);

  const handleExit = (action) => {
    setIsFadingOut(true);
    setTimeout(() => action(), 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{ minHeight: '100vh', backgroundColor: bgColor, fontFamily: '"Inter", "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column', color: textColor }}
    >
      <ClassroomViewHeader
        isDark={isDark}
        isMobile={isMobile}
        textColor={textColor}
        textMuted={textMuted}
        bgColor={bgColor}
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onNavigateView={onNavigateView}
        onBack={onBack}
        onOpenSettings={() => {
          if (typeof onNavigateView === 'function') {
            onNavigateView('settings');
          } else if (typeof onBack === 'function') {
            onBack();
          }
        }}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, padding: '24px clamp(20px, 3vw, 48px)', maxWidth: '100%', margin: 0, width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
        <ClassroomHeroBanner
          classroom={classroom}
          bannerTheme={bannerTheme}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onNavigateBack={() => (onNavigateView ? onNavigateView('classrooms') : onBack())}
          isDark={isDark}
        />

        <AnimatePresence mode="wait" custom={transitionMode === 'classroom' ? 1 : tabDirection}>
          <motion.div
            key={`${classroom?.id || 'cls'}_${activeTab}`}
            custom={transitionMode === 'classroom' ? 1 : tabDirection}
            variants={transitionMode === 'classroom' ? classroomSlideVariants : tabSlideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ width: '100%' }}
          >
            {activeTab === 'stream' && (
              <ClassroomOverviewTab
                isMobile={isMobile}
                isDark={isDark}
                cardBg={cardBg}
                textMuted={textMuted}
                upcomingItems={upcomingItems}
                visibleClasswork={visibleClasswork}
                visibleMaterials={visibleMaterials}
                unseenMaterials={unseenMaterials}
                classroom={classroom}
                loadingAssignments={loadingAssignments}
                onSelectTodo={(id) => {
                  if (id) setExpandedId(id);
                  handleTabChange('classwork');
                }}
                onOpenMaterials={() => {
                  markMaterialsAsSeen();
                  handleTabChange('materials');
                }}
                onSelectMaterial={(id) => {
                  markSingleMaterialAsSeen(id);
                  setExpandedId(id);
                  handleTabChange('materials');
                }}
              />
            )}

            {activeTab === 'classwork' && (
              <ClassroomClassworkTab
                visibleClasswork={visibleClasswork}
                loadingAssignments={loadingAssignments}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
                submittedTasks={submittedTasks}
                onOpenAssignment={onOpenAssignment}
                onStartAssignment={onStartAssignment}
                onUnsubmitAssignment={handleUnsubmitAssignment}
                setPreviewImage={setPreviewImage}
                setPreviewVideo={setPreviewVideo}
                setPreviewIframe={setPreviewIframe}
                isDark={isDark}
                isMobile={isMobile}
                styles={styles}
                classroom={classroom}
                currentUser={currentUser}
                socket={socket}
              />
            )}

            {activeTab === 'materials' && (
              <ClassroomMaterialsTab
                visibleMaterials={visibleMaterials}
                loadingAssignments={loadingAssignments}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
                expandedInstructionId={expandedInstructionId}
                setExpandedInstructionId={setExpandedInstructionId}
                onOpenAssignment={onOpenAssignment}
                onMarkMaterialSeen={markSingleMaterialAsSeen}
                handleInstructionClick={handleInstructionClick}
                setPreviewImage={setPreviewImage}
                setPreviewVideo={setPreviewVideo}
                setPreviewIframe={setPreviewIframe}
                classroom={classroom}
                isDark={isDark}
                styles={styles}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <ClassInfoModal
        isOpen={isClassInfoModalOpen}
        onClose={() => setIsClassInfoModalOpen(false)}
        classroom={classroom}
        isDark={isDark}
        styles={styles}
      />

      {previewImage && (
        <ImagePreviewModal
          src={previewImage.url}
          alt={previewImage.name}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {previewVideo && (
        <VideoPreviewModal
          src={previewVideo.url}
          name={previewVideo.name}
          onClose={() => setPreviewVideo(null)}
        />
      )}

      {previewIframe && (
        <IframePreviewModal
          url={previewIframe.url}
          title={previewIframe.name}
          type={previewIframe.type}
          onClose={() => setPreviewIframe(null)}
        />
      )}

      {isMobile && (
        <StudentMobileNav
          isDark={isDark}
          activeView="classrooms"
          onSetView={(id) => {
            handleExit(() => {
              if (onNavigateView) onNavigateView(id);
              else onBack();
            });
          }}
        />
      )}
    </motion.div>
  );
}
