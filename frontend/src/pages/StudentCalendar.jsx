import React from 'react';
import CalendarView from '../components/calendar/CalendarView';

export default function StudentCalendar({ classrooms }) {
  return <CalendarView classrooms={classrooms} />;
}
