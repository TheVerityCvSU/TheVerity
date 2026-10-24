import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Clock, X, Calendar as CalendarIcon, Award, FileText, Check, AlertCircle } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import Skeleton from '../components/Skeleton';
import { apiFetch } from '../utils/api';
import { sortClassroomsAlphabetically } from '../utils/classroomUtils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isLegacyHardcoded = (item) =>
  (item?.id === 1 || item?.id === 2) &&
  (item?.title?.startsWith('Activity 1:') || item?.title?.startsWith('Activity 2:'));

const parseDueDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

// Pastel card color themes matching the reference design
const PASTEL_THEMES = [
  {
    // Mint Green (e.g. Product Design Course / App Design)
    lightBg: '#edf8ef',
    lightText: '#347a4c',
    lightTime: '#4d8c63',
    darkBg: 'rgba(16, 185, 129, 0.16)',
    darkText: '#6ee7b7',
    darkTime: '#a7f3d0',
    dot: '#10b981'
  },
  {
    // Lavender / Violet (e.g. Usability testing / Conversational Interview)
    lightBg: '#f1ecfc',
    lightText: '#6148bd',
    lightTime: '#7b65cf',
    darkBg: 'rgba(139, 92, 246, 0.16)',
    darkText: '#c4b5fd',
    darkTime: '#ddd6fe',
    dot: '#8b5cf6'
  },
  {
    // Sky Blue (e.g. Frontend development)
    lightBg: '#e2f4fc',
    lightText: '#1879a6',
    lightTime: '#3597c4',
    darkBg: 'rgba(14, 165, 233, 0.16)',
    darkText: '#7dd3fc',
    darkTime: '#bae6fd',
    dot: '#0ea5e9'
  },
  {
    // Soft Peach / Coral
    lightBg: '#feeceb',
    lightText: '#a84545',
    lightTime: '#be5f5f',
    darkBg: 'rgba(244, 63, 94, 0.16)',
    darkText: '#fda4af',
    darkTime: '#fecdd3',
    dot: '#f43f5e'
  },
  {
    // Soft Amber / Gold
    lightBg: '#fef6e2',
    lightText: '#9c6c22',
    lightTime: '#b5853b',
    darkBg: 'rgba(245, 158, 11, 0.16)',
    darkText: '#fcd34d',
    darkTime: '#fde68a',
    dot: '#f59e0b'
  }
];

const getActivityTheme = (act, index = 0) => {
  const t = (act.type || act.activityType || act.title || '').toLowerCase();
  if (t.includes('project') || t.includes('design') || t.includes('lab')) return PASTEL_THEMES[0];
  if (t.includes('quiz') || t.includes('test') || t.includes('interview') || t.includes('exam')) return PASTEL_THEMES[1];
  if (t.includes('dev') || t.includes('code') || t.includes('frontend') || t.includes('challenge')) return PASTEL_THEMES[2];
  if (t.includes('review') || t.includes('important')) return PASTEL_THEMES[3];
  const seed = Math.abs(Number(act.id) || (index * 3 + 1)) % PASTEL_THEMES.length;
  return PASTEL_THEMES[seed];
};

