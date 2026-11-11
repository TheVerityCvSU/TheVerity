import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAYS } from '../../data/calendarService';

export default function CalendarWeekGrid({
  weekDays = [],
  selectedDate,
  setSelectedDate,
  goPrevWeek,
  goNextWeek,
  weekRangeString,
  processedActivities = [],
  onSelectActivity,
  styles,
}) {
  return (
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

          <h2 style={styles.weekRangeTitle}>{weekRangeString}</h2>
        </div>
      </div>

      {/* Main 7-Column Weekly Card */}
      <div style={styles.weeklyGridCard}>
        {/* Top Column Day Headers */}
        <div style={styles.weeklyHeaderRow}>
          {weekDays.map((day, idx) => {
            const isSelected =
              day.getFullYear() === selectedDate.getFullYear() &&
              day.getMonth() === selectedDate.getMonth() &&
              day.getDate() === selectedDate.getDate();
            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(day)}
                style={styles.weeklyHeaderCol(isSelected, idx === 6)}
              >
                <span style={styles.weeklyDayName(isSelected)}>{WEEKDAYS[idx].toUpperCase()}</span>
                <span style={styles.weeklyDayNumber(isSelected)}>{day.getDate()}</span>
              </div>
            );
          })}
        </div>

        {/* 7 Vertical Columns Body */}
        <div style={styles.weeklyColumnsBody}>
          {weekDays.map((day, dayIdx) => {
            const daysActivities = processedActivities.filter(
              (a) =>
                a.parsedDate.getFullYear() === day.getFullYear() &&
                a.parsedDate.getMonth() === day.getMonth() &&
                a.parsedDate.getDate() === day.getDate()
            );

            return (
              <div key={dayIdx} style={styles.weeklyDayCol(dayIdx === 6)}>
                {daysActivities.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => onSelectActivity(act)}
                    style={styles.eventCard(act.theme)}
                    className="btn-anim"
                    title={`${act.title} (Deadline: ${act.deadlineTime})`}
                  >
                    <div style={styles.eventTitle(act.theme)}>{act.title}</div>
                    <div style={styles.eventTime(act.theme)}>{act.deadlineTime}</div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Subtle vertical scroll track indicator */}
          <div style={styles.scrollTrackIndicator}>
            <div style={styles.scrollTrackThumb} />
          </div>
        </div>
      </div>
    </div>
  );
}

