import { Play, Pause } from 'lucide-react';
import { formatTimeMs } from '../../utils/teacherViewUtils';

export default function TeacherViewTimelineScrubber({
  history,
  playbackIndex,
  isPlaying,
  playbackSpeed,
  setPlaybackSpeed,
  playbackSpeedRef,
  cumulativeTimes,
  totalPlaybackDuration,
  togglePlay,
  handleScrub,
  progressLineRef,
  progressThumbRef,
  timeDisplayRef,
  smoothProgressRef,
  currentAnimTimeRef,
  theme,
  isDark,
  isMobile
}) {
  const currIndex = playbackIndex < 0 ? history.length - 1 : playbackIndex;
  const progressPercent =
    playbackIndex < 0
      ? 100
      : totalPlaybackDuration > 0
      ? Math.min(Math.max(((cumulativeTimes[currIndex] ?? 0) / totalPlaybackDuration) * 100, 0), 100)
      : 0;
  const displayPercent =
    isPlaying && typeof smoothProgressRef.current === 'number'
      ? smoothProgressRef.current
      : progressPercent;

  return (
    <div
      style={{
        backgroundColor: theme.headerBg,
        borderTop: `1px solid ${theme.border}`,
        borderBottom: `1px solid ${theme.border}`,
        padding: isMobile ? '8px 12px' : '10px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flexShrink: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.78rem',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={togglePlay}
            style={{
              background: isPlaying ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              color: isPlaying ? '#ef4444' : '#10b981',
              fontWeight: '700',
              fontSize: '0.78rem'
            }}
            title={isPlaying ? 'Pause replay' : 'Play replay'}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          {/* Speed Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
              borderRadius: '6px',
              padding: '2px',
              gap: '2px',
              border: isDark ? '1px solid #374151' : '1px solid #e2e8f0'
            }}
          >
            {[0.5, 1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => {
                  setPlaybackSpeed(speed);
                  playbackSpeedRef.current = speed;
                }}
                style={{
                  background: playbackSpeed === speed ? '#3b82f6' : 'transparent',
                  color: playbackSpeed === speed ? '#ffffff' : isDark ? '#9ca3af' : '#64748b',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '0.72rem',
                  fontWeight: playbackSpeed === speed ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={`Set playback speed to ${speed}x`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        <span
          ref={timeDisplayRef}
          style={{ color: theme.textMuted, fontWeight: '600', fontSize: '0.75rem' }}
        >
          Keystroke {currIndex + 1} / {history.length} ({formatTimeMs(currentAnimTimeRef.current || 0)} / {formatTimeMs(totalPlaybackDuration)})
        </span>
      </div>

      {/* Scrub Track */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '5px',
            borderRadius: '9999px',
            backgroundColor: isDark ? '#4b5563' : '#d1d5db',
            overflow: 'visible'
          }}
        >
          {/* Active Progress Line */}
          <div
            ref={progressLineRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${displayPercent}%`,
              backgroundColor: '#ef4444',
              borderRadius: '9999px',
              transition: 'none'
            }}
          />

          {/* Circle Thumb */}
          <div
            ref={progressThumbRef}
            style={{
              position: 'absolute',
              left: `${displayPercent}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '13px',
              height: '13px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              boxShadow: '0 0 5px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
              zIndex: 2,
              transition: 'none'
            }}
          />
        </div>

        {/* Drag Input Overlay */}
        <input
          type="range"
          min="0"
          max={totalPlaybackDuration}
          step="any"
          value={
            isPlaying && typeof currentAnimTimeRef.current === 'number'
              ? currentAnimTimeRef.current
              : playbackIndex < 0
              ? totalPlaybackDuration
              : cumulativeTimes[currIndex] ?? 0
          }
          onChange={(e) => handleScrub(parseFloat(e.target.value))}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            margin: 0,
            padding: 0,
            zIndex: 3
          }}
        />
      </div>
    </div>
  );
}
