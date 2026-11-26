import { motion } from 'framer-motion';
import TeacherCourseCard from './TeacherCourseCard';
import { getCardColSpan } from '../../data/teacherDashboardConstants';

export default function TeacherArchivedGrid({
  isDark,
  isMobile,
  archivedClassrooms,
  activeClassroomCounts,
  onEnterClassroom,
  onArchiveClass,
  onUnarchiveClass,
  onDeleteClass,
  allowDelete,
  currentUser
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        padding: '0 4px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: isDark ? '#f5f5f5' : '#111827' }}>
            Archived Classrooms
          </h2>
          <span style={{
            fontSize: '0.8rem',
            fontWeight: '700',
            padding: '3px 10px',
            borderRadius: '9999px',
            backgroundColor: isDark ? 'rgba(156, 163, 175, 0.15)' : '#f3f4f6',
            color: isDark ? '#9ca3af' : '#4b5563'
          }}>
            {archivedClassrooms.length} Archived
          </span>
        </div>
      </div>

      {archivedClassrooms.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: isDark ? '#6b7280' : '#9ca3af'
        }}>
          <h3 style={{ margin: 0, color: isDark ? '#a3a3a3' : '#6b7280' }}>No Archived Classrooms</h3>
          <p style={{ marginTop: '10px', color: isDark ? '#6b7280' : '#9ca3af' }}>Classrooms you archive will appear here.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
          gap: '24px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {archivedClassrooms.map((cls, idx) => {
            const span = getCardColSpan(idx, archivedClassrooms.length, isMobile);
            return (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  gridColumn: `span ${span}`,
                  width: '100%',
                  minWidth: 0
                }}
              >
                <TeacherCourseCard
                  classroom={cls}
                  index={idx}
                  colSpan={span}
                  onClick={onEnterClassroom}
                  onArchive={onArchiveClass}
                  onUnarchive={onUnarchiveClass}
                  onDelete={(allowDelete || currentUser?.role === 'Admin') ? onDeleteClass : undefined}
                  isArchived={true}
                  activeCount={Number(
                    activeClassroomCounts[String(cls.id)] ||
                    activeClassroomCounts[String(cls.code || '').toLowerCase()] ||
                    activeClassroomCounts[String(cls.code || '')] ||
                    0
                  )}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

