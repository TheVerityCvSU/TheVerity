import React from 'react';
import { 
  ClipboardList, CheckCircle2, Calendar, Award, Clock, ArrowUpRight, ArrowRight, Lock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AttachmentCard from '../AttachmentCard';
import { formatShortDate } from '../../utils/dateUtils';

export default function ClassworkItemCard({
  item,
  isOpen,
  onToggle,
  isSubmitted,
  onOpenAssignment,
  onStartAssignment,
  onRequestUnsubmit,
  setPreviewImage,
  setPreviewVideo,
  setPreviewIframe,
  isDark,
  isMobile,
  styles
}) {
  const due = formatShortDate(item.dueDate);
  const posted = formatShortDate(item.posted || (typeof item.id === 'number' && item.id > 1e12 ? item.id : null));

  return (
    <div style={styles.itemWrapper}>
      {/* Collapsed Pill */}
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
            overflow: 'hidden'
          }}
          onClick={onToggle}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#dcfce7', border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', marginRight: '16px', flexShrink: 0 }}>
              <ClipboardList size={18} />
            </div>
            <span style={{ color: isDark ? '#f5f5f5' : '#1e293b', fontSize: '1.05rem', fontWeight: '700' }}>{item.title}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {isSubmitted ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isDark ? '#a7f3d0' : '#059669', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5', padding: '5px 12px', borderRadius: '8px', fontWeight: '600' }}>
                <CheckCircle2 size={12} /> Turned in
              </span>
            ) : due ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isDark ? '#a7f3d0' : '#059669', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5', padding: '5px 12px', borderRadius: '8px', fontWeight: '600' }}>
                <Calendar size={12} /> Due {due}
              </span>
            ) : null}

            <div style={{ width: '1px', height: '24px', backgroundColor: isDark ? '#3d4447' : '#e2e8f0' }} />
            <div style={{ color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease', marginRight: '20px' }}>
              <ArrowUpRight size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Detail View */}
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
            <div style={{ ...styles.detailCard, display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
              {/* Left Main Content */}
              <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                    <ClipboardList size={28} />
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: isDark ? '#f5f5f5' : '#1e293b', lineHeight: 1.2, wordBreak: 'break-word' }}>
                    {item.title}
                  </div>
                </div>

                {/* Metadata */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px', marginBottom: '32px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Calendar size={14} /> Due Date
                    </div>
                    <div style={{ fontSize: '0.95rem', color: isDark ? '#E8EAED' : '#334155', fontWeight: '500' }}>
                      {due ? `Due ${due}` : 'No Due Date'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Award size={14} /> Points
                    </div>
                    <div style={{ fontSize: '0.95rem', color: isDark ? '#E8EAED' : '#334155', fontWeight: '500' }}>
                      {item.points || 100} points
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Clock size={14} /> Posted
                    </div>
                    <div style={{ fontSize: '0.95rem', color: isDark ? '#E8EAED' : '#334155', fontWeight: '500' }}>
                      {posted ? `Posted ${posted}` : 'Recently'}
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div style={{ marginBottom: '32px' }}>
                  {(() => {
                    const raw = typeof item?.details === 'string' ? item.details : (typeof item?.instruction === 'string' ? item.instruction : '');
                    const clean = raw ? raw.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ') : '';
                    return clean ? (
                      <div style={{ ...styles.detailInstruction, whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {clean}
                      </div>
                    ) : (
                      <p style={styles.detailInstruction}>No instructions provided.</p>
                    );
                  })()}

                  {item.attachments?.length > 0 && (
                    <div style={styles.cardAttachments}>
                      {item.attachments.map((att, i) => (
                        <AttachmentCard
                          key={i}
                          att={att}
                          isDark={isDark}
                          onClick={(clickedAtt) => {
                            if (!clickedAtt) return;
                            const ext = (clickedAtt.url || clickedAtt.name || '').split('?')[0].split('.').pop().toLowerCase();
                            const isImg = clickedAtt.type === 'image' || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext);
                            const isVid = clickedAtt.type === 'video' || ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(ext);
                            if (isImg && setPreviewImage) setPreviewImage(clickedAtt);
                            else if (isVid && setPreviewVideo) setPreviewVideo(clickedAtt);
                            else if (setPreviewIframe) setPreviewIframe(clickedAtt);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ flexGrow: 1 }} />
                <div style={{ height: '1px', backgroundColor: isDark ? '#3E3E3E' : '#e2e8f0', marginBottom: '20px' }} />

                <div>
                  <span
                    style={{ ...styles.viewActivityLink, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => onOpenAssignment(item)}
                  >
                    View Activity Details <ArrowUpRight size={16} />
                  </span>
                </div>
              </div>

              {/* Right Status / Action Content */}
              <div style={{ width: isMobile ? '100%' : '280px', flexShrink: 0, borderLeft: isMobile ? 'none' : (isDark ? '1px solid #3E3E3E' : '1px solid #e2e8f0'), borderTop: isMobile ? (isDark ? '1px solid #3E3E3E' : '1px solid #e2e8f0') : 'none', backgroundColor: isDark ? '#222728' : '#f8fafc', padding: '32px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: isDark ? '#a3a3a3' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  Your Work
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'auto' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isSubmitted ? '#10b981' : '#3b82f6' }} />
                  <span style={{ fontSize: '1.4rem', fontWeight: '800', color: isDark ? '#f5f5f5' : '#1e293b' }}>
                    {isSubmitted ? 'Turned in' : 'Assigned'}
                  </span>
                </div>

                <div style={{ marginTop: '36px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {isSubmitted ? (
                    !(item?.disableBack || item?.disable_back) && (
                      <button
                        onClick={() => onRequestUnsubmit(item)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '11px 16px',
                          backgroundColor: 'transparent',
                          border: isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fca5a5',
                          borderRadius: '10px',
                          color: isDark ? '#f87171' : '#dc2626',
                          fontWeight: '600',
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        Unsubmit
                      </button>
                    )
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (onStartAssignment) onStartAssignment(item);
                          else onOpenAssignment(item);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '14px 20px',
                          backgroundColor: '#34d399',
                          border: 'none',
                          borderRadius: '12px',
                          color: '#064e3b',
                          fontWeight: '700',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          boxShadow: '0 4px 6px rgba(52, 211, 153, 0.2)',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#34d399'}
                      >
                        Start <ArrowRight size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

