import React from 'react';
import { motion } from 'framer-motion';
import StudentCourseCard from './StudentCourseCard';
import Skeleton from '../Skeleton';
import { cardThemes } from '../../data/studentDashboardConstants';

export default function StudentClassroomsGrid({
  isMobile,
  loadingClassrooms,
  activeClassrooms,
  cardBg,
  textMuted,
  handleEnterClassroom,
  handleArchiveClass,
  handleUnarchiveClass,
  onOpenJoinModal
}) {
  return (
    <div style={{ flex: '1 1 0%', minWidth: 0, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Enrolled courses</h2>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
        gap: '24px'
      }}>
        {loadingClassrooms ? (
          [...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                gridColumn: `span ${isMobile ? 12 : cardThemes[i % cardThemes.length].colSpan}`
              }}
            >
              <Skeleton.CourseCard />
            </div>
          ))
        ) : (
          activeClassrooms.map((cls, idx) => (
            <motion.div
              key={cls.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
              style={{ gridColumn: `span ${isMobile ? 12 : cardThemes[idx % cardThemes.length].colSpan}` }}
            >
              <StudentCourseCard
                key={cls.id}
                classroom={cls}
                index={idx}
                colSpan={cardThemes[idx % cardThemes.length].colSpan}
                onClick={handleEnterClassroom}
                onArchive={handleArchiveClass}
                onUnarchive={handleUnarchiveClass}
                isArchived={false}
              />
            </motion.div>
          ))
        )}
        {activeClassrooms.length === 0 && !loadingClassrooms && (
          <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ color: textMuted, margin: '0 0 16px', fontSize: '0.95rem' }}>
              You have not enrolled in any courses yet.
            </p>
            <button
              onClick={onOpenJoinModal}
              style={{
                padding: '8px 20px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Join a Course
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

