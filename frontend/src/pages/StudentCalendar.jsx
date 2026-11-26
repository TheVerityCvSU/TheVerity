import CalendarView from '../components/calendar/CalendarView';

export default function StudentCalendar({ classrooms, currentUser }) {
  return <CalendarView classrooms={classrooms} isStudent={true} currentUser={currentUser} />;
}
