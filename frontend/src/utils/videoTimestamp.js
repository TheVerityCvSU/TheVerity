/**
 * Formats a duration in seconds, numbers, or timestamps into standard video timestamps (e.g. 52:21, 1:04:15, 0:45)
 */
export const formatVideoTimestamp = (seconds) => {
  if (seconds == null || seconds === '') return null;
  if (typeof seconds === 'string') {
    const trimmed = seconds.trim();
    // If it's already a timestamp format like "52:21" or "00:52:21"
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const parts = trimmed.split(':');
      if (parts.length === 3 && parts[0] === '00') {
        return `${parts[1]}:${parts[2]}`;
      }
      return trimmed;
    }
    // If it's generic "25 min" / "25 mins", treat as unformatted so real timestamp is used
    if (/^\d+\s*mins?$/i.test(trimmed)) {
      return null;
    }
    const num = parseFloat(trimmed);
    if (!isNaN(num) && num > 0) seconds = num;
    else return null;
  }
  if (isNaN(seconds) || seconds <= 0) return null;
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
};
