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
