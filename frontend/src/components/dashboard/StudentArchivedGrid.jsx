import { motion } from 'framer-motion';
import StudentCourseCard from './StudentCourseCard';
import { cardThemes } from '../../data/studentDashboardConstants';

export default function StudentArchivedGrid({
  isMobile,
  isDark,
  textColor,
  archivedClassrooms,
  handleEnterClassroom,
  handleArchiveClass,
  handleUnarchiveClass
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', width: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '30px'
      }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: textColor }}>
          Archived Classrooms
        </h1>
      </div>

      {archivedClassrooms.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: isDark ? '#a3a3a3' : '#6b7280', fontWeight: '600' }}>
            No Archived Classrooms
          </h3>
          <p style={{ marginTop: '10px', fontSize: '0.95rem', color: isDark ? '#6b7280' : '#9ca3af', maxWidth: '420px', lineHeight: 1.5 }}>
            Classrooms that are archived will appear here.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
          gap: '24px',
          width: '100%'
        }}>
          {archivedClassrooms.map((cls, idx) => (
            <motion.div
              key={cls.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
              style={{ gridColumn: `span ${isMobile ? 12 : cardThemes[idx % cardThemes.length].colSpan}` }}
            >
              <StudentCourseCard
                classroom={cls}
                index={idx}
                colSpan={cardThemes[idx % cardThemes.length].colSpan}
                onClick={handleEnterClassroom}
                isArchived={true}
                onArchive={handleArchiveClass}
                onUnarchive={handleUnarchiveClass}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

