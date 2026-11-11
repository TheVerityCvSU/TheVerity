import ImagePreviewModal from '../ImagePreviewModal';
import VideoPreviewModal from '../VideoPreviewModal';
import IframePreviewModal from '../IframePreviewModal';
import StudentViewSettingsModal from './StudentViewSettingsModal';
import StudentViewSubmissionModals from './StudentViewSubmissionModals';

export default function StudentViewModals({
  showSettingsModal,
  setShowSettingsModal,
  isDark,
  toggleDarkMode,
  editorFontSize,
  setEditorFontSize,
  previewImage,
  setPreviewImage,
  previewVideo,
  setPreviewVideo,
  previewIframe,
  setPreviewIframe,
  showSubmitModal,
  setShowSubmitModal,
  strictCompiler,
  diagnosticsCount,
  handleConfirmSubmit,
  showUnsubmitModal,
  setShowUnsubmitModal,
  handleConfirmUnsubmit
}) {
  return (
    <>
      <StudentViewSettingsModal
        showSettingsModal={showSettingsModal}
        setShowSettingsModal={setShowSettingsModal}
        isDark={isDark}
        toggleDarkMode={toggleDarkMode}
        editorFontSize={editorFontSize}
        setEditorFontSize={setEditorFontSize}
      />

      {/* Previews */}
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

      <StudentViewSubmissionModals
        showSubmitModal={showSubmitModal}
        setShowSubmitModal={setShowSubmitModal}
        strictCompiler={strictCompiler}
        diagnosticsCount={diagnosticsCount}
        handleConfirmSubmit={handleConfirmSubmit}
        showUnsubmitModal={showUnsubmitModal}
        setShowUnsubmitModal={setShowUnsubmitModal}
        handleConfirmUnsubmit={handleConfirmUnsubmit}
        isDark={isDark}
      />
    </>
  );
}
