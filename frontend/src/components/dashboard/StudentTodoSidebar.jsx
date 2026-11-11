import React from 'react';
import { Calendar as CalendarIcon, MoreHorizontal } from 'lucide-react';
import VideoLessonCard from './VideoLessonCard';

export default function StudentTodoSidebar({
  isDark,
  isMobile,
  cardBg,
  textColor,
  textMuted,
  unseenVideo,
  videoLessons,
  currentVideoDuration,
  onStartSession,
  onDurationLoaded,
  loadingActivities,
  displayedUpcomingActivities,
  classrooms,
  onOpenAssignment,
  onEnterClassroom
}) {
  return (
    <aside style={{
      flex: isMobile ? '1 1 auto' : '0 0 380px',
      width: isMobile ? '100%' : '380px',
      maxWidth: isMobile ? '100%' : '420px',
      flexShrink: 0,
      backgroundColor: cardBg,
      borderRadius: '32px',
      padding: '32px',
      boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.2)' : '0 10px 30px rgba(0,0,0,0.03)',
      alignSelf: 'flex-start',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>This week</h2>
          <p style={{ fontSize: '0.8rem', color: textMuted, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
        <div style={{ padding: '8px', backgroundColor: isDark ? '#333' : '#f3f4f6', borderRadius: '50%' }}>
          <CalendarIcon size={18} color={textMuted} />
        </div>
      </div>

      {/* Video Lesson Card or Caught Up State */}
      <VideoLessonCard
        isDark={isDark}
        cardBg={cardBg}
        textColor={textColor}
        textMuted={textMuted}
        unseenVideo={unseenVideo}
        videoLessons={videoLessons}
        currentVideoDuration={currentVideoDuration}
        onStartSession={onStartSession}
        onDurationLoaded={onDurationLoaded}
      />

      {/* "To Do" Section */}
      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '0 0 16px' }}>To Do</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {loadingActivities ? (
          <div style={{ color: textMuted, fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>Loading tasks...</div>
        ) : displayedUpcomingActivities.length === 0 ? (
          <div style={{ color: textMuted, fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>No upcoming tasks!</div>
        ) : (
          displayedUpcomingActivities
            .slice(0, 5)
            .map((act) => {
              const d = act.dueDate ? new Date(act.dueDate) : null;
              const hasValidDate = d && !isNaN(d.getTime());
              const time = hasValidDate ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
              const now = new Date();
              const isToday = hasValidDate && d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              const isTomorrow = hasValidDate && new Date(now.getTime() + 86400000).getDate() === d.getDate() && new Date(now.getTime() + 86400000).getMonth() === d.getMonth();
              const label = hasValidDate ? (isToday ? 'Today' : (isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))) : 'Assigned';
              const classObj = (classrooms || []).find(c => String(c.id) === String(act.classroom_id || act.classId));
              const courseName = classObj ? (classObj.name || 'Course') : 'Course';
              const initial = courseName.charAt(0).toUpperCase();
              const bgCol = classObj?.theme?.color || '#059669';

              const handleOpenTask = () => {
                if (classObj && onOpenAssignment) {
                  onOpenAssignment(classObj, act);
                } else if (classObj) {
                  onEnterClassroom(classObj);
                }
              };

              return (
                <div
                  key={act.id}
                  onClick={handleOpenTask}
                  title={`Open ${act.title}`}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '12px',
                    margin: '-8px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ textAlign: 'right', minWidth: '70px', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{time}</div>
                    <div style={{ fontSize: '0.65rem', color: textMuted, textTransform: 'uppercase' }}>{label}</div>
                  </div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: bgCol, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0 }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.title}</div>
                    <div style={{ fontSize: '0.75rem', color: textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{courseName} - {act.points || 100} pts</div>
                  </div>
                  <MoreHorizontal size={18} color={textMuted} style={{ cursor: 'pointer', flexShrink: 0 }} />
                </div>
              );
            })
        )}
      </div>
    </aside>
  );
}

