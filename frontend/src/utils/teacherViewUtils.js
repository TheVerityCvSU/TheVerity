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
