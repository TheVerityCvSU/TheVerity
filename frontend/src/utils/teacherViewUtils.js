export const formatStudentName = (name) => {
  if (!name) return 'Student';
  const str = String(name).trim();
  if (str.includes('@')) {
    const prefix = str.split('@')[0];
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return str
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

export const toSentenceCase = (str) => {
  if (!str) return '';
  const s = String(str).trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export const normalizeReplayStudentName = (rawName, rawEmail = '') => {
  const trimmed = String(rawName || '').trim();
  const lower = trimmed.toLowerCase();
  const emailLower = String(rawEmail || '').trim().toLowerCase();
  if (
    emailLower === 'kimfabie123@gmail.com' ||
    lower === 'kimfabie123@gmail.com' ||
    lower === 'kimfabie' ||
    lower === 'kim fabie'
  ) {
    return 'MIKOOOOO';
  }
  return trimmed;
};

export const formatTimeMs = (ms) => {
  if (!ms || ms < 0 || isNaN(ms)) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const isEpochMs = (val) => {
  const num = Number(val);
  return Number.isFinite(num) && num > 1000000000000;
};

export const formatExactClockTime = (epochCandidate, fallbackTimeStr = '') => {
  if (isEpochMs(epochCandidate)) {
    try {
      return new Date(Number(epochCandidate)).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {}
  }
  if (fallbackTimeStr && typeof fallbackTimeStr === 'string') {
    const trimmed = fallbackTimeStr.trim();
    if (isEpochMs(trimmed)) {
      try {
        return new Date(Number(trimmed)).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      } catch {}
    }
    return trimmed.replace(/^(\d{1,2}:\d{2}):\d{2}(\s*[AP]M)?$/i, '$1$2').toUpperCase();
  }
  return '';
};

export const parseClockTimeAgainstBase = (timeStr, baseEpochMs) => {
  if (!timeStr || typeof timeStr !== 'string' || !isEpochMs(baseEpochMs)) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const meridiem = match[4] ? match[4].toLowerCase() : null;

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  const d = new Date(Number(baseEpochMs));
  d.setHours(hours, minutes, seconds, 0);
  return d.getTime();
};

export const computeCumulativeTimes = (history) => {
  if (!Array.isArray(history) || history.length < 2) return [0];
  const times = [0];
  const MAX_PAUSE_MS = 8000;

  for (let i = 0; i < history.length - 1; i++) {
    const t1 = history[i]?.time ? Number(history[i].time) : 0;
    const t2 = history[i + 1]?.time ? Number(history[i + 1].time) : 0;
    const rawGap = t1 > 0 && t2 > 0 ? t2 - t1 : 0;

    let stepDuration;
    if (rawGap <= 0) {
      stepDuration = 50;
    } else if (rawGap > MAX_PAUSE_MS) {
      stepDuration = MAX_PAUSE_MS;
    } else {
      stepDuration = Math.max(rawGap, 35);
    }
    times.push(times[i] + stepDuration);
  }
  return times;
};

export const resolveWarningPlaybackInfo = (rawLog, sanitizedAction, history, cumulativeTimes) => {
  const explicitEpoch = isEpochMs(rawLog?.timestamp)
    ? Number(rawLog.timestamp)
    : isEpochMs(rawLog?.rawTime)
    ? Number(rawLog.rawTime)
    : isEpochMs(rawLog?.id)
    ? Number(rawLog.id)
    : isEpochMs(rawLog?.time)
    ? Number(rawLog.time)
    : null;

  if (!Array.isArray(history) || history.length === 0) {
    return {
      epochMs: explicitEpoch,
      exactTime: formatExactClockTime(explicitEpoch, rawLog?.time),
      historyIndex: null,
      playbackTimeMs: null,
      playbackTimeFormatted: null
    };
  }

  const times = Array.isArray(cumulativeTimes) && cumulativeTimes.length === history.length
    ? cumulativeTimes
    : computeCumulativeTimes(history);

  // If historyIndex is already known on rawLog
  if (
    typeof rawLog?.historyIndex === 'number' &&
    rawLog.historyIndex >= 0 &&
    rawLog.historyIndex < history.length
  ) {
    const idx = rawLog.historyIndex;
    const stepEpoch = isEpochMs(history[idx]?.time) ? Number(history[idx].time) : explicitEpoch;
    const pbMs = times[idx] ?? 0;
    return {
      epochMs: stepEpoch,
      exactTime: formatExactClockTime(stepEpoch, rawLog?.time),
      historyIndex: idx,
      playbackTimeMs: pbMs,
      playbackTimeFormatted: formatTimeMs(pbMs)
    };
  }

  const baseEpoch = history.find((h) => isEpochMs(h?.time))?.time;
  const approxEpoch = explicitEpoch || parseClockTimeAgainstBase(rawLog?.time, baseEpoch);

  // 1. Try matching against history entries with .warning of the same action
  let bestWarnIdx = -1;
  let bestWarnDiff = Infinity;
  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    if (!h || !h.warning) continue;
    if (sanitizeAction(h.warning) !== sanitizedAction) continue;
    const hEpoch = isEpochMs(h.time) ? Number(h.time) : null;
    if (approxEpoch && hEpoch) {
      const diff = Math.abs(hEpoch - approxEpoch);
      if (diff < bestWarnDiff && diff <= 60000) {
        bestWarnDiff = diff;
        bestWarnIdx = i;
      }
    } else if (bestWarnIdx === -1) {
      bestWarnIdx = i;
    }
  }

  if (bestWarnIdx !== -1) {
    const stepEpoch = isEpochMs(history[bestWarnIdx]?.time)
      ? Number(history[bestWarnIdx].time)
      : explicitEpoch;
    const pbMs = times[bestWarnIdx] ?? 0;
    return {
      epochMs: stepEpoch,
      exactTime: formatExactClockTime(stepEpoch, rawLog?.time),
      historyIndex: bestWarnIdx,
      playbackTimeMs: pbMs,
      playbackTimeFormatted: formatTimeMs(pbMs)
    };
  }

  // 2. Otherwise match by closest keystroke timestamp in history
  if (approxEpoch) {
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < history.length; i++) {
      const hEpoch = isEpochMs(history[i]?.time) ? Number(history[i].time) : null;
      if (!hEpoch) continue;
      const diff = Math.abs(hEpoch - approxEpoch);
      if (diff <= bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    const pbMs = times[bestIdx] ?? 0;
    const stepEpoch = explicitEpoch || (isEpochMs(history[bestIdx]?.time) ? Number(history[bestIdx].time) : null);
    return {
      epochMs: stepEpoch,
      exactTime: formatExactClockTime(stepEpoch, rawLog?.time),
      historyIndex: bestIdx,
      playbackTimeMs: pbMs,
      playbackTimeFormatted: formatTimeMs(pbMs)
    };
  }

  return {
    epochMs: explicitEpoch,
    exactTime: formatExactClockTime(explicitEpoch, rawLog?.time),
    historyIndex: null,
    playbackTimeMs: null,
    playbackTimeFormatted: null
  };
};

export const sanitizeAction = (actionStr) => {
  if (typeof actionStr !== 'string') return actionStr;
  const lower = actionStr.toLowerCase();
  if (lower.includes('crash')) return 'System Crash';
  if (
    actionStr.includes('Exit tab') ||
    actionStr.includes('Alt+Tab') ||
    lower.includes('alt tab') ||
    lower.includes('blur') ||
    lower.includes('exit')
  ) {
    return 'Alt Tab';
  }
  if (lower.includes('paste') || lower.includes('clipboard') || lower.includes('copy')) {
    return 'Copy/Paste';
  }
  if (lower.includes('system exit') || lower.includes('exited system')) {
    return 'System Exit';
  }
  return actionStr;
};

export const getLogColor = (actionStr) => {
  const lower = String(actionStr).toLowerCase();
  if (lower.includes('crash')) return '#dc2626';
  if (lower.includes('alt tab') || lower.includes('alt+tab') || lower.includes('exit')) {
    return '#eab308';
  }
  if (lower.includes('paste') || lower.includes('copy') || lower.includes('clipboard')) {
    return '#ef4444';
  }
  return '#ef4444';
};
