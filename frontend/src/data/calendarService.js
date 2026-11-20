import { apiFetch } from './api';
import { isClassroomArchived } from '../utils/classroomList';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const PASTEL_THEMES = [
  {
    lightBg: '#edf8ef',
    lightText: '#347a4c',
    lightTime: '#4d8c63',
    darkBg: 'rgba(16, 185, 129, 0.16)',
    darkText: '#6ee7b7',
    darkTime: '#a7f3d0',
    dot: '#10b981'
  },
  {
    lightBg: '#f1ecfc',
    lightText: '#6148bd',
    lightTime: '#7b65cf',
    darkBg: 'rgba(139, 92, 246, 0.16)',
    darkText: '#c4b5fd',
    darkTime: '#ddd6fe',
    dot: '#8b5cf6'
  },
  {
    lightBg: '#e2f4fc',
    lightText: '#1879a6',
    lightTime: '#3597c4',
    darkBg: 'rgba(14, 165, 233, 0.16)',
    darkText: '#7dd3fc',
    darkTime: '#bae6fd',
    dot: '#0ea5e9'
  },
  {
    lightBg: '#feeceb',
    lightText: '#a84545',
    lightTime: '#be5f5f',
    darkBg: 'rgba(244, 63, 94, 0.16)',
    darkText: '#fda4af',
    darkTime: '#fecdd3',
    dot: '#f43f5e'
  },
  {
    lightBg: '#fef6e2',
    lightText: '#9c6c22',
    lightTime: '#b5853b',
    darkBg: 'rgba(245, 158, 11, 0.16)',
    darkText: '#fcd34d',
    darkTime: '#fde68a',
    dot: '#f59e0b'
  }
];

export const MISSED_ACTIVITY_THEME = {
  lightBg: '#fee2e2',
  lightText: '#b91c1c',
  lightTime: '#dc2626',
  darkBg: 'rgba(239, 68, 68, 0.2)',
  darkText: '#fca5a5',
  darkTime: '#f87171',
  dot: '#ef4444'
};

export const isLegacyHardcoded = (item) =>
  (item?.id === 1 || item?.id === 2) &&
  (item?.title?.startsWith('Activity 1:') || item?.title?.startsWith('Activity 2:'));

export const parseDueDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

export const getActivityTheme = (act, index = 0) => {
  const t = (act.type || act.activityType || act.title || '').toLowerCase();
  if (t.includes('project') || t.includes('design') || t.includes('lab')) return PASTEL_THEMES[0];
  if (t.includes('quiz') || t.includes('test') || t.includes('interview') || t.includes('exam')) return PASTEL_THEMES[1];
  if (t.includes('dev') || t.includes('code') || t.includes('frontend') || t.includes('challenge')) return PASTEL_THEMES[2];
  if (t.includes('review') || t.includes('important')) return PASTEL_THEMES[3];
  const seed = Math.abs(Number(act.id) || (index * 3 + 1)) % PASTEL_THEMES.length;
  return PASTEL_THEMES[seed];
};

export const getDeadlineTime = (act) => {
  if (act.dueTime && typeof act.dueTime === 'string' && act.dueTime.trim()) {
    return act.dueTime.trim();
  }
  if (act.deadline && typeof act.deadline === 'string' && act.deadline.trim()) {
    return act.deadline.trim();
  }
  if (act.dueDate && typeof act.dueDate === 'string') {
    const raw = act.dueDate.trim();
    if (raw.includes('T') || /\d{1,2}:\d{2}/.test(raw)) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const hours = d.getHours();
        const mins = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        return `${h12}:${mins} ${ampm}`;
      }
    }
  }
  return '11:59 PM';
};

export const getWeekDaysFromMonday = (refDate) => {
  const d = new Date(refDate);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    days.push(nextDay);
  }
  return days;
};

export const getWeekRangeString = (weekDays) => {
  const monday = weekDays[0];
  const sunday = weekDays[6];
  const mMonth = MONTH_NAMES[monday.getMonth()];
  const sMonth = MONTH_NAMES[sunday.getMonth()];
  const mYear = monday.getFullYear();
  const sYear = sunday.getFullYear();

  if (mYear === sYear && mMonth === sMonth) {
    return `${mMonth} ${monday.getDate()} - ${sunday.getDate()}, ${mYear}`;
  } else if (mYear === sYear) {
    return `${mMonth} ${monday.getDate()} - ${sMonth} ${sunday.getDate()}, ${mYear}`;
  } else {
    return `${mMonth} ${monday.getDate()}, ${mYear} - ${sMonth} ${sunday.getDate()}, ${sYear}`;
  }
};

export const getCachedActivities = (classrooms = []) => {
  const all = [];
  const rawClasses = Array.isArray(classrooms) ? classrooms : [];
  const hasKnownClasses = rawClasses.length > 0;
  const activeClasses = rawClasses.filter((c) => !isClassroomArchived(c));
  activeClasses.forEach((c) => {
    try {
      const raw = localStorage.getItem(`verity_classwork_${c.id}`);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) all.push(...list.map((cw) => ({ ...cw, classroom_id: c.id })));
      }
    } catch {}
  });

  try {
    const raw = localStorage.getItem('verity_cached_classwork');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) all.push(...list);
    }
  } catch {}

  const seen = new Set();
  return all.filter((item) => {
    if (!item || !item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    const inClass = activeClasses.some((c) => String(c.id) === String(item.classroom_id || item.classId));
    return !item.archived && !isLegacyHardcoded(item) && !!item.dueDate && (hasKnownClasses ? inClass : true);
  });
};

export const fetchAllActivitiesApi = async (classrooms = []) => {
  const rawClasses = Array.isArray(classrooms) ? classrooms : [];
  const hasKnownClasses = rawClasses.length > 0;
  const activeClasses = rawClasses.filter((c) => !isClassroomArchived(c));

  try {
    const res = await apiFetch(`${import.meta.env.VITE_API_URL}/classwork`);
    if (res.ok) {
      const data = await res.json();
      const serverClasswork = (data && Array.isArray(data.classwork)) ? data.classwork : [];
      const valid = serverClasswork.filter(
        (item) =>
          !item.archived &&
          !isLegacyHardcoded(item) &&
          !!item.dueDate &&
          (!hasKnownClasses || activeClasses.some((c) => String(c.id) === String(item.classroom_id || item.classId)))
      );
      try {
        localStorage.setItem('verity_cached_classwork', JSON.stringify(valid));
      } catch {}
      return valid;
    }
  } catch {
    if (activeClasses.length > 0) {
      try {
        const promises = activeClasses.map((c) =>
          apiFetch(`${import.meta.env.VITE_API_URL}/classwork/${c.id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => (d && Array.isArray(d.classwork) ? d.classwork.map((item) => ({ ...item, classroom_id: c.id })) : []))
            .catch(() => [])
        );
        const results = await Promise.all(promises);
        return results.flat().filter(
          (item) => !item.archived && !isLegacyHardcoded(item) && !!item.dueDate
        );
      } catch {}
    } else if (hasKnownClasses) {
      return [];
    }
  }
  return null;
};