// Extract or format deadline time only (e.g. "11:59 PM" or custom time)
const getDeadlineTime = (act) => {
  if (act.dueTime && typeof act.dueTime === 'string' && act.dueTime.trim()) {
    return act.dueTime.trim();
  }
  if (act.deadline && typeof act.deadline === 'string' && act.deadline.trim()) {
    return act.deadline.trim();
  }
  if (act.dueDate && typeof act.dueDate === 'string') {
    const raw = act.dueDate.trim();
    // Check if dueDate has an explicit time component (e.g. ISO string or "YYYY-MM-DD HH:MM")
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
  // Standard academic assignment deadline time
  return '11:59 PM';
};

// Calculate Monday-based 7-day week
const getWeekDaysFromMonday = (refDate) => {
  const d = new Date(refDate);
  const day = d.getDay(); // 0 is Sun, 1 is Mon
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

export default function StudentCalendar({ classrooms }) {
  const { isDark } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 960px)');

  // Selected date and mini-calendar view month
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(() => new Date());
  const [filterClass, setFilterClass] = useState('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

  // Derive Monday of the selected week
  const weekDays = useMemo(() => {
    return getWeekDaysFromMonday(selectedDate);
  }, [selectedDate]);

  const sortedClassrooms = useMemo(() => {
    return sortClassroomsAlphabetically(classrooms);
  }, [classrooms]);

  // Load activities
  const getCachedActivities = () => {
    const all = [];
    const classList = Array.isArray(classrooms) ? classrooms : [];
    classList.forEach(c => {
      try {
        const raw = localStorage.getItem(`verity_classwork_${c.id}`);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) all.push(...list.map(cw => ({ ...cw, classroom_id: c.id })));
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
    return all.filter(item => {
      if (!item || !item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      const inClass = classList.some(c => String(c.id) === String(item.classroom_id || item.classId));
      return !item.archived && !isLegacyHardcoded(item) && !!item.dueDate && inClass;
    });
  };

  const [activities, setActivities] = useState(() => getCachedActivities());

  useEffect(() => {
    let cancelled = false;

    const fetchAllActivities = async () => {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL}/classwork`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data && Array.isArray(data.classwork)) {
            // If data.classwork is empty (offline local fallback), do NOT wipe existing cached activities!
            if (data.classwork.length === 0) return;
            const classList = Array.isArray(classrooms) ? classrooms : [];
            const valid = data.classwork.filter(
              item => !item.archived && !isLegacyHardcoded(item) && !!item.dueDate && (
                classList.length === 0 || classList.some(c => String(c.id) === String(item.classroom_id || item.classId))
              )
            );
            if (valid.length > 0) {
              setActivities(valid);
              try {
                localStorage.setItem('verity_cached_classwork', JSON.stringify(valid));
              } catch {}
            }
            return;
          }
        }
      } catch {
        if (Array.isArray(classrooms) && classrooms.length > 0) {
          try {
            const promises = classrooms.map(c =>
              apiFetch(`${import.meta.env.VITE_API_URL}/classwork/${c.id}`)
                .then(r => r.ok ? r.json() : null)
                .then(d => (d && Array.isArray(d.classwork)) ? d.classwork.map(item => ({ ...item, classroom_id: c.id })) : [])
                .catch(() => [])
            );
            const results = await Promise.all(promises);
            const merged = results.flat().filter(
              item => !item.archived && !isLegacyHardcoded(item) && !!item.dueDate
            );
            if (!cancelled && merged.length > 0) {
              setActivities(merged);
            }
          } catch {}
        }
      }
    };

    fetchAllActivities();
    return () => { cancelled = true; };
  }, [classrooms]);

  // Process activities with parsed date, time, and pastel themes
  const processedActivities = useMemo(() => {
    return activities
      .filter(act => {
        if (filterClass === 'all') return true;
        return String(act.classroom_id || act.classId) === String(filterClass);
      })
      .map((act, idx) => {
        const parsedDate = parseDueDate(act.dueDate);
        const deadlineTime = getDeadlineTime(act);
        const theme = getActivityTheme(act, idx);
        const cls = Array.isArray(classrooms) ? classrooms.find(c => String(c.id) === String(act.classroom_id || act.classId)) : null;

        return {
          ...act,
          parsedDate,
          deadlineTime,
          theme,
          className: cls ? cls.name : (act.className || ''),
          classCode: cls ? cls.code : ''
        };
      })
      .filter(act => act.parsedDate !== null);
  }, [activities, filterClass, classrooms]);

  // Week navigation
  const goPrevWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() - 7);
    setSelectedDate(next);
    setMiniCalendarMonth(new Date(next));
  };

  const goNextWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7);
    setSelectedDate(next);
    setMiniCalendarMonth(new Date(next));
  };

  const goToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setMiniCalendarMonth(new Date(today));
  };

  // Week range label e.g. "April 13 - 19, 2020"
  const weekRangeString = useMemo(() => {
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
  }, [weekDays]);

  // Mini-calendar month grid calculations (Mon to Sun)
  const miniCalendarDays = useMemo(() => {
    const year = miniCalendarMonth.getFullYear();
    const month = miniCalendarMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun, 1 is Mon
    const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startDate = new Date(year, month, 1 - startOffset);
    const cells = [];

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + i);

      // Find activities on this day
      const dayActs = processedActivities.filter(a =>
        a.parsedDate.getFullYear() === cellDate.getFullYear() &&
        a.parsedDate.getMonth() === cellDate.getMonth() &&
        a.parsedDate.getDate() === cellDate.getDate()
      );

      // Unique colored dots (up to 3)
      const dotColors = Array.from(new Set(dayActs.map(a => a.theme.dot))).slice(0, 3);

      const isCurrentMonth = cellDate.getMonth() === month;
      const isSelected = (
        cellDate.getFullYear() === selectedDate.getFullYear() &&
        cellDate.getMonth() === selectedDate.getMonth() &&
        cellDate.getDate() === selectedDate.getDate()
      );
      const isRealToday = (
        cellDate.getFullYear() === new Date().getFullYear() &&
        cellDate.getMonth() === new Date().getMonth() &&
        cellDate.getDate() === new Date().getDate()
      );

      cells.push({
        date: cellDate,
        dayNum: cellDate.getDate(),
        isCurrentMonth,
        isSelected,
        isRealToday,
        dotColors
      });
    }
    return cells;
  }, [miniCalendarMonth, selectedDate, processedActivities]);

  const goPrevMonth = () => {
    setMiniCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setMiniCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const styles = getStyles(isDark, isMobile);

  return (
    <div style={styles.container}>
      {/* ═══ TOP CONTROL BAR (Classroom filter & Today) ═══ */}
      <div style={styles.topControlBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={goToday}
            style={styles.todayBtn}
            className="btn-anim"
            title="Jump to current week"
          >
            Today
          </button>

          {/* Classroom Filter Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsDropdownOpen(prev => !prev)}
              style={styles.filterDropdownBtn}
              className="btn-anim"
            >
              <span>
                {filterClass === 'all'
                  ? 'All Classrooms'
                  : classrooms.find(c => String(c.id) === String(filterClass))?.name || 'Selected Class'}
              </span>
              <ChevronDown size={14} style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {isDropdownOpen && (
              <div style={styles.dropdownMenu}>
                <div
                  onClick={() => { setFilterClass('all'); setIsDropdownOpen(false); }}
                  style={styles.dropdownItem(filterClass === 'all')}
                >
                  All Classrooms
                </div>
                {sortedClassrooms.map(c => (
                  <div
                    key={c.id}
                    onClick={() => { setFilterClass(String(c.id)); setIsDropdownOpen(false); }}
                    style={styles.dropdownItem(filterClass === String(c.id))}
                  >
                    {c.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '500' }}>
          {processedActivities.length} scheduled event{processedActivities.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* ═══ MAIN CALENDAR CONTENT (Mini Calendar Left + Week View Right) ═══ */}
      <div style={styles.mainLayout}>

        {/* ─── LEFT: MINI MONTH CALENDAR CARD ─── */}
        <div style={styles.miniCalendarCard}>
          {/* Mini Calendar Header */}
          <div style={styles.miniHeader}>
            <span style={styles.miniMonthTitle}>
              {MONTH_NAMES[miniCalendarMonth.getMonth()]} {miniCalendarMonth.getFullYear()}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={goPrevMonth}
                style={styles.miniNavBtn}
                title="Previous month"
                className="btn-anim"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={goNextMonth}
                style={styles.miniNavBtn}
                title="Next month"
                className="btn-anim"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Labels (Mon - Sun) */}
          <div style={styles.miniWeekdaysRow}>
            {WEEKDAYS.map(day => (
              <div key={day} style={styles.miniWeekdayCell}>
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid (6 rows x 7 cols) */}
          <div style={styles.miniDaysGrid}>
            {miniCalendarDays.map((cell, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setSelectedDate(cell.date);
                  setMiniCalendarMonth(new Date(cell.date));
                }}
                style={styles.miniDayCell(cell.isSelected, cell.isCurrentMonth)}
                title={cell.date.toDateString()}
              >
                <span style={styles.miniDayNumber(cell.isSelected, cell.isCurrentMonth)}>
                  {cell.dayNum}
                </span>

                {/* Event Indicator Dots */}
                {cell.dotColors.length > 0 && (
                  <div style={styles.miniDotsRow}>
                    {cell.dotColors.map((dotColor, dIdx) => (
                      <span
                        key={dIdx}
                        style={{
                          width: '4px',
                          height: '4px',
                          borderRadius: '50%',
                          backgroundColor: dotColor
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ─── RIGHT: WEEKLY SCHEDULE CALENDAR ─── */}
        <div style={styles.weeklyContainer}>
          {/* Week Navigation Header */}
          <div style={styles.weekNavHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={goPrevWeek}
                  style={styles.weekNavBtn}
                  title="Previous week"
                  className="btn-anim"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={goNextWeek}
                  style={styles.weekNavBtn}
                  title="Next week"
                  className="btn-anim"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <h2 style={styles.weekRangeTitle}>
                {weekRangeString}
              </h2>
            </div>
          </div>

          {/* Main 7-Column Weekly Card */}
          <div style={styles.weeklyGridCard}>
            {/* Top Column Day Headers */}
            <div style={styles.weeklyHeaderRow}>
              {weekDays.map((day, idx) => {
                const isSelected = (
                  day.getFullYear() === selectedDate.getFullYear() &&
                  day.getMonth() === selectedDate.getMonth() &&
                  day.getDate() === selectedDate.getDate()
                );
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(day)}
                    style={styles.weeklyHeaderCol(isSelected, idx === 6)}
                  >
                    <span style={styles.weeklyDayName(isSelected)}>
                      {WEEKDAYS[idx].toUpperCase()}
                    </span>
                    <span style={styles.weeklyDayNumber(isSelected)}>
                      {day.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 7 Vertical Columns Body */}
            <div style={styles.weeklyColumnsBody}>
              {weekDays.map((day, dayIdx) => {
                const daysActivities = processedActivities.filter(a =>
                  a.parsedDate.getFullYear() === day.getFullYear() &&
                  a.parsedDate.getMonth() === day.getMonth() &&
                  a.parsedDate.getDate() === day.getDate()
                );

                return (
                  <div
                    key={dayIdx}
                    style={styles.weeklyDayCol(dayIdx === 6)}
                  >
                    {daysActivities.map((act) => (
                      <div
                        key={act.id}
                        onClick={() => setSelectedActivity(act)}
                        style={styles.eventCard(act.theme)}
                        className="btn-anim"
                        title={`${act.title} (Deadline: ${act.deadlineTime})`}
                      >
                        <div style={styles.eventTitle(act.theme)}>
                          {act.title}
                        </div>

                        <div style={styles.eventTime(act.theme)}>
                          {act.deadlineTime}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Subtle vertical scroll track indicator matching screenshot */}
              <div style={styles.scrollTrackIndicator}>
                <div style={styles.scrollTrackThumb} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ═══ ACTIVITY DETAILS MODAL ═══ */}
      {selectedActivity && (
        <div style={styles.modalOverlay} onClick={() => setSelectedActivity(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={styles.modalTypeBadge(selectedActivity.theme)}>
                  {selectedActivity.type || selectedActivity.activityType || 'Activity'}
                </span>
                {selectedActivity.className && (
                  <span style={styles.modalClassBadge}>
                    {selectedActivity.className}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                style={styles.modalCloseBtn}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <h3 style={styles.modalTitle}>
                {selectedActivity.title}
              </h3>

              <div style={styles.modalMetaBox}>
                <Clock size={18} color="#10b981" />
                <div>
                  <div style={{ fontSize: '0.74rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                    Scheduled Due Date & Deadline
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#0f172a' }}>
                    {selectedActivity.parsedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} • {selectedActivity.deadlineTime}
                  </div>
                </div>
              </div>

              {selectedActivity.points && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Award size={16} color="#10b981" />
                  <span style={{ fontSize: '0.86rem', color: isDark ? '#cbd5e1' : '#334155' }}>
                    Points: <strong>{selectedActivity.points} pts</strong>
                  </span>
                </div>
              )}

              {selectedActivity.details ? (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Instructions
                  </div>
                  <div
                    style={styles.modalInstructionsBody}
                    dangerouslySetInnerHTML={{ __html: selectedActivity.details }}
                  />
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  onClick={() => setSelectedActivity(null)}
                  style={styles.modalDismissBtn}
                  className="btn-anim"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const getStyles = (isDark, isMobile) => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: isDark ? '#f8fafc' : '#0f172a'
  },
  topControlBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '0 4px'
  },
  todayBtn: {
    padding: '7px 16px',
    borderRadius: '10px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#262626' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontSize: '0.84rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.04)'
  },
  filterDropdownBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 14px',
    borderRadius: '10px',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
    backgroundColor: isDark ? '#262626' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontSize: '0.84rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  dropdownMenu: {
    position: 'absolute',
    top: '38px',
    left: 0,
    zIndex: 50,
    backgroundColor: isDark ? '#262626' : '#ffffff',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: isDark ? '0 12px 28px rgba(0,0,0,0.5)' : '0 12px 28px rgba(0,0,0,0.1)',
    minWidth: '180px',
    overflow: 'hidden',
    padding: '4px'
  },
  dropdownItem: (isActive) => ({
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '0.84rem',
    fontWeight: isActive ? '700' : '500',
    color: isActive ? '#10b981' : (isDark ? '#e2e8f0' : '#334155'),
    backgroundColor: isActive ? (isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5') : 'transparent',
    cursor: 'pointer'
  }),
  mainLayout: {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: 'flex-start',
    gap: '24px',
    width: '100%'
  },
  miniCalendarCard: {
    width: isMobile ? '100%' : '270px',
    flexShrink: 0,
    backgroundColor: isDark ? '#222224' : '#ffffff',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.04)',
    border: isDark ? '1px solid #333333' : '1px solid #f1f5f9'
  },
  miniHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '18px'
  },
  miniMonthTitle: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: isDark ? '#f8fafc' : '#1e293b'
  },
  miniNavBtn: {
    background: 'none',
    border: 'none',
    padding: '4px',
    cursor: 'pointer',
    color: '#10b981',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px'
  },
  miniWeekdaysRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    textAlign: 'center',
    marginBottom: '10px'
  },
  miniWeekdayCell: {
    fontSize: '0.72rem',
    fontWeight: '600',
    color: isDark ? '#94a3b8' : '#94a3b8'
  },
  miniDaysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    rowGap: '6px',
    columnGap: '2px'
  },
  miniDayCell: (isSelected, isCurrentMonth) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '32px',
    borderRadius: '50%',
    cursor: 'pointer',
    position: 'relative',
    border: isSelected ? '1.5px solid #3b82f6' : '1.5px solid transparent',
    backgroundColor: isSelected ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : 'transparent',
    transition: 'all 0.15s ease'
  }),
  miniDayNumber: (isSelected, isCurrentMonth) => ({
    fontSize: '0.8rem',
    fontWeight: isSelected ? '800' : '600',
    color: isSelected ? '#3b82f6' : (isCurrentMonth ? (isDark ? '#f1f5f9' : '#1e293b') : (isDark ? '#64748b' : '#cbd5e1'))
  }),
  miniDotsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    position: 'absolute',
    bottom: '2px'
  },
  weeklyContainer: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  weekNavHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 4px'
  },
  weekNavBtn: {
    background: 'none',
    border: 'none',
    padding: '4px',
    cursor: 'pointer',
    color: isDark ? '#cbd5e1' : '#475569',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  weekRangeTitle: {
    margin: 0,
    fontSize: isMobile ? '1.2rem' : '1.45rem',
    fontWeight: '800',
    color: isDark ? '#f8fafc' : '#1e293b',
    letterSpacing: '-0.01em'
  },
  weeklyGridCard: {
    backgroundColor: isDark ? '#222224' : '#ffffff',
    borderRadius: '20px',
    border: isDark ? '1px solid #333333' : '1px solid #f1f5f9',
    boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  weeklyHeaderRow: {
    display: 'flex',
    borderBottom: isDark ? '1px solid #2e2e32' : '1px solid #f1f5f9',
    backgroundColor: isDark ? '#222224' : '#ffffff'
  },
  weeklyHeaderCol: (isSelected, isLast) => ({
    flex: 1,
    minWidth: 0,
    padding: '16px 8px 14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    borderRight: !isLast ? (isDark ? '1px solid #2e2e32' : '1px solid #f1f5f9') : 'none',
    transition: 'background-color 0.15s ease'
  }),
  weeklyDayName: (isSelected) => ({
    fontSize: '0.76rem',
    fontWeight: '700',
    letterSpacing: '0.04em',
    color: isSelected ? '#3b82f6' : (isDark ? '#94a3b8' : '#94a3b8'),
    marginBottom: '4px'
  }),
  weeklyDayNumber: (isSelected) => ({
    fontSize: '1.4rem',
    fontWeight: '800',
    color: isSelected ? '#3b82f6' : (isDark ? '#f1f5f9' : '#1e293b')
  }),
  weeklyColumnsBody: {
    display: 'flex',
    minHeight: '560px',
    position: 'relative',
    backgroundColor: isDark ? '#222224' : '#ffffff'
  },
  weeklyDayCol: (isLast) => ({
    flex: 1,
    minWidth: 0,
    borderRight: !isLast ? (isDark ? '1px solid #2e2e32' : '1px solid #f1f5f9') : 'none',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  }),
  eventCard: (theme) => ({
    position: 'relative',
    width: '100%',
    borderRadius: '14px',
    padding: '14px 12px 12px',
    backgroundColor: isDark ? theme.darkBg : theme.lightBg,
    color: isDark ? theme.darkText : theme.lightText,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '88px',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)',
    transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
    boxSizing: 'border-box'
  }),
  eventTitle: (theme) => ({
    fontSize: '0.84rem',
    fontWeight: '700',
    lineHeight: 1.35,
    color: isDark ? theme.darkText : theme.lightText,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    marginBottom: '8px'
  }),
  eventTime: (theme) => ({
    fontSize: '0.74rem',
    fontWeight: '700',
    color: isDark ? theme.darkTime : theme.lightTime,
    marginTop: 'auto',
    letterSpacing: '0.02em'
  }),
  scrollTrackIndicator: {
    position: 'absolute',
    right: '8px',
    top: '30%',
    bottom: '30%',
    width: '4px',
    borderRadius: '4px',
    backgroundColor: isDark ? '#333333' : '#e2e8f0',
    pointerEvents: 'none'
  },
  scrollTrackThumb: {
    width: '100%',
    height: '40px',
    borderRadius: '4px',
    backgroundColor: isDark ? '#4b5563' : '#cbd5e1'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  modalCard: {
    backgroundColor: isDark ? '#262626' : '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
    border: isDark ? '1px solid #3d3d3d' : '1px solid #e2e8f0',
    overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: isDark ? '1px solid #333333' : '1px solid #f1f5f9'
  },
  modalTypeBadge: (theme) => ({
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.74rem',
    fontWeight: '800',
    backgroundColor: isDark ? theme.darkBg : theme.lightBg,
    color: isDark ? theme.darkText : theme.lightText,
    textTransform: 'uppercase'
  }),
  modalClassBadge: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: isDark ? '#94a3b8' : '#64748b'
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: isDark ? '#94a3b8' : '#64748b',
    cursor: 'pointer',
    padding: '4px'
  },
  modalTitle: {
    margin: '0 0 14px 0',
    fontSize: '1.25rem',
    fontWeight: '800',
    color: isDark ? '#f8fafc' : '#0f172a',
    lineHeight: 1.3
  },
  modalMetaBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '10px',
    backgroundColor: isDark ? '#1f1f1f' : '#f8fafc',
    border: isDark ? '1px solid #333333' : '1px solid #e2e8f0',
    marginBottom: '14px'
  },
  modalInstructionsBody: {
    fontSize: '0.88rem',
    lineHeight: 1.55,
    color: isDark ? '#cbd5e1' : '#334155',
    maxHeight: '160px',
    overflowY: 'auto'
  },
  modalDismissBtn: {
    padding: '8px 18px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: '0.84rem',
    fontWeight: '700',
    cursor: 'pointer'
  }
});
