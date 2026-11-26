import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import Skeleton from '../Skeleton';
import ClassworkItemCard from './ClassworkItemCard';
import ClassworkUnsubmitModal from './ClassworkUnsubmitModal';
import StrictLockStartModal from '../studentActivity/StrictLockStartModal';

export default function ClassroomClassworkTab({
  visibleClasswork,
  loadingAssignments,
  expandedId,
  setExpandedId,
  submittedTasks,
  submissionTimestamps = {},
  checkedTasks = {},
  onOpenAssignment,
  onStartAssignment,
  onUnsubmitAssignment,
  setPreviewImage,
  setPreviewVideo,
  setPreviewIframe,
  isDark,
  isMobile,
  isArchived = false,
  styles
}) {
  const [unsubmittingItem, setUnsubmittingItem] = useState(null);
  const [strictLockStartItem, setStrictLockStartItem] = useState(null);

  const handleStartWithCheck = (item) => {
    const isStrict = Boolean(item?.disableBack || item?.disable_back);
    const isSub = Boolean(submittedTasks[item?.id] || submittedTasks[String(item?.id)]);
    if (isArchived && !isSub) return;
    if (isStrict && !isSub) {
      setStrictLockStartItem(item);
      return;
    }
    if (typeof onStartAssignment === 'function') {
      onStartAssignment(item);
    }
  };

  const handleConfirmUnsubmit = () => {
    if (unsubmittingItem && onUnsubmitAssignment) {
      onUnsubmitAssignment(unsubmittingItem);
    }
    setUnsubmittingItem(null);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={{ color: isDark ? '#f5f5f5' : '#1e293b', fontWeight: '700', fontSize: '1.4rem', margin: 0 }}>
            List of Classworks
          </h2>
          <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
            Access assignments, instructions, and learning activities for this class.
          </p>
        </div>
      </div>

      <div style={styles.list}>
        {loadingAssignments ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton.AssignmentRow key={i} />)
        ) : visibleClasswork.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: isDark ? '#a3a3a3' : '#94a3b8' }}>
            <BookOpen size={48} color={isDark ? '#404040' : '#cbd5e1'} style={{ margin: '0 auto 12px auto', display: 'block' }} />
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: isDark ? '#f5f5f5' : 'inherit' }}>No classwork assigned yet</p>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: isDark ? '#737373' : 'inherit' }}>Check back later once your instructor assigns new activities.</p>
          </div>
        ) : (
          visibleClasswork.map((item) => {
            const isItemSubmitted = Boolean(submittedTasks[item.id] || submittedTasks[String(item.id)]);
            const isSubmissionLoading = !isItemSubmitted && !checkedTasks[item.id] && !checkedTasks[String(item.id)];
            return (
              <ClassworkItemCard
                key={item.id}
                item={item}
                isOpen={expandedId === item.id}
                onToggle={() => setExpandedId(prev => (prev === item.id ? null : item.id))}
                isSubmitted={isItemSubmitted}
                isSubmissionLoading={isSubmissionLoading}
                submittedAt={submissionTimestamps[item.id] || submissionTimestamps[String(item.id)] || null}
                onOpenAssignment={onOpenAssignment}
                onStartAssignment={handleStartWithCheck}
                onRequestUnsubmit={setUnsubmittingItem}
                setPreviewImage={setPreviewImage}
                setPreviewVideo={setPreviewVideo}
                setPreviewIframe={setPreviewIframe}
                isDark={isDark}
                isMobile={isMobile}
                isArchived={isArchived}
                styles={styles}
              />
            );
          })
        )}
      </div>

      <ClassworkUnsubmitModal
        item={unsubmittingItem}
        isDark={isDark}
        onClose={() => setUnsubmittingItem(null)}
        onConfirm={handleConfirmUnsubmit}
      />

      <StrictLockStartModal
        isOpen={Boolean(strictLockStartItem)}
        isDark={isDark}
        assignmentTitle={strictLockStartItem?.title || 'This Activity'}
        onClose={() => setStrictLockStartItem(null)}
        onConfirm={() => {
          const target = strictLockStartItem;
          setStrictLockStartItem(null);
          if (typeof onStartAssignment === 'function' && target) {
            onStartAssignment(target);
          }
        }}
      />
    </div>
  );
}
