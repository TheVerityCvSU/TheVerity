import React from 'react';
import CalendarView from '../components/calendar/CalendarView';

export default function TeacherCalendar({ classrooms }) {
  return <CalendarView classrooms={classrooms} />;
}
