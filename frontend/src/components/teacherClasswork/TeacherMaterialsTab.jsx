import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FileText, Video, Link2, MoreVertical } from 'lucide-react';
import Skeleton from '../Skeleton';
import AttachmentCard from '../AttachmentCard';
import RichInstruction from '../RichInstruction';
import { getLessonType } from '../../utils/lessonType';
import { formatShortDate } from '../../utils/dateUtils';

export default function TeacherMaterialsTab({
  isDark,
  isMobile,
  styles,
  isClassroomArchivedState,
  openCreate,
  loadingClasswork,
  visibleMaterials,
  expandedId,
  toggleExpand,
  activeMenu,
  toggleMenu,
  handleRestoreClasswork,
  handleDeleteClasswork,
  openModify,
  handleArchive,
  expandedInstructionId,
  setExpandedInstructionId,
  handleInstructionClick,
  setPreviewImage,
  setPreviewVideo,
  setPreviewIframe,
  setViewingMaterialModal
}) {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0', paddingBottom: '18px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontWeight: '700', fontSize: '1.4rem' }}>
            List of Materials
          </h2>
          <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
            Upload and manage resources, syllabus, and study guides for this classroom.
          </p>
        </div>
        {!isClassroomArchivedState && (
          <div>
            <button onClick={() => openCreate('Material')} style={styles.addButton} className="btn-anim">
              <Plus size={18} style={{ marginRight: '6px' }} /> Create
            </button>
          </div>
        )}
      </div>
      <div style={{ ...styles.list, padding: '0 0 40px 0' }}>
        {loadingClasswork ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton.AssignmentRow key={i} />)
        ) : visibleMaterials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: isDark ? '#a3a3a3' : '#94a3b8' }}>
            <FileText size={48} color={isDark ? '#4A4A4A' : '#cbd5e1'} style={{ margin: '0 auto 12px auto', display: 'block' }} />
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>No materials uploaded yet</p>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>Use the Create button to upload syllabus, readings, and reference documents.</p>
          </div>
        ) : (
          visibleMaterials.map((item) => {
            const isOpen = String(expandedId) === String(item.id);
            const posted = formatShortDate(item.posted || (typeof item.id === 'number' && item.id > 1e12 ? item.id : null));
            const lessonType = getLessonType(item);

            return (
              <div key={item.id} style={styles.itemWrapper}>
                <div style={styles.itemHeader}>
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderRadius: '12px',
                      backgroundColor: isDark ? (isOpen ? '#242a2b' : '#1e2324') : (isOpen ? '#f1f5f9' : '#f8fafc'),
                      border: isDark ? (isOpen ? '1px solid #444c4f' : '1px solid #2d3335') : (isOpen ? '1px solid #cbd5e1' : '1px solid #e2e8f0'),
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onClick={() => toggleExpand(item.id)}
                    onMouseOver={(e) => {
                      if (isDark && !isOpen) {
                        e.currentTarget.style.backgroundColor = '#242a2b';
                        e.currentTarget.style.borderColor = '#383e40';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (isDark && !isOpen) {
                        e.currentTarget.style.backgroundColor = '#1e2324';
                        e.currentTarget.style.borderColor = '#2d3335';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      {(() => {
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
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: bg, border: isDark ? `1px solid ${color}40` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color, marginRight: '16px', flexShrink: 0 }}>
                            {lessonType === 'video' ? <Video size={18} /> : lessonType === 'link' ? <Link2 size={18} /> : <FileText size={18} />}
                          </div>
                        );
                      })()}

                      <span style={{ color: isDark ? '#f5f5f5' : '#1e293b', fontSize: '1.05rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                      {(item.deleted || item.archived) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: isDark ? '#fca5a5' : '#b91c1c', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : '#fef2f2', border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fecaca', padding: '4px 10px', borderRadius: '9999px', fontWeight: '700' }}>
                          {item.deleted ? 'Deleted' : 'Archived'}
                        </span>
                      )}
                      {posted ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isDark ? '#a7f3d0' : '#059669', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5', padding: '5px 12px', borderRadius: '8px', fontWeight: '600' }}>
                          Posted {posted}
                        </span>
                      ) : null}

                      {!isClassroomArchivedState && (
                        <>
                          <div style={{ width: '1px', height: '24px', backgroundColor: isDark ? '#3d4447' : '#e2e8f0' }} />

                          <div
                            style={{
                              ...styles.threeDots,
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background 0.15s ease'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMenu(e, item.id);
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <MoreVertical size={18} color={isDark ? '#a3a3a3' : '#64748b'} />
                            {activeMenu === item.id && (
                              <div style={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                                {(item.deleted || item.archived) ? (
                                  <>
                                    <div style={styles.dropdownItem} onClick={(e) => handleRestoreClasswork(e, item.id)}>Restore</div>
                                    <div style={{ ...styles.dropdownItem, color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); handleDeleteClasswork(e, item.id); }}>Delete Forever</div>
                                  </>
                                ) : (
                                  <>
                                    <div style={styles.dropdownItem} onClick={(e) => openModify(e, item)}>Modify</div>
                                    <div style={styles.dropdownItem} onClick={(e) => handleArchive(e, item.id)}>Archive</div>
                                    <div style={{ ...styles.dropdownItem, color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); handleDeleteClasswork(e, item.id); }}>Delete</div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="detail"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={styles.detailCard}>
                        <div style={styles.detailHeaderBar}>
                          {lessonType === 'video' ? (
                            <Video size={30} color={isDark ? '#fbbf24' : '#d97706'} />
                          ) : lessonType === 'link' ? (
                            <Link2 size={30} color={isDark ? '#38bdf8' : '#0284c7'} />
                          ) : (
                            <FileText size={30} color={isDark ? '#10b981' : '#059669'} />
                          )}
                          <div>
                            <div style={styles.detailTitle}>{item.title}</div>
                          </div>
                        </div>

                        <div style={styles.detailBody}>
                          <div style={{ ...styles.detailLeft, flex: '1 1 100%' }}>
                            {posted && <div style={styles.postedText}>Posted {posted}</div>}
                            {item.details ? (
                              (() => {
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
                              })()
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
                            )}
                          </div>
                        </div>

                        <div style={styles.detailDivider} />

                        <div style={{
                          ...styles.detailFooter,
                          flexDirection: isMobile ? 'column' : 'row',
                          alignItems: isMobile ? 'stretch' : 'center',
                          padding: isMobile ? '14px 20px' : '16px 28px'
                        }}>
                          <button
                            style={{
                              ...styles.viewGradingBtn,
                              width: isMobile ? '100%' : 'auto',
                              justifyContent: 'center'
                            }}
                            className="btn-anim"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingMaterialModal(item);
                            }}
                            title="View full material details"
                          >
                            <FileText size={16} /> View Material Details
                          </button>
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
