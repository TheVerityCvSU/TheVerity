import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen, Calendar, MoreVertical, ClipboardList, Monitor } from 'lucide-react';
import Skeleton from '../Skeleton';
import AttachmentCard from '../AttachmentCard';
import RichInstruction from '../RichInstruction';
import { formatShortDate } from '../../utils/dateUtils';

export default function TeacherClassworkTab({
  isDark,
  isMobile,
  styles,
  isClassroomArchivedState,
  openCreate,
  loadingClasswork,
  visibleClasswork,
  expandedId,
  toggleExpand,
  getActiveCountForActivity,
  getMaterialIcon,
  activeMenu,
  toggleMenu,
  handleRestoreClasswork,
  handleDeleteClasswork,
  openModify,
  handleArchive,
  handleCopy,
  expandedInstructionId,
  setExpandedInstructionId,
  handleInstructionClick,
  setPreviewImage,
  setPreviewVideo,
  setPreviewIframe,
  submissionData,
  enrolledStudents,
  classroom,
  activeTab,
  onOpenGrading,
  setSelectedGradingActivityId,
  handleTabChange,
  onOpenPlayback,
  onStartMonitoring
}) {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={{ color: isDark ? '#E8EAED' : '#1e293b', fontWeight: '700', fontSize: '1.4rem', margin: 0 }}>
            List of Classworks
          </h2>
          <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
            Create and organize assignments, questions, and learning activities for this class.
          </p>
        </div>
        {!isClassroomArchivedState && (
          <div>
            <button onClick={() => openCreate()} style={styles.addButton} className="btn-anim">
              <Plus size={18} style={{ marginRight: '6px' }} /> Create
            </button>
          </div>
        )}
      </div>

      {/* List of Classwork */}
      <div style={styles.list}>
        {loadingClasswork ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton.AssignmentRow key={i} />)
        ) : visibleClasswork.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: isDark ? '#a3a3a3' : '#94a3b8' }}>
            <BookOpen size={48} color={isDark ? '#4A4A4A' : '#cbd5e1'} style={{ margin: '0 auto 12px auto', display: 'block' }} />
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>No classwork yet</p>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>Click "Create" to assign new work to your students.</p>
          </div>
        ) : (
          visibleClasswork.map((item, index) => {
            const isOpen = String(expandedId) === String(item.id);
            const due = formatShortDate(item.dueDate);
            const posted = formatShortDate(item.posted || (typeof item.id === 'number' && item.id > 1e12 ? item.id : null));
            const itemActiveCount = getActiveCountForActivity(item);
            const IconComp = getMaterialIcon(item);

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                style={styles.itemWrapper}
              >
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
                      position: 'relative',
                      overflow: 'visible'
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
                    {itemActiveCount > 0 && (
                      <span
                        title={`${itemActiveCount} student${itemActiveCount > 1 ? 's' : ''} currently working on this activity`}
                        style={{
                          position: 'absolute',
                          top: '-4px',
                          left: '-4px',
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          boxShadow: isDark
                            ? `0 0 0 2.5px ${isOpen ? '#242a2b' : '#1e2324'}, 0 0 12px #10b981`
                            : `0 0 0 2.5px ${isOpen ? '#f1f5f9' : '#f8fafc'}, 0 0 12px #10b981`,
                          animation: 'live-pulse 1.8s infinite',
                          zIndex: 40,
                          pointerEvents: 'auto'
                        }}
                      />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#dcfce7', border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginRight: '16px', flexShrink: 0 }}>
                        <IconComp size={18} />
                      </div>

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
                      {due ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isDark ? '#a7f3d0' : '#059669', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5', padding: '5px 12px', borderRadius: '8px', fontWeight: '600' }}>
                          <Calendar size={12} /> Due {due}
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
                                    <div style={styles.dropdownItem} onClick={(e) => handleCopy(e, item)}>Copy</div>
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
                          <ClipboardList size={30} color={isDark ? '#10b981' : '#4b5563'} />
                          <div>
                            <div style={styles.detailTitle}>{item.title}</div>
                            <div style={styles.detailDue}>{due ? `Due ${due}` : 'No Due Date'} • {item.points || 100} points</div>
                          </div>
                        </div>

                        <div style={{
                          ...styles.detailBody,
                          flexDirection: isMobile ? 'column' : 'row',
                          alignItems: isMobile ? 'stretch' : 'flex-start',
                          padding: isMobile ? '5px 20px 18px 20px' : styles.detailBody.padding
                        }}>
                          <div style={styles.detailLeft}>
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
                                        View activity details...
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

                          <div style={{
                            ...styles.detailStats,
                            paddingLeft: isMobile ? 0 : styles.detailStats.paddingLeft,
                            paddingTop: isMobile ? '12px' : 0,
                            borderTop: isMobile ? (isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0') : 'none',
                            width: isMobile ? '100%' : 'auto',
                            justifyContent: isMobile ? 'flex-start' : 'flex-end'
                          }}>
                            <div style={{ ...styles.statCol, padding: isMobile ? '0 20px 0 0' : styles.statCol.padding }}>
                              <span style={styles.statNum}>{submissionData.counts[item.id] || 0}</span>
                              <span style={styles.statLabel}>Turned in</span>
                            </div>
                            <div style={styles.statColDivider} />
                            <div style={styles.statCol}>
                              <span style={styles.statNum}>{enrolledStudents.length || submissionData.studentCount || 0}</span>
                              <span style={styles.statLabel}>Assigned</span>
                            </div>
                          </div>
                        </div>

                        <div style={styles.detailDivider} />

                        <div style={{
                          ...styles.detailFooter,
                          flexDirection: isMobile ? 'column' : 'row',
                          alignItems: isMobile ? 'stretch' : 'center',
                          padding: isMobile ? '14px 20px' : '16px 28px'
                        }}>
                          <span
                            style={{
                              ...styles.viewActivityLink,
                              display: 'inline-flex',
                              alignItems: 'center',
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              try {
                                sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, activeTab);
                                sessionStorage.setItem('verity_teacher_classwork_tab_active', activeTab);
                              } catch {}
                              if (onOpenGrading) onOpenGrading(item);
                              else {
                                setSelectedGradingActivityId(item.id);
                                handleTabChange('grades');
                              }
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                            title="Open activity details and grade student submissions"
                          >
                            View Activity & Grading
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
                            <span
                              style={{
                                color: isDark ? '#c084fc' : '#7c3aed',
                                fontSize: '0.92rem',
                                cursor: 'pointer',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                try {
                                  sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, activeTab);
                                  sessionStorage.setItem('verity_teacher_classwork_tab_active', activeTab);
                                } catch {}
                                onOpenPlayback && onOpenPlayback(item, null);
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                              title="Open VCR replay & student recordings"
                            >
                              Replay Playback
                            </span>
                            {!isClassroomArchivedState && (
                              <button
                                style={{
                                  ...styles.liveMonitorBtn,
                                  width: isMobile ? '100%' : 'auto',
                                  justifyContent: 'center'
                                }}
                                className="btn-anim"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  try {
                                    sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, activeTab);
                                    sessionStorage.setItem('verity_teacher_classwork_tab_active', activeTab);
                                  } catch {}
                                  onStartMonitoring && onStartMonitoring(item);
                                }}
                                title="Open live proctoring & monitoring"
                              >
                                <Monitor size={16} /> Live Monitoring
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
