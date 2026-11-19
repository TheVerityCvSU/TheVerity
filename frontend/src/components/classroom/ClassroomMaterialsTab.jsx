import React from 'react';
import { FileText, Video, Link2, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Skeleton from '../Skeleton';
import AttachmentCard from '../AttachmentCard';
import RichInstruction from '../RichInstruction';
import { formatShortDate } from '../../utils/dateUtils';
import { getLessonType } from '../../utils/lessonType';

export default function ClassroomMaterialsTab({
  visibleMaterials,
  loadingAssignments,
  expandedId,
  setExpandedId,
  expandedInstructionId,
  setExpandedInstructionId,
  onOpenAssignment,
  onMarkMaterialSeen,
  handleInstructionClick,
  setPreviewImage,
  setPreviewVideo,
  setPreviewIframe,
  classroom,
  isDark,
  styles
}) {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Header with Widow Prevention & Line Length Constraints */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0', paddingBottom: '18px', marginBottom: '24px' }}>
        <div>
          <h2
            style={{
              margin: 0,
              color: isDark ? '#E8EAED' : '#1e293b',
              fontWeight: '700',
              fontSize: '1.4rem',
              lineHeight: 1.2,
              textWrap: 'balance'
            }}
            className="heading-balanced"
          >
            List of Materials
          </h2>
          <p
            style={{
              margin: '4px 0 0 0',
              color: isDark ? '#a3a3a3' : '#64748b',
              fontSize: '0.85rem',
              lineHeight: 1.58,
              maxWidth: '65ch',
              textWrap: 'pretty'
            }}
            className="prose-pretty max-w-prose"
          >
            Access syllabus, study guides, and resources uploaded by your instructor.
          </p>
        </div>
      </div>

      <div style={{ ...styles.list, padding: '0 0 40px 0' }} className="stagger-grid">
        {loadingAssignments ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton.AssignmentRow key={i} />)
        ) : visibleMaterials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: isDark ? '#a3a3a3' : '#94a3b8' }}>
            <FileText size={48} color={isDark ? '#404040' : '#cbd5e1'} style={{ margin: '0 auto 12px auto', display: 'block' }} />
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: isDark ? '#f5f5f5' : 'inherit' }}>No materials available</p>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: isDark ? '#737373' : 'inherit', textWrap: 'pretty', maxWidth: '65ch' }}>Check back later once your instructor uploads course resources.</p>
          </div>
        ) : (
          visibleMaterials.map((item, index) => {
            const isOpen = String(expandedId) === String(item.id);
            const posted = formatShortDate(item.posted || (typeof item.id === 'number' && item.id > 1e12 ? item.id : null));

            {/* Principle 16: Optimistic Toggle with instantaneous responsiveness */}
            const handleItemClick = () => {
              const nextId = isOpen ? null : item.id;
              setExpandedId(nextId);
              if (onMarkMaterialSeen) {
                try {
                  onMarkMaterialSeen(item.id);
                } catch (e) {
                  console.error('Optimistic mark seen error:', e);
                }
              }
            };

            return (
              <div
                key={item.id}
                style={{
                  ...styles.itemWrapper,
                  animationDelay: `${index * 40}ms` // Principle 18: Stagger (30ms-50ms)
                }}
              >
                <div style={styles.itemHeader}>
                  <div
                    style={{
                      width: '100%',
                      minHeight: '48px', // Principle 10: Touch Target
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderRadius: '12px',
                      backgroundColor: isDark ? (isOpen ? '#242a2b' : '#1e2324') : (isOpen ? '#f1f5f9' : '#f8fafc'),
                      border: isDark ? (isOpen ? '1px solid #444c4f' : '1px solid #2d3335') : (isOpen ? '1px solid #cbd5e1' : '1px solid #e2e8f0'),
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    className="clickable-affordance"
                    onClick={handleItemClick}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {(() => {
                        const lessonType = getLessonType(item);
                        let bg = isDark ? 'rgba(16, 185, 129, 0.12)' : '#dcfce7';
                        let color = '#10b981';
                        if (lessonType === 'video') {
                          bg = isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7';
                          color = isDark ? '#fbbf24' : '#d97706';
                        } else if (lessonType === 'link') {
                          bg = isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe';
                          color = isDark ? '#38bdf8' : '#0284c7';
                        }
                        return (
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: bg, border: isDark ? `1px solid ${color}40` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, marginRight: '16px', flexShrink: 0 }}>
                            {lessonType === 'video' ? <Video size={18} className="icon-optical-play" /> : lessonType === 'link' ? <Link2 size={18} /> : <FileText size={18} />}
                          </div>
                        );
                      })()}
                      <span style={{ color: isDark ? '#f5f5f5' : '#1e293b', fontSize: '1.05rem', fontWeight: '700', textWrap: 'balance' }}>
                        {item.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      {posted ? (
                        <span
                          className="tabular-nums"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.75rem',
                            color: isDark ? '#a7f3d0' : '#059669',
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5',
                            border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5',
                            padding: '5px 12px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          Posted {posted}
                        </span>
                      ) : null}
                      <div style={{ width: '1px', height: '24px', backgroundColor: isDark ? '#3d4447' : '#e2e8f0' }} />
                      {/* Principle 2: Optical centering on toggle arrow */}
                      <div
                        style={{
                          color: '#34d399',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: isOpen ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
                          marginRight: '20px'
                        }}
                      >
                        <ArrowUpRight size={18} className="icon-optical-right" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Principle 19: Interruptible Spring Animation */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="detail"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={styles.detailCard}>
                        <div style={styles.detailHeaderBar}>
                          {(() => {
                            const lessonType = getLessonType(item);
                            if (lessonType === 'video') return <Video size={30} color={isDark ? '#fbbf24' : '#d97706'} />;
                            if (lessonType === 'link') return <Link2 size={30} color={isDark ? '#38bdf8' : '#0284c7'} />;
                            return <FileText size={30} color={isDark ? '#10b981' : '#059669'} />;
                          })()}
                          <div>
                            <div style={styles.detailTitle}>{item.title}</div>
                          </div>
                        </div>

                        <div style={styles.detailBody}>
                          <div style={{ ...styles.detailLeft, flex: '1 1 100%' }}>
                            {posted && <div style={styles.postedText}>Posted {posted}</div>}
                            {item.details ? (
                              <>
                                {(() => {
                                  const hasMedia = /<(video|iframe|audio)/i.test(item.details || '');
                                  const isClamped = !hasMedia && expandedInstructionId !== item.id;
                                  const textLength = typeof item.details === 'string' ? item.details.replace(/<[^>]*>?/gm, '').length : 0;
                                  const canToggle = !hasMedia && textLength > 100;

                                  return (
                                    <>
                                      <div
                                        style={{
                                          ...styles.detailInstruction,
                                          whiteSpace: 'normal',
                                          ...(isClamped ? {
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                          } : {
                                            display: 'block'
                                          })
                                        }}
                                        onClick={handleInstructionClick}
                                      >
                                        <RichInstruction html={item.details} />
                                      </div>
                                      {canToggle && expandedInstructionId !== item.id && (
                                        <div
                                          style={{ color: '#10b981', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '6px' }}
                                          onClick={(e) => { e.stopPropagation(); setExpandedInstructionId(item.id); }}
                                        >
                                          View details...
                                        </div>
                                      )}
                                      {canToggle && expandedInstructionId === item.id && (
                                        <div
                                          style={{ color: '#10b981', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '6px' }}
                                          onClick={(e) => { e.stopPropagation(); setExpandedInstructionId(null); }}
                                        >
                                          Show less
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </>
                            ) : (
                              <p style={styles.detailInstruction}>No instructions provided.</p>
                            )}

                            {item.attachments?.length > 0 && (
                              <div style={styles.cardAttachments}>
                                {item.attachments.map((att, i) => (
                                  <AttachmentCard
                                    key={i}
                                    att={att}
                                    isDark={isDark}
                                    onClick={(clickedAtt) => {
                                      onMarkMaterialSeen(item.id);
                                      if (clickedAtt.type === 'image') setPreviewImage(clickedAtt);
                                      else if (clickedAtt.type === 'video') setPreviewVideo(clickedAtt);
                                      else if (clickedAtt.type === 'document' || (clickedAtt.type === 'link' && clickedAtt.url)) {
                                        setPreviewIframe(clickedAtt);
                                      }
                                    }}
                                  />
                                ))}
                              </div>
                            )}

                            <div style={{ height: '1px', backgroundColor: isDark ? '#3E3E3E' : '#e2e8f0', margin: '22px 0 16px 0' }} />

                            <div>
                              <span
                                style={{ ...styles.viewActivityLink, display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                onClick={() => {
                                  onMarkMaterialSeen(item.id);
                                  try {
                                    if (classroom?.id) sessionStorage.setItem(`verity_student_classroom_tab_${classroom.id}`, 'materials');
                                    sessionStorage.setItem('verity_student_classroom_tab_active', 'materials');
                                    sessionStorage.setItem(`verity_student_tab_${classroom?.id}`, 'materials');
                                    sessionStorage.setItem('verity_student_tab_active', 'materials');
                                  } catch (_) {}
                                  onOpenAssignment(item);
                                }}
                              >
                                View Material Details <ArrowUpRight size={16} />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
