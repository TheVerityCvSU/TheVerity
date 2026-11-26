import { motion, AnimatePresence } from 'framer-motion';
import { Archive, RefreshCw, Edit3, MoreHorizontal, Paperclip } from 'lucide-react';
import ClassroomBannerIllustration from '../ClassroomBannerIllustration';
import Skeleton from '../Skeleton';
import { isClassroomArchived } from '../../utils/classroomList';
import { getLessonType } from '../../utils/lessonType';
import { formatShortDate } from '../../utils/dateUtils';

export default function TeacherStreamTab({
  isMobile,
  isDark,
  ui,
  sectionLabelStyle,
  smallIconBtnStyle,
  isClassroomArchivedState,
  bannerTheme,
  displayClassroom,
  classroom,
  classroomDirection,
  classroomSlideVariants,
  activeClassrooms,
  sidebarClassrooms,
  badgeColors,
  handleUnarchiveCurrentClassroom,
  setOriginalBannerTheme,
  setIsCustomizeOpen,
  handleSelectClassroom,
  loadingClasswork,
  filteredStreamItems,
  visibleStreamItems,
  streamFallbackNow,
  classSettings,
  isMaterialItem,
  getMaterialIcon,
  getActiveCountForActivity,
  renderTeacherAvatar,
  handleTabChange,
  setExpandedId
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? '24px' : '32px',
      alignItems: 'flex-start',
      width: '100%'
    }}>
      {/* LEFT COLUMN: Classroom card + Teaching list */}
      <aside style={{
        width: isMobile ? '100%' : '280px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        position: isMobile ? 'static' : 'sticky',
        top: '20px'
      }}>
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: '16px',
          padding: isMobile ? '20px' : '24px 20px',
          minHeight: isMobile ? '200px' : '260px',
          display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
          border: isClassroomArchivedState ? '1px dashed rgba(148, 163, 184, 0.55)' : 'none',
          boxShadow: isDark ? '0 18px 40px -18px rgba(0,0,0,0.7)' : '0 14px 30px -16px rgba(15,23,42,0.35)'
        }}>
          {/* Background theme layer (desaturated when archived) */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: bannerTheme?.customImageUrl
              ? `url(${bannerTheme.customImageUrl}) center/cover no-repeat`
              : `linear-gradient(150deg, ${bannerTheme?.primary || '#137333'}, ${bannerTheme?.secondary || '#1e8e3e'})`,
            filter: isClassroomArchivedState ? 'grayscale(65%) saturate(0.5) brightness(0.84)' : 'none',
            zIndex: 0
          }} />
          {isClassroomArchivedState && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.42)',
              pointerEvents: 'none',
              zIndex: 0
            }} />
          )}

          {/* Decorative rings */}
          <div style={{ position: 'absolute', top: '-70px', right: '-70px', width: '210px', height: '210px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.14)', pointerEvents: 'none', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: '-24px', right: '-24px', width: '120px', height: '120px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', pointerEvents: 'none', zIndex: 1 }} />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.88)' }}>
              Your classroom
            </span>
            {isClassroomArchivedState && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255,255,255,0.28)',
                color: '#f8fafc',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.05em'
              }}>
                <Archive size={11} /> ARCHIVED
              </span>
            )}
          </div>

          {!bannerTheme?.customImageUrl && (
            <div style={{
              position: 'absolute',
              right: '-10px',
              top: '10px',
              width: '210px',
              height: '165px',
              pointerEvents: 'none',
              zIndex: 1,
              overflow: 'hidden',
              filter: isClassroomArchivedState ? 'grayscale(65%)' : 'none'
            }}>
              <ClassroomBannerIllustration
                themeId={bannerTheme?.id || 'emerald_books'}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          )}

          <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
            <h1 style={{ fontSize: isMobile ? '1.8rem' : '2rem', fontWeight: 500, color: bannerTheme.textColor || 'white', margin: '0 0 6px', wordBreak: 'break-word', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
              {displayClassroom?.name || 'Verity'}
            </h1>
            <div style={{ fontSize: '0.78rem', color: bannerTheme.textColor || 'white', opacity: 0.85 }}>
              {displayClassroom?.section || displayClassroom?.subject || displayClassroom?.name || ''}
            </div>
            {displayClassroom?.description && (
              <div style={{
                marginTop: '6px',
                fontSize: '0.74rem',
                color: bannerTheme.textColor || 'white',
                opacity: 0.78,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {displayClassroom.description}
              </div>
            )}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.22)', margin: '14px 0 12px' }} />
            {isClassroomArchivedState ? (
              <button
                className="vt-customize"
                onClick={handleUnarchiveCurrentClassroom}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: bannerTheme.textColor || 'white', cursor: 'pointer', padding: 0, fontSize: '0.78rem', fontWeight: 600, opacity: 0.92, fontFamily: 'inherit' }}
              >
                <RefreshCw size={13} /> Unarchive Classroom
              </button>
            ) : (
              <button
                className="vt-customize"
                onClick={() => { setOriginalBannerTheme(bannerTheme); setIsCustomizeOpen(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: bannerTheme.textColor || 'white', cursor: 'pointer', padding: 0, fontSize: '0.78rem', fontWeight: 600, opacity: 0.92, fontFamily: 'inherit' }}
              >
                <Edit3 size={13} /> Customize
              </button>
            )}
          </div>
        </div>

        {/* CLASSROOMS LIST */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', marginBottom: '10px' }}>
            <span style={sectionLabelStyle}>Classrooms</span>
            <span style={{ ...sectionLabelStyle, color: ui.faint }}>{String(activeClassrooms.length).padStart(2, '0')}</span>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'row' : 'column',
            gap: isMobile ? '8px' : '4px',
            overflowX: isMobile ? 'auto' : 'visible',
            paddingBottom: isMobile ? '6px' : '0'
          }}>
            {sidebarClassrooms.map((cls, idx) => {
              const active = String(classroom?.id) === String(cls.id);
              const badgeColor = badgeColors[idx % badgeColors.length];
              const clsName = cls.name || 'Untitled';
              const clsArchived = isClassroomArchived(cls);
              return (
                <button
                  key={cls.id}
                  className="vt-class-row"
                  onClick={() => handleSelectClassroom(cls, idx)}
                  title={active ? `${clsName} (Current classroom)` : `Switch to ${clsName}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px',
                    width: isMobile ? 'auto' : '100%',
                    minWidth: isMobile ? '160px' : 'auto',
                    flexShrink: 0,
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    background: active
                      ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.75)')
                      : 'transparent',
                    backdropFilter: active ? 'blur(12px)' : 'none',
                    WebkitBackdropFilter: active ? 'blur(12px)' : 'none',
                    border: active
                      ? (isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.08)')
                      : '1px solid transparent',
                    boxShadow: active
                      ? (isDark ? '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12)' : '0 4px 12px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)')
                      : 'none',
                    color: active ? ui.text : (isDark ? '#c4c9c5' : '#374151'),
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{
                    width: '26px', height: '26px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.74rem', fontWeight: 800, flexShrink: 0,
                    background: active
                      ? (isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.06)')
                      : (isDark ? '#232725' : '#f1f5f9'),
                    border: active
                      ? (isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.08)')
                      : 'none',
                    color: active ? ui.text : badgeColor
                  }}>
                    {clsName.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: active ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {clsName}
                  </span>
                  {clsArchived && (
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '2px 6px', borderRadius: '9999px', backgroundColor: isDark ? 'rgba(148,163,184,0.18)' : '#e2e8f0', color: isDark ? '#cbd5e1' : '#475569' }}>
                      Archived
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ height: '1px', background: ui.border, marginTop: '16px' }} />
        </div>
      </aside>

      {/* CENTER COLUMN: Stream feed */}
      <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait" custom={classroomDirection}>
          <motion.div
            key={classroom?.id || 'stream_feed'}
            custom={classroomDirection}
            variants={classroomSlideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 500, letterSpacing: '-0.01em', margin: 0, color: ui.text }}>Classroom stream</h2>
            </div>

            {/* Latest activity header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={sectionLabelStyle}>Latest activity</span>
                <span style={{ fontSize: '0.7rem', color: ui.faint }}>
                  {formatShortDate(visibleStreamItems[0]?.posted || visibleStreamItems[0]?.createdAt || streamFallbackNow)}
                </span>
              </div>
            </div>

            {/* Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loadingClasswork ? (
                <>
                  <Skeleton.StreamCard />
                  <Skeleton.StreamCard />
                  <Skeleton.StreamCard />
                </>
              ) : filteredStreamItems.length === 0 ? (
                <div style={{ padding: '36px 20px', borderRadius: '14px', border: `1px dashed ${ui.border}`, textAlign: 'center', color: ui.muted, fontSize: '0.84rem' }}>
                  {classSettings.classworkStream === 'Hide notifications'
                    ? 'Classwork and material notifications on the Stream are hidden in Classroom Settings.'
                    : "This is where you'll see classwork, learning materials, and activities posted for your students."}
                </div>
              ) : (
                filteredStreamItems.map((item, index) => {
                  const isMaterial = isMaterialItem(item);
                  const plain = (item.details || '').replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
                  const postedLabel = formatShortDate(item.posted || item.createdAt || (typeof item.id === 'number' && item.id > 1e12 ? item.id : null));
                  const openItem = () => {
                    if (isMaterial) {
                      handleTabChange('materials');
                    } else {
                      handleTabChange('classwork');
                    }
                    setExpandedId(item.id);
                  };

                  const lessonType = isMaterial ? getLessonType(item) : null;
                  const badgeText = isMaterial
                    ? (lessonType === 'video' ? 'Video Lesson' : lessonType === 'link' ? 'Link Resource' : 'Material')
                    : (item.activityType || 'Classwork');
                  const badgeColor = isMaterial
                    ? (lessonType === 'video' ? (isDark ? '#fbbf24' : '#d97706') : lessonType === 'link' ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#34d399' : '#059669'))
                    : ui.accentText;
                  const iconBg = isMaterial
                    ? (lessonType === 'video' ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7') : lessonType === 'link' ? (isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe') : (isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7'))
                    : (isDark ? 'rgba(52, 211, 153, 0.12)' : '#ecfdf5');
                  const iconColor = isMaterial
                    ? (lessonType === 'video' ? (isDark ? '#fbbf24' : '#d97706') : lessonType === 'link' ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#34d399' : '#059669'))
                    : ui.accentText;

                  const itemActiveCount = !isMaterial ? getActiveCountForActivity(item) : 0;
                  const IconComp = getMaterialIcon(item);

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="vt-card"
                      style={{ background: ui.surface, border: `1px solid ${ui.border}`, borderRadius: '14px', overflow: 'visible', position: 'relative' }}
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
                              ? `0 0 0 2.5px ${ui.surface || '#1b1e1c'}, 0 0 12px #10b981`
                              : '0 0 0 2.5px #ffffff, 0 0 12px #10b981',
                            animation: 'live-pulse 1.8s infinite',
                            zIndex: 40,
                            pointerEvents: 'auto'
                          }}
                        />
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 0' }}>
                        {renderTeacherAvatar()}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 500, color: ui.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {postedLabel || 'Recently'}
                          </div>
                        </div>
                        <button className="vt-icon-btn" onClick={openItem} title={isMaterial ? 'Open in Materials' : 'Open in Classwork'} style={smallIconBtnStyle}>
                          <MoreHorizontal size={18} />
                        </button>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: '16px',
                        padding: '16px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: isMobile ? '100%' : 'auto', flex: isMobile ? 'none' : 1, minWidth: 0 }}>
                          <div style={{ width: '72px', height: '72px', borderRadius: '10px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <IconComp size={28} color={iconColor} strokeWidth={1.6} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: badgeColor }}>
                                {badgeText}
                              </div>
                              {item.dueDate && !isMaterial && (
                                <span style={{ fontSize: '0.68rem', color: isDark ? '#fbbf24' : '#d97706', fontWeight: 600 }}>
                                  • Due {formatShortDate(item.dueDate)}
                                </span>
                              )}
                              {item.attachments && item.attachments.length > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: ui.faint }}>
                                  • <Paperclip size={10} /> {item.attachments.length} {item.attachments.length === 1 ? 'file' : 'files'}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 500, color: ui.text, margin: '4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.title}
                            </div>
                            <div style={{
                              fontSize: '0.76rem',
                              color: ui.muted,
                              lineHeight: 1.5,
                              display: '-webkit-box',
                              WebkitLineClamp: classSettings.classworkStream === 'Show attachments and details' ? 4 : 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {plain || (isMaterial ? 'View learning materials, syllabus, and study references.' : "View assignment instructions and manage your students' work.")}
                            </div>
                            {classSettings.classworkStream === 'Show attachments and details' && item.attachments && item.attachments.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                                {item.attachments.map((att, attIdx) => (
                                  <span
                                    key={attIdx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openItem();
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      padding: '4px 10px',
                                      borderRadius: '8px',
                                      background: ui.surfaceAlt,
                                      border: `1px solid ${ui.border}`,
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      color: ui.text,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Paperclip size={11} /> {att.name || att.title || 'Attachment'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          className="vt-outline-btn"
                          onClick={openItem}
                          style={{
                            flexShrink: 0,
                            background: ui.surfaceAlt,
                            border: `1px solid ${ui.border}`,
                            color: ui.text,
                            padding: '9px 16px',
                            borderRadius: '9px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'all 0.2s ease',
                            width: isMobile ? '100%' : 'auto',
                            textAlign: 'center'
                          }}
                        >
                          {isMaterial ? 'View material' : 'View assignment'}
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
