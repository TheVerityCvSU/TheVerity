import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAYS, MONTH_NAMES } from '../../data/calendarService';

export default function MiniCalendar({
  miniCalendarMonth,
  goPrevMonth,
  goNextMonth,
  miniCalendarDays = [],
  onSelectDate,
  styles,
}) {
  return (
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
        {WEEKDAYS.map((day) => (
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
            onClick={() => onSelectDate(cell.date)}
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
                      backgroundColor: dotColor,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

