import React, { useRef, useState } from 'react';
import { 
  ChevronRight, CheckCircle2, ClipboardList, FileText, Video, Link2 
} from 'lucide-react';
import { formatShortDate } from '../../utils/dateUtils';
import { getLessonType } from '../../utils/lessonType';

export default function ClassroomOverviewTab({
  isMobile,
  isDark,
  cardBg,
  textMuted,
  upcomingItems = [],
  visibleClasswork = [],
  visibleMaterials = [],
  unseenMaterials = [],
  classroom,
  loadingAssignments = false,
  onSelectTodo,
  onOpenMaterials,
  onSelectMaterial
}) {
  const safeUpcoming = Array.isArray(upcomingItems) ? upcomingItems : [];
  const safeClasswork = Array.isArray(visibleClasswork) ? visibleClasswork : [];
  const safeMaterials = Array.isArray(visibleMaterials) ? visibleMaterials : [];
  const safeUnseen = Array.isArray(unseenMaterials) ? unseenMaterials : [];

  const todoScrollRef = useRef(null);
  const isDraggingTodoRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedTodoRef = useRef(false);
  const [isTodoDragging, setIsTodoDragging] = useState(false);

  const handleTodoMouseDown = (e) => {
    if (e.button !== 0 || !todoScrollRef.current) return;
    isDraggingTodoRef.current = true;
    hasDraggedTodoRef.current = false;
    startXRef.current = e.pageX - todoScrollRef.current.offsetLeft;
    scrollLeftRef.current = todoScrollRef.current.scrollLeft;
    setIsTodoDragging(true);

    const onMouseMove = (moveEvent) => {
      if (!isDraggingTodoRef.current || !todoScrollRef.current) return;
      moveEvent.preventDefault();
      const x = moveEvent.pageX - todoScrollRef.current.offsetLeft;
      const walk = (x - startXRef.current);
      if (Math.abs(walk) > 5) hasDraggedTodoRef.current = true;
      todoScrollRef.current.scrollLeft = scrollLeftRef.current - walk;
    };

    const onMouseUp = () => {
      isDraggingTodoRef.current = false;
      setIsTodoDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setTimeout(() => { hasDraggedTodoRef.current = false; }, 50);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? '24px' : '32px',
      alignItems: 'flex-start',
      width: '100%'
    }}>
      {/* LEFT COLUMN */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* To Do (Unsubmitted Work) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>To Do</h2>
              <span style={{ fontSize: '0.85rem', color: textMuted }}>
                {safeUpcoming.length} item{safeUpcoming.length !== 1 && 's'}
              </span>
            </div>
            <button
              onClick={() => onSelectTodo(null)}
              style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View all <ChevronRight size={16} />
            </button>
          </div>

          <div
            ref={todoScrollRef}
            onMouseDown={handleTodoMouseDown}
            className="hide-scroll"
            style={{
              display: 'flex',
              gap: '14px',
              overflowX: 'auto',
              paddingBottom: '12px',
              scrollSnapType: isTodoDragging ? 'none' : 'x proximity',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              cursor: isTodoDragging ? 'grabbing' : 'grab',
              userSelect: 'none'
            }}
          >
            <style dangerouslySetInnerHTML={{__html: `.hide-scroll::-webkit-scrollbar { display: none; }`}} />
            {loadingAssignments ? (
              <div style={{ display: 'flex', gap: '14px', width: '100%' }}>
                <div className="skeleton-shimmer" style={{ flex: isMobile ? '0 0 260px' : '0 0 320px', height: 140, borderRadius: 16 }} />
                <div className="skeleton-shimmer" style={{ flex: isMobile ? '0 0 260px' : '0 0 320px', height: 140, borderRadius: 16 }} />
              </div>
            ) : safeUpcoming.length === 0 ? (
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', color: isDark ? '#34d399' : '#059669', padding: '4px 0' }}>
                <CheckCircle2 size={20} color={isDark ? '#34d399' : '#10b981'} />
                <span style={{ fontWeight: '600', color: isDark ? '#f5f5f5' : '#1e293b', fontSize: '0.95rem' }}>
                  {safeClasswork.length > 0 ? "You're all caught up!" : "No pending work"}
                </span>
              </div>
            ) : (
              safeUpcoming.map(item => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (hasDraggedTodoRef.current) return;
                    onSelectTodo(item.id);
                  }}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    flex: isMobile ? '0 0 260px' : '0 0 320px',
                    width: isMobile ? '260px' : '320px',
                    maxWidth: '340px',
                    scrollSnapAlign: 'start',
                    backgroundColor: cardBg,
                    borderRadius: '16px',
                    padding: '18px',
                    border: isDark ? '1px solid #333' : '1px solid #e5e7eb',
                    cursor: isTodoDragging ? 'grabbing' : 'pointer',
                    transition: isTodoDragging ? 'none' : 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '140px',
                    userSelect: 'none',
                    ...isDark ? {} : { boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                        <ClipboardList size={16} />
                      </div>
                      <span style={{ fontSize: '0.74rem', fontWeight: 'bold', color: textMuted }}>
                        {item.dueDate ? formatShortDate(item.dueDate) : 'No due date'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 'bold', color: '#10b981', letterSpacing: '0.05em', marginBottom: '4px' }}>ACTIVITY</div>
                    <div style={{ fontSize: '0.98rem', fontWeight: 'bold', marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: textMuted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.45', marginTop: '4px' }}>
                    {(() => {
                      const raw = typeof item?.details === 'string' ? item.details : (typeof item?.instruction === 'string' ? item.instruction : '');
                      const clean = raw ? raw.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ') : '';
                      return clean || 'No instructions provided.';
                    })()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Learning Materials */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Learning materials</h2>
              <span style={{ fontSize: '0.85rem', color: safeUnseen.length > 0 ? textMuted : '#10b981', fontWeight: safeUnseen.length > 0 ? 'normal' : '600' }}>
                {safeUnseen.length > 0 ? `${safeUnseen.length} new` : (safeMaterials.length > 0 ? 'All viewed' : '0 items')}
              </span>
            </div>
            <button
              onClick={onOpenMaterials}
              style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Open library <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
            {loadingAssignments ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer" style={{ height: 110, borderRadius: 14 }} />
              ))
            ) : safeMaterials.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', backgroundColor: 'transparent', borderRadius: '12px', padding: '12px 6px', display: 'flex', alignItems: 'center', gap: '12px', color: textMuted, fontSize: '0.88rem', fontStyle: 'italic' }}>
                <FileText size={20} color={textMuted} />
                <span>No learning materials uploaded yet for this class.</span>
              </div>
            ) : safeUnseen.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '10px', color: isDark ? '#34d399' : '#059669', padding: '4px 0' }}>
                <CheckCircle2 size={20} color={isDark ? '#34d399' : '#10b981'} />
                <span style={{ fontWeight: '600', color: isDark ? '#f5f5f5' : '#1e293b', fontSize: '0.95rem' }}>
                  You're all caught up!
                </span>
              </div>
            ) : (
              safeUnseen.slice(0, 6).map((item) => {
                const lessonType = getLessonType(item);
                let iconNode = <FileText size={20} />;
                let iconBg = isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7';
                let iconColor = isDark ? '#34d399' : '#059669';

                if (lessonType === 'video') {
                  iconNode = <Video size={20} />;
                  iconBg = isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7';
                  iconColor = isDark ? '#fbbf24' : '#d97706';
                } else if (lessonType === 'link') {
                  iconNode = <Link2 size={20} />;
                  iconBg = isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe';
                  iconColor = isDark ? '#38bdf8' : '#0284c7';
                }

                const attCount = item.attachments?.length || 0;
                const subtitle = attCount > 0 ? `${attCount} resource${attCount > 1 ? 's' : ''}` : (item.topic || 'Course material');

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectMaterial(item.id)}
                    style={{
                      backgroundColor: 'transparent',
                      borderRadius: '12px',
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>
                      {iconNode}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {subtitle}
                      </div>
                    </div>
                    <ChevronRight size={18} color={textMuted} style={{ flexShrink: 0 }} />
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN */}
      <div style={{ width: isMobile ? '100%' : '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{
          backgroundColor: cardBg,
          borderRadius: '20px',
          padding: '20px',
          border: isDark ? '1px solid #333' : '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#059669', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
              KF
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#10b981', letterSpacing: '0.05em', textTransform: 'uppercase' }}>YOUR TEACHER</div>
              <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{classroom?.instructor || 'Kim Fabie'}</div>
              <div style={{ fontSize: '0.75rem', color: textMuted }}>Offline 24 hours ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
