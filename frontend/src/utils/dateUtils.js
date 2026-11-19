export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatShortDate = (value) => {
  if (!value) return '';
  const clean = typeof value === 'string' ? value.replace(/^turned in (on )?/i, '').trim() : value;
  let d;
  if (typeof clean === 'string' && /^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.split('T')[0].split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(clean);
  }
  if (isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

export const formatFullDate = (value) => {
  if (!value) return '';
  const clean = typeof value === 'string' ? value.replace(/^turned in (on )?/i, '').trim() : value;
  let d;
  if (typeof clean === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const parts = clean.split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(clean);
  }
  if (isNaN(d.getTime())) return String(value);

  const hasTime = typeof clean === 'string' 
    ? (clean.includes('T') || clean.includes(':')) 
    : (typeof clean === 'number' || clean instanceof Date);

  if (!hasTime) {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

/**
 * Formats an ISO timestamp or epoch value as `YYYY-MM-DD h:mm PM` (e.g. `2026-11-19 3:23 PM`).
 */
export const formatDateTimeCompact = (value) => {
  if (!value) return '';
  const clean = typeof value === 'string' ? value.replace(/^turned in (on )?/i, '').trim() : value;
  let d;
  const isDateOnly = typeof clean === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(clean);
  if (isDateOnly) {
    const parts = clean.split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(clean);
  }
  if (isNaN(d.getTime())) return String(value);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  if (isDateOnly) {
    return `${yyyy}-${mm}-${dd}`;
  }

  let hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${yyyy}-${mm}-${dd} ${hours}:${mins} ${ampm}`;
};

/**
 * Parses an activity dueDate into its exact local deadline Date.
 * Date-only `YYYY-MM-DD` strings resolve to local 23:59:59.999 of that date.
 */
export const parseDueDeadline = (dueDate) => {
  if (!dueDate) return null;
  if (typeof dueDate === 'string') {
    const trimmed = dueDate.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      return new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(dueDate);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const DUE_SOON_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Computes activity timing status for student UI badges & accent lines.
 * Returns: 'submitted' | 'submitted_late' | 'missing' | 'due_soon' | 'upcoming'
 */
export const getActivityDueState = ({ dueDate, isSubmitted = false, submittedAt = null, now = new Date() }) => {
  const deadline = parseDueDeadline(dueDate);
  if (isSubmitted) {
    if (deadline && submittedAt) {
      const subDate = new Date(submittedAt);
      if (!isNaN(subDate.getTime()) && subDate.getTime() > deadline.getTime()) {
        return 'submitted_late';
      }
    }
    return 'submitted';
  }
  if (!deadline) return 'upcoming';
  const diff = deadline.getTime() - now.getTime();
  if (diff < 0) return 'missing';
  if (diff <= DUE_SOON_WINDOW_MS) return 'due_soon';
  return 'upcoming';
};
