import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Video, Link2, FileText, Edit3 } from 'lucide-react';
import { getLessonType } from '../../utils/lessonType';
import ImagePreviewModal from '../ImagePreviewModal';
import AddLinkModal from '../AddLinkModal';
import VideoPreviewModal from '../VideoPreviewModal';
import IframePreviewModal from '../IframePreviewModal';
import AddStudentModal from '../AddStudentModal';
import PasteAsCodeModal from '../PasteAsCodeModal';
import AttachmentCard from '../AttachmentCard';
import RichInstruction from '../RichInstruction';
import ArchiveConfirmModal from '../ArchiveConfirmModal';

/**
 * Renders media preview overlays, paste-as-code prompt, add-student modal,
 * delete/archive confirmation dialogs, and the material details viewer modal.
 */
export default function TeacherClassworkDetailModals({
  isDark,
  styles,
  classroomId,
  classCode,
  isClassroomArchivedState,
  previewImage,
  setPreviewImage,
  isLinkModalOpen,
  setIsLinkModalOpen,
  handleSaveLink,
  previewVideo,
  setPreviewVideo,
  previewIframe,
  setPreviewIframe,
  pasteCodeModal,
  setPasteCodeModal,
  isAddStudentOpen,
  setIsAddStudentOpen,
  onStudentAdded,
  deleteClassworkConfirm,
  setDeleteClassworkConfirm,
  handleExecuteDeleteClasswork,
  archiveClassworkConfirm,
  setArchiveClassworkConfirm,
  handleExecuteArchiveClasswork,
  viewingMaterialModal,
  setViewingMaterialModal,
  handleInstructionClick,
  openModify
}) {
  return (
    <>
      {previewImage && (
        <ImagePreviewModal src={previewImage.url} alt={previewImage.name} onClose={() => setPreviewImage(null)} />
      )}

      <AddLinkModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} onAdd={handleSaveLink} isDark={isDark} />

      {previewVideo && (
        <VideoPreviewModal src={previewVideo.url} name={previewVideo.name} onClose={() => setPreviewVideo(null)} />
      )}

      {previewIframe && (
        <IframePreviewModal url={previewIframe.url} title={previewIframe.name} type={previewIframe.type} onClose={() => setPreviewIframe(null)} />
      )}

      <PasteAsCodeModal
        isOpen={Boolean(pasteCodeModal)}
        isDark={isDark}
        data={pasteCodeModal}
        onPasteCode={() => {
          if (pasteCodeModal?.callback) pasteCodeModal.callback('as-code');
          setPasteCodeModal(null);
        }}
        onPasteHtml={() => {
          if (pasteCodeModal?.callback) pasteCodeModal.callback('as-html');
          setPasteCodeModal(null);
        }}
        onPasteText={() => {
          if (pasteCodeModal?.callback) pasteCodeModal.callback('as-text');
          setPasteCodeModal(null);
        }}
        onPasteOnlyText={() => {
          if (pasteCodeModal?.callback) pasteCodeModal.callback('only-text');
          setPasteCodeModal(null);
        }}
        onClose={() => {
          if (pasteCodeModal?.callback) {
            try { pasteCodeModal.callback('cancel'); } catch {}
          }
          setPasteCodeModal(null);
        }}
      />

      <AddStudentModal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        classroomId={classroomId}
        classCode={classCode}
        onSuccess={onStudentAdded}
        isDark={isDark}
      />

      <AnimatePresence>
        {deleteClassworkConfirm && (
          <div
            className="fixed inset-0 flex items-center justify-center p-5 z-[99999]"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: isDark ? 'rgba(17, 17, 17, 0.75)' : 'rgba(235, 235, 235, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              backdropFilter: 'blur(5px)',
              padding: '20px'
            }}
            onClick={() => setDeleteClassworkConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[440px] text-left rounded-3xl p-7 shadow-2xl relative"
              style={{
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                border: isDark ? '1px solid #2C2C2E' : '1px solid #E5E7EB',
                borderRadius: '24px',
                padding: '28px',
                maxWidth: '440px',
                width: '100%',
                textAlign: 'left',
                boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 20px 40px -10px rgba(0, 0, 0, 0.12)',
                position: 'relative'
              }}
            >
              <button
                type="button"
                onClick={() => setDeleteClassworkConfirm(null)}
                aria-label="Close dialog"
                style={{
                  position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none',
                  color: isDark ? '#9CA3AF' : '#64748B', cursor: 'pointer', padding: '6px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.15s ease, color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#2C2C2E' : '#F1F5F9';
                  e.currentTarget.style.color = isDark ? '#F3F4F6' : '#0F172A';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = isDark ? '#9CA3AF' : '#64748B';
                }}
              >
                <X size={18} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', paddingRight: '28px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isDark ? '#F87171' : '#DC2626', flexShrink: 0
                }}>
                  <AlertTriangle size={22} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: isDark ? '#F9FAFB' : '#111827', textAlign: 'left' }}>
                    Delete classwork?
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: isDark ? '#9CA3AF' : '#64748B' }}>
                    Permanent removal confirmation
                  </p>
                </div>
              </div>

              <div className="text-left" style={{ marginBottom: '24px', color: isDark ? '#D1D5DB' : '#374151', fontSize: '0.9rem', lineHeight: '1.55', textAlign: 'left' }}>
                <p style={{ margin: 0 }}>
                  Are you sure you want to permanently delete{' '}
                  <span className="font-semibold" style={{ fontWeight: 600, color: isDark ? '#F87171' : '#DC2626' }}>
                    {deleteClassworkConfirm.title}
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>

              <div className="flex justify-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setDeleteClassworkConfirm(null)}
                  style={{
                    padding: '9px 18px', borderRadius: '10px', border: isDark ? '1px solid #3A3A3C' : '1px solid #D1D5DB',
                    backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', color: isDark ? '#D1D5DB' : '#374151',
                    fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#3A3A3C' : '#F3F4F6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#2C2C2E' : '#FFFFFF'; }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDeleteClasswork}
                  style={{
                    padding: '9px 20px', borderRadius: '10px', border: 'none', backgroundColor: '#DC2626', color: '#FFFFFF',
                    fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)', transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#B91C1C'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#DC2626'; }}
                >
                  Delete classwork
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ArchiveConfirmModal
        isOpen={Boolean(archiveClassworkConfirm)}
        itemName={archiveClassworkConfirm?.title}
        title={archiveClassworkConfirm?.itemType === 'material' ? 'Archive material?' : 'Archive activity?'}
        subtitle="Hide from active classwork and stream"
        confirmLabel={archiveClassworkConfirm?.itemType === 'material' ? 'Archive material' : 'Archive activity'}
        description={
          <p style={{ margin: 0 }}>
            Are you sure you want to archive{' '}
            <span style={{ fontWeight: 600, color: isDark ? '#FBBF24' : '#B45309' }}>
              {archiveClassworkConfirm?.title || 'this item'}
            </span>
            ? It will be hidden from the active classroom stream and classwork list.
          </p>
        }
        isDark={isDark}
        onCancel={() => setArchiveClassworkConfirm(null)}
        onConfirm={handleExecuteArchiveClasswork}
      />

      <AnimatePresence>
        {viewingMaterialModal && (
          <div
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(5px)', padding: '20px'
            }}
            onClick={() => setViewingMaterialModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ ...styles.modalCard, maxWidth: '750px', padding: '32px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '12px',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0
                  }}>
                    {(() => {
                      const lType = getLessonType(viewingMaterialModal);
                      if (lType === 'video') return <Video size={24} color={isDark ? '#fbbf24' : '#d97706'} />;
                      if (lType === 'link') return <Link2 size={24} color={isDark ? '#38bdf8' : '#0284c7'} />;
                      return <FileText size={24} color="#10b981" />;
                    })()}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      MATERIAL DETAILS
                    </span>
                    <h2 style={{ margin: '2px 0 0 0', fontSize: '1.4rem', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a', wordBreak: 'break-word' }}>
                      {viewingMaterialModal.title}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setViewingMaterialModal(null)}
                  style={{ ...styles.closeModalBtn, padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {(() => {
                const rawDetails = String(viewingMaterialModal.details || '');
                const hasMedia = /<(img|video|iframe|svg|audio|embed|object)\b/i.test(rawDetails);
                const plainText = rawDetails.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
                if (!hasMedia && !plainText) return null;
                return (
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                      Material Content & Description
                    </h4>
                    <div style={{
                      backgroundColor: isDark ? '#262626' : '#ffffff', border: isDark ? '1px solid #3e3e3e' : '1px solid #e2e8f0',
                      borderRadius: '12px', padding: '20px', maxHeight: '520px', overflowY: 'auto'
                    }}>
                      <RichInstruction
                        html={viewingMaterialModal.details}
                        style={{ color: isDark ? '#d1d5db' : '#334155', fontSize: '0.95rem', lineHeight: 1.6 }}
                        onClick={handleInstructionClick}
                      />
                    </div>
                  </div>
                );
              })()}

              {viewingMaterialModal.attachments?.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                    Attached Resources ({viewingMaterialModal.attachments.length})
                  </h4>
                  <div style={styles.cardAttachments}>
                    {viewingMaterialModal.attachments.map((att, i) => (
                      <AttachmentCard
                        key={i}
                        att={att}
                        isDark={isDark}
                        onClick={(clickedAtt) => {
                          const targetName = (clickedAtt.name || clickedAtt.url || '').toLowerCase();
                          const isImg = clickedAtt.type === 'image' || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(targetName);
                          const isVid = clickedAtt.type === 'video' || /\.(mp4|webm|mov|m4v|mkv|avi)(\?.*)?$/i.test(targetName);
                          if (isImg) setPreviewImage(clickedAtt);
                          else if (isVid) setPreviewVideo(clickedAtt);
                          else setPreviewIframe(clickedAtt);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: isDark ? '1px solid #3e3e3e' : '1px solid #e2e8f0' }}>
                <button type="button" onClick={() => setViewingMaterialModal(null)} style={styles.cancelBtn}>
                  Close
                </button>
                {!isClassroomArchivedState && (
                  <button
                    type="button"
                    onClick={(e) => {
                      const toEdit = viewingMaterialModal;
                      setViewingMaterialModal(null);
                      openModify(e, toEdit);
                    }}
                    style={{ ...styles.saveGradeBtn, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Edit3 size={15} /> Edit Material
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
