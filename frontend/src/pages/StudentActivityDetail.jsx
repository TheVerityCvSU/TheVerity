import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import Skeleton from '../components/Skeleton';
import ImagePreviewModal from '../components/ImagePreviewModal';
import VideoPreviewModal from '../components/VideoPreviewModal';
import IframePreviewModal from '../components/IframePreviewModal';
import { getActivityStyles } from '../components/studentActivity/studentActivityStyles';
import ActivityDetailHeader from '../components/studentActivity/ActivityDetailHeader';
import ActivityContentCard from '../components/studentActivity/ActivityContentCard';
import ActivityCodeModal from '../components/studentActivity/ActivityCodeModal';
import ActivityConfirmModals from '../components/studentActivity/ActivityConfirmModals';
import StrictLockStartModal from '../components/studentActivity/StrictLockStartModal';
import ActivityMobileNav from '../components/studentActivity/ActivityMobileNav';
import { useStudentSubmission } from '../hooks/useStudentSubmission';

export default function StudentActivityDetail({
  classroom,
  assignment,
  currentUser,
  socket,
  onBack,
  onNavigateView,
  onStartCoding,
  onLogout
}) {
  const { isDark } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const styles = getActivityStyles(isDark, isMobile);

  const [loading, setLoading] = useState(!assignment);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [previewIframe, setPreviewIframe] = useState(null);
  const [showStrictLockModal, setShowStrictLockModal] = useState(false);

  useEffect(() => {
    setLoading(!assignment);
  }, [assignment]);

  const {
    submission,
    gradeData,
    isSubmitted,
    showCodePreview,
    setShowCodePreview,
    showSubmitModal,
    setShowSubmitModal,
    showUnsubmitModal,
    setShowUnsubmitModal,
    handleSubmit,
    handleConfirmSubmit,
    handleUnsubmit,
    handleConfirmUnsubmit
  } = useStudentSubmission({ classroom, assignment, currentUser, socket });

  const handleStartWithCheck = () => {
    const isStrictLocked = Boolean(assignment?.disableBack || assignment?.disable_back);
    if (isStrictLocked && !isSubmitted) {
      setShowStrictLockModal(true);
      return;
    }
    if (typeof onStartCoding === 'function') {
      onStartCoding();
    }
  };

  const handlePreviewAttachment = (clickedAtt) => {
    if (!clickedAtt) return;
    const ext = (clickedAtt.url || clickedAtt.name || '').split('?')[0].split('.').pop().toLowerCase();
    const isImg = clickedAtt.type === 'image' || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext);
    const isVid = clickedAtt.type === 'video' || ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(ext);
    if (isImg) {
      setPreviewImage(clickedAtt);
    } else if (isVid) {
      setPreviewVideo(clickedAtt);
    } else if (clickedAtt.type === 'document' || clickedAtt.type === 'link' || clickedAtt.url) {
      setPreviewIframe(clickedAtt);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={styles.container}
    >
      {/* ═══ GLOBAL TOP HEADER ═══ */}
      <ActivityDetailHeader
        currentUser={currentUser}
        isDark={isDark}
        isMobile={isMobile}
        onBack={onBack}
        onNavigateView={onNavigateView}
        onLogout={onLogout}
      />

      {/* ═══ MAIN LAYOUT ═══ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', backgroundColor: isDark ? '#141414' : '#f8fafc', overflowY: 'auto' }}>
          {loading || !assignment ? (
            <Skeleton.ActivityDetail />
          ) : (
            <ActivityContentCard
              assignment={assignment}
              classroom={classroom}
              isDark={isDark}
              styles={styles}
              submission={submission}
              gradeData={gradeData}
              isSubmitted={isSubmitted}
              onSubmit={handleSubmit}
              onUnsubmit={handleUnsubmit}
              onStartCoding={handleStartWithCheck}
              onViewCode={() => setShowCodePreview(true)}
              onPreviewAttachment={handlePreviewAttachment}
              onPreviewLink={setPreviewIframe}
              onBack={onBack}
            />
          )}
        </div>
      </div>

      {/* ═══ CODE PREVIEW MODAL ═══ */}
      {showCodePreview && (
        <ActivityCodeModal
          isDark={isDark}
          code={submission?.finalCode}
          onClose={() => setShowCodePreview(false)}
        />
      )}

      {/* ═══ SUBMIT / UNSUBMIT CONFIRMATION MODALS ═══ */}
      <ActivityConfirmModals
        isDark={isDark}
        showSubmitModal={showSubmitModal}
        showUnsubmitModal={showUnsubmitModal}
        onCloseSubmit={() => setShowSubmitModal(false)}
        onCloseUnsubmit={() => setShowUnsubmitModal(false)}
        onConfirmSubmit={handleConfirmSubmit}
        onConfirmUnsubmit={handleConfirmUnsubmit}
        activityTitle={assignment?.title || 'this activity'}
      />

      {/* ═══ STRICT LOCKDOWN WARNING MODAL ═══ */}
      <StrictLockStartModal
        isOpen={showStrictLockModal}
        isDark={isDark}
        assignmentTitle={assignment?.title || 'This Activity'}
        onClose={() => setShowStrictLockModal(false)}
        onConfirm={() => {
          setShowStrictLockModal(false);
          if (typeof onStartCoding === 'function') onStartCoding();
        }}
      />

      {/* ═══ MEDIA PREVIEWS ═══ */}
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

      {/* ═══ MOBILE BOTTOM NAVIGATION ═══ */}
      {isMobile && (
        <ActivityMobileNav
          isDark={isDark}
          onBack={onBack}
          onNavigateView={onNavigateView}
        />
      )}
    </motion.div>
  );
}
