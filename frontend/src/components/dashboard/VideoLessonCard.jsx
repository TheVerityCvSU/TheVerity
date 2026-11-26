import { Play, CheckCircle2 } from 'lucide-react';
import VideoThumbnailBackground from '../VideoThumbnailBackground';

export default function VideoLessonCard({
  isDark,
  cardBg,
  textColor,
  textMuted,
  unseenVideo,
  videoLessons,
  currentVideoDuration,
  onStartSession,
  onDurationLoaded
}) {
  if (unseenVideo) {
    return (
      <div
        onClick={() => onStartSession(unseenVideo)}
        style={{
          backgroundColor: cardBg,
          borderRadius: '24px',
          padding: '14px 14px 18px 14px',
          marginBottom: '32px',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
          boxShadow: isDark
            ? '0 4px 20px -2px rgba(0, 0, 0, 0.35)'
            : '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          position: 'relative'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = isDark
            ? '0 8px 25px -4px rgba(0, 0, 0, 0.45)'
            : '0 8px 25px -4px rgba(0, 0, 0, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = isDark
            ? '0 4px 20px -2px rgba(0, 0, 0, 0.35)'
            : '0 4px 20px -2px rgba(0, 0, 0, 0.05)';
        }}
      >
        {/* Upper Banner Container */}
        <div
          style={{
            height: '135px',
            borderRadius: '18px',
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: isDark ? '#0f172a' : '#1e293b',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '12px'
          }}
        >
          {/* Video Thumbnail Background */}
          <VideoThumbnailBackground
            src={unseenVideo.src}
            title={unseenVideo.title}
            isDark={isDark}
            onDurationLoaded={onDurationLoaded}
          />

          {/* Top Badges Row */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span
                style={{
                  backgroundColor: '#d1fae5',
                  color: '#065f46',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  padding: '3px 12px',
                  borderRadius: '9999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  width: 'fit-content',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                }}
              >
                New
              </span>
              <span
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  color: '#065f46',
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  letterSpacing: '0.04em',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  width: 'fit-content',
                  whiteSpace: 'nowrap',
                  maxWidth: '180px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={unseenVideo.subject}
              >
                {unseenVideo.subject}
              </span>
            </div>

            <span
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                color: '#1e293b',
                fontSize: '0.78rem',
                fontWeight: '700',
                padding: '4px 12px',
                borderRadius: '9999px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              {currentVideoDuration}
            </span>
          </div>

          {/* Bottom-Right Play Button */}
          <button
            type="button"
            aria-label="Play video lesson"
            onClick={(e) => {
              e.stopPropagation();
              onStartSession(unseenVideo);
            }}
            style={{
              position: 'absolute',
              right: '14px',
              bottom: '14px',
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: '#065f46',
              border: '2px solid rgba(255, 255, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
              transition: 'transform 0.2s, background-color 0.2s, box-shadow 0.2s',
              zIndex: 3
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.backgroundColor = '#047857';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = '#065f46';
            }}
          >
            <Play size={16} fill="white" color="white" style={{ marginLeft: '2px' }} />
          </button>
        </div>

        {/* Lower Details Area */}
        <div style={{ padding: '14px 6px 4px 6px' }}>
          <h4
            style={{
              margin: '0 0 6px 0',
              fontSize: '1.25rem',
              fontWeight: '800',
              color: textColor,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={unseenVideo.title}
          >
            {unseenVideo.title}
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: '0.88rem',
              fontWeight: '600',
              color: textMuted
            }}
          >
            Not started • {currentVideoDuration}
          </p>
        </div>
      </div>
    );
  }

  if (videoLessons.length > 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '4px 0',
          marginBottom: '24px',
          color: isDark ? '#34d399' : '#059669'
        }}
      >
        <CheckCircle2 size={18} color={isDark ? '#34d399' : '#059669'} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
          You're all caught up in video lesson!
        </span>
      </div>
    );
  }

  return null;
}

