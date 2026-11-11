import React, { useState, useEffect, useMemo } from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { sortClassroomsAlphabetically } from '../../utils/classroomList';
import {
  getWeekDaysFromMonday,
  getWeekRangeString,
  getCachedActivities,
  fetchAllActivitiesApi,
  parseDueDate,
  getDeadlineTime,
  getActivityTheme,
} from '../../data/calendarService';
import { getStyles } from './calendarStyles';
import CalendarHeader from './CalendarHeader';
import MiniCalendar from './MiniCalendar';
import CalendarWeekGrid from './CalendarWeekGrid';
import ActivityDetailModal from './ActivityDetailModal';

export default function CalendarView({ classrooms = [] }) {
  const { isDark } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 960px)');

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(() => new Date());
  const [filterClass, setFilterClass] = useState('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [activities, setActivities] = useState(() => getCachedActivities(classrooms));

  const weekDays = useMemo(() => getWeekDaysFromMonday(selectedDate), [selectedDate]);
  const sortedClassrooms = useMemo(() => sortClassroomsAlphabetically(classrooms), [classrooms]);
  const weekRangeString = useMemo(() => getWeekRangeString(weekDays), [weekDays]);

  useEffect(() => {
    let cancelled = false;
    fetchAllActivitiesApi(classrooms).then((valid) => {
      if (!cancelled && valid && valid.length > 0) {
        setActivities(valid);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [classrooms]);

  const processedActivities = useMemo(() => {
    return activities
      .filter((act) => {
        if (filterClass === 'all') return true;
        return String(act.classroom_id || act.classId) === String(filterClass);
      })
      .map((act, idx) => {
        const parsedDate = parseDueDate(act.dueDate);
        const deadlineTime = getDeadlineTime(act);
        const theme = getActivityTheme(act, idx);
        const cls = Array.isArray(classrooms)
          ? classrooms.find((c) => String(c.id) === String(act.classroom_id || act.classId))
          : null;

        return {
          ...act,
          parsedDate,
          deadlineTime,
          theme,
          className: cls ? cls.name : act.className || '',
          classCode: cls ? cls.code : '',
        };
      })
      .filter((act) => act.parsedDate !== null);
  }, [activities, filterClass, classrooms]);

  const miniCalendarDays = useMemo(() => {
    const year = miniCalendarMonth.getFullYear();
    const month = miniCalendarMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstDayOfMonth.getDay();
    const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startDate = new Date(year, month, 1 - startOffset);
    const cells = [];

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + i);

      const dayActs = processedActivities.filter(
        (a) =>
          a.parsedDate.getFullYear() === cellDate.getFullYear() &&
          a.parsedDate.getMonth() === cellDate.getMonth() &&
          a.parsedDate.getDate() === cellDate.getDate()
      );

      const dotColors = Array.from(new Set(dayActs.map((a) => a.theme.dot))).slice(0, 3);
      const isCurrentMonth = cellDate.getMonth() === month;
      const isSelected =
        cellDate.getFullYear() === selectedDate.getFullYear() &&
        cellDate.getMonth() === selectedDate.getMonth() &&
        cellDate.getDate() === selectedDate.getDate();

      cells.push({
        date: cellDate,
        dayNum: cellDate.getDate(),
        isCurrentMonth,
        isSelected,
        dotColors,
      });
    }
    return cells;
  }, [miniCalendarMonth, selectedDate, processedActivities]);

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

  const goPrevMonth = () => {
    setMiniCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setMiniCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const styles = getStyles(isDark, isMobile);

  return (
    <div style={styles.container}>
      <CalendarHeader
        goToday={goToday}
        filterClass={filterClass}
        setFilterClass={setFilterClass}
        isDropdownOpen={isDropdownOpen}
        setIsDropdownOpen={setIsDropdownOpen}
        sortedClassrooms={sortedClassrooms}
        classrooms={classrooms}
        eventsCount={processedActivities.length}
        isDark={isDark}
        styles={styles}
      />

      <div style={styles.mainLayout}>
        <MiniCalendar
          miniCalendarMonth={miniCalendarMonth}
          goPrevMonth={goPrevMonth}
          goNextMonth={goNextMonth}
          miniCalendarDays={miniCalendarDays}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setMiniCalendarMonth(new Date(date));
          }}
          styles={styles}
        />

        <CalendarWeekGrid
          weekDays={weekDays}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          goPrevWeek={goPrevWeek}
          goNextWeek={goNextWeek}
          weekRangeString={weekRangeString}
          processedActivities={processedActivities}
          onSelectActivity={setSelectedActivity}
          styles={styles}
        />
      </div>

      <ActivityDetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        isDark={isDark}
        styles={styles}
      />
    </div>
  );
}

