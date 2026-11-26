import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Skeleton from '../components/Skeleton';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import ImagePreviewModal from '../components/ImagePreviewModal';
import VideoPreviewModal from '../components/VideoPreviewModal';
import IframePreviewModal from '../components/IframePreviewModal';
import { getTeacherGradingStyles } from '../components/teacherGrading/teacherGradingStyles';
import { getRosterStyles } from '../components/teacherGrading/rosterStyles';
import { getEvaluationDeskStyles } from '../components/teacherGrading/evaluationDeskStyles';
import TeacherGradingHeader from '../components/teacherGrading/TeacherGradingHeader';
import GradingHeroBanner from '../components/teacherGrading/GradingHeroBanner';
import GradingRosterSidebar from '../components/teacherGrading/GradingRosterSidebar';
import GradingEvaluationDesk from '../components/teacherGrading/GradingEvaluationDesk';
import GradingBulkModal from '../components/teacherGrading/GradingBulkModal';
import GradingCodeModal from '../components/teacherGrading/GradingCodeModal';
import GradingMobileNav from '../components/teacherGrading/GradingMobileNav';
import { useTeacherGrading } from '../hooks/useTeacherGrading';

export default function TeacherGrading({
  classroom,
  assignment,
  onBack,
  onLogout,
  onStartMonitoring,
  onOpenPlayback,
  onNavigateView,
  socket,
  currentUser: propCurrentUser
}) {
  const { isDark } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isHeaderMobile = useMediaQuery('(max-width: 768px)');
  const currentUser = propCurrentUser || (() => {
    try { return JSON.parse(localStorage.getItem('verity_user')); } catch { return null; }
  })();

  const baseStyles = getTeacherGradingStyles(isDark, isMobile);
  const rosterStyles = getRosterStyles(isDark, isMobile);
  const deskStyles = getEvaluationDeskStyles(isDark, isMobile);
  const styles = { ...baseStyles, ...rosterStyles, ...deskStyles };

  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [previewIframe, setPreviewIframe] = useState(null);

  const {
    maxPoints,
    loading,
    students,
    totalEnrolledCount,
    selectedId,
    setSelectedId,
    selectedStudent,
    searchTerm,
    setSearchTerm,
    filterTab,
    setFilterTab,
    isInstructionsOpen,
    setIsInstructionsOpen,
    grades,
    gradeInput,
    setGradeInput,
    feedbackInput,
    setFeedbackInput,
    saveStatus,
    saveError,
    showBulkModal,
    setShowBulkModal,
    bulkGrade,
    setBulkGrade,
    bulkFeedback,
    setBulkFeedback,
    bulkSuccessMsg,
    showCodeModal,
    setShowCodeModal,
    copiedCode,
    turnedInStudents,
    gradedStudents,
    ungradedStudents,
    filteredStudents,
    handleEvaluate,
    handleClearGrade,
    handleBulkGrade,
    handleCopyCode
  } = useTeacherGrading({ classroom, assignment, socket });

  const handleInstructionClick = (e) => {
    const anchor = e.target.closest('a');
    if (anchor && anchor.href) {
      e.preventDefault();
      e.stopPropagation();
      setPreviewIframe({
        url: anchor.href,
        name: anchor.innerText?.trim() || anchor.href,
        type: 'link'
      });
    }
  };

  const handlePreviewAttachment = (clickedAtt) => {
    if (!clickedAtt) return;
    const ext = (clickedAtt.url || clickedAtt.name || '').split('?')[0].split('.').pop().toLowerCase();
    const isImg = clickedAtt.type === 'image' || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext);
    const isVid = clickedAtt.type === 'video' || ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(ext);
    if (isImg) setPreviewImage(clickedAtt);
    else if (isVid) setPreviewVideo(clickedAtt);
    else if (clickedAtt.url) setPreviewIframe(clickedAtt);
  };

  return (
    <div style={styles.container}>
      {/* ═══ TOP HEADER ═══ */}
      <TeacherGradingHeader
        currentUser={currentUser}
        isDark={isDark}
        isMobile={isHeaderMobile}
        onBack={onBack}
        onNavigateView={onNavigateView}
        onLogout={onLogout}
      />

      {/* ═══ MAIN VIEWPORT ═══ */}
      <div style={styles.scrollArea}>
        <div style={styles.contentWrapper}>
          {/* Breadcrumb Bar */}
          <div style={styles.breadcrumbBar}>
            <button
              onClick={onBack}
              style={styles.backBtn}
              title="Return to Classwork"
            >
              <ArrowLeft size={16} /> Back to Classwork
            </button>
          </div>

          {/* Activity Hero Banner */}
          <GradingHeroBanner
            assignment={assignment}
            maxPoints={maxPoints}
            turnedInCount={turnedInStudents.length}
            gradedCount={gradedStudents.length}
            totalEnrolledCount={totalEnrolledCount || students.length}
            isInstructionsOpen={isInstructionsOpen}
            setIsInstructionsOpen={setIsInstructionsOpen}
            isDark={isDark}
            styles={styles}
            onInstructionClick={handleInstructionClick}
            onPreviewAttachment={handlePreviewAttachment}
          />

          {/* Main Two-Column Workspace */}
          {loading ? (
            <div style={{ marginTop: '24px' }}>
              <Skeleton.Grading isDark={isDark} isMobile={isMobile} />
            </div>
          ) : (
            <div style={styles.workspaceGrid}>
              <GradingRosterSidebar
                students={students}
                filteredStudents={filteredStudents}
                ungradedStudents={ungradedStudents}
                gradedStudents={gradedStudents}
                turnedInStudents={turnedInStudents}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filterTab={filterTab}
                setFilterTab={setFilterTab}
                grades={grades}
                maxPoints={maxPoints}
                bulkSuccessMsg={bulkSuccessMsg}
                onOpenBulkModal={() => setShowBulkModal(true)}
                isDark={isDark}
                styles={styles}
              />

              <GradingEvaluationDesk
                selectedStudent={selectedStudent}
                maxPoints={maxPoints}
                grades={grades}
                gradeInput={gradeInput}
                setGradeInput={setGradeInput}
                feedbackInput={feedbackInput}
                setFeedbackInput={setFeedbackInput}
                saveStatus={saveStatus}
                saveError={saveError}
                copiedCode={copiedCode}
                assignment={assignment}
                isDark={isDark}
                styles={styles}
                onOpenPlayback={onOpenPlayback || onStartMonitoring}
                onOpenCodeModal={() => setShowCodeModal(true)}
                onCopyCode={handleCopyCode}
                onEvaluate={handleEvaluate}
                onClearGrade={handleClearGrade}
              />
            </div>
          )}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}
      {showCodeModal && selectedStudent && (
        <GradingCodeModal
          selectedStudent={selectedStudent}
          assignmentTitle={assignment?.title}
          copiedCode={copiedCode}
          onCopyCode={handleCopyCode}
          onClose={() => setShowCodeModal(false)}
          isDark={isDark}
        />
      )}

      {showBulkModal && (
        <GradingBulkModal
          turnedInStudentsCount={turnedInStudents.length}
          maxPoints={maxPoints}
          bulkGrade={bulkGrade}
          setBulkGrade={setBulkGrade}
          bulkFeedback={bulkFeedback}
          setBulkFeedback={setBulkFeedback}
          onApplyBulk={handleBulkGrade}
          onClose={() => setShowBulkModal(false)}
          isDark={isDark}
        />
      )}

      {previewImage && (
        <ImagePreviewModal
          image={previewImage}
          onClose={() => setPreviewImage(null)}
          isDark={isDark}
        />
      )}

      {previewVideo && (
        <VideoPreviewModal
          video={previewVideo}
          onClose={() => setPreviewVideo(null)}
          isDark={isDark}
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
        <GradingMobileNav
          isDark={isDark}
          onNavigateView={onNavigateView}
          onBack={onBack}
        />
      )}
    </div>
  );
}
