import { useState, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatTimeMs, formatExactClockTime } from '../../utils/teacherViewUtils';

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
  activeStudentWarnings = [],
  theme,
  isDark,
  isMobile
}) {
  const [hoveredFlagIdx, setHoveredFlagIdx] = useState(null);

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

  // Build sorted timeline alert flags with playback time, percent, and exact clock time
  const alertFlags = useMemo(() => {
    const flags = [];
    const seen = new Set();

    // 1. From activeStudentWarnings (already merged with history warnings)
    if (Array.isArray(activeStudentWarnings)) {
      activeStudentWarnings.forEach((w, idx) => {
        if (!w) return;
        const pbMs =
          typeof w.playbackTimeMs === 'number'
            ? w.playbackTimeMs
            : typeof w.historyIndex === 'number' && cumulativeTimes[w.historyIndex] != null
            ? cumulativeTimes[w.historyIndex]
            : null;
        const resolvedMs =
          pbMs != null
            ? pbMs
            : activeStudentWarnings.length === 1
            ? totalPlaybackDuration * 0.5
            : (idx / Math.max(activeStudentWarnings.length - 1, 1)) * totalPlaybackDuration;
        const pct =
          totalPlaybackDuration > 0
            ? Math.min(Math.max((resolvedMs / totalPlaybackDuration) * 100, 0), 100)
            : 0;
        const pbFormatted = w.playbackTimeFormatted || formatTimeMs(resolvedMs);
        const exactClock = w.exactTime || formatExactClockTime(w.epochMs || w.id, w.time) || w.time || '';
        const key = `${w.action}-${w.historyIndex ?? idx}-${exactClock}`;
        if (seen.has(key)) return;
        seen.add(key);

        flags.push({
          id: w.id || `flag-${idx}`,
          action: w.action || w.message || 'Alert',
          color: w.color || '#ef4444',
          playbackTimeMs: resolvedMs,
          playbackTimeFormatted: pbFormatted,
          exactTime: exactClock,
          historyIndex: w.historyIndex,
          percent: pct
        });
      });
    }

    return flags.sort((a, b) => a.playbackTimeMs - b.playbackTimeMs);
  }, [activeStudentWarnings, cumulativeTimes, totalPlaybackDuration]);

  const currentStepClock = useMemo(() => {
    const step = history[currIndex];
    if (!step?.time) return '';
    return formatExactClockTime(step.time, '');
  }, [history, currIndex]);

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
              backgroundColor: isDark ? '#18181b' : '#f1f5f9',
              borderRadius: '6px',
              padding: '2px',
              gap: '2px',
              border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0'
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
                  background: playbackSpeed === speed ? (isDark ? '#3f3f46' : '#27272a') : 'transparent',
                  color: playbackSpeed === speed ? '#ffffff' : isDark ? '#a1a1aa' : '#64748b',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {currentStepClock && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '0.72rem',
                fontWeight: '600',
                color: isDark ? '#f4f4f5' : '#0f172a',
                backgroundColor: isDark ? '#18181b' : '#f1f5f9',
                border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0',
                borderRadius: '5px',
                padding: '2px 7px'
              }}
              title="Exact wall-clock time of this keystroke"
            >
              <span>{currentStepClock}</span>
            </span>
          )}
          <span
            ref={timeDisplayRef}
            style={{ color: theme.textMuted, fontWeight: '600', fontSize: '0.75rem' }}
          >
            Keystroke {currIndex + 1} / {history.length} ({formatTimeMs(currentAnimTimeRef.current || 0)} / {formatTimeMs(totalPlaybackDuration)})
          </span>
        </div>
      </div>

      {/* Scrub Track */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '24px',
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

          {/* Alert Flag Markers on Timeline */}
          {alertFlags.map((flag, fIdx) => {
            const isHovered = hoveredFlagIdx === fIdx;
            const isAtCurrentStep =
              flag.historyIndex != null && Math.abs(currIndex - flag.historyIndex) <= 1;
            const clampedLeft = Math.min(Math.max(flag.percent, 1), 99);

            return (
              <div
                key={`timeline-flag-${flag.id}-${fIdx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleScrub(flag.playbackTimeMs);
                }}
                onMouseEnter={() => setHoveredFlagIdx(fIdx)}
                onMouseLeave={() => setHoveredFlagIdx((prev) => (prev === fIdx ? null : prev))}
                style={{
                  position: 'absolute',
                  left: `${flag.percent}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: isHovered ? 12 : 6,
                  cursor: 'pointer',
                  padding: '4px'
                }}
                title={`${flag.action} at ${flag.playbackTimeFormatted}${flag.exactTime ? ` (${flag.exactTime})` : ''}`}
              >
                {/* Flag Pin */}
                <div
                  style={{
                    width: isHovered || isAtCurrentStep ? '11px' : '9px',
                    height: isHovered || isAtCurrentStep ? '15px' : '13px',
                    borderRadius: '3px',
                    backgroundColor: flag.color,
                    border: isDark ? '1.5px solid #18181b' : '1.5px solid #ffffff',
                    boxShadow: isHovered || isAtCurrentStep
                      ? `0 0 8px ${flag.color}`
                      : '0 1px 3px rgba(0,0,0,0.4)',
                    transition: 'all 0.15s ease'
                  }}
                />

                {/* Hover Tooltip */}
                {isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '22px',
                      left: clampedLeft < 15 ? '0' : clampedLeft > 85 ? 'auto' : '50%',
                      right: clampedLeft > 85 ? '0' : 'auto',
                      transform:
                        clampedLeft >= 15 && clampedLeft <= 85 ? 'translateX(-50%)' : 'none',
                      backgroundColor: isDark ? '#18181b' : '#0f172a',
                      color: '#f8fafc',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                      border: `1px solid ${flag.color}`,
                      pointerEvents: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      zIndex: 20
                    }}
                  >
                    <div style={{ fontWeight: '700', color: flag.color }}>
                      <span>{flag.action}</span>
                    </div>
                    {flag.exactTime && (
                      <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                        Time: {flag.exactTime}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

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
              zIndex: 4,
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
