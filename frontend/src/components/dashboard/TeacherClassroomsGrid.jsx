import React from 'react';
import { Plus, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import TeacherCourseCard from './TeacherCourseCard';
import { getCardColSpan } from '../../data/teacherDashboardConstants';
import Skeleton from '../Skeleton';

export default function TeacherClassroomsGrid({
  isDark,
  isMobile,
  activeClassrooms,
  loadingClassrooms,
  activeClassroomCounts,
  onOpenCreateModal,
  onEnterClassroom,
  onArchiveClass,
  onUnarchiveClass,
  onSettings,
  onDeleteClass,
  allowDelete,
  currentUser
}) {
  return (
    <div>
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
            Active Classrooms
          </h2>
        </div>

        <motion.button
          whileHover={{ scale: 1.04, boxShadow: '0 10px 25px rgba(16,185,129,0.4)' }}
          whileTap={{ scale: 0.96 }}
          onClick={onOpenCreateModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '0.95rem',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(16,185,129,0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          <Plus size={18} strokeWidth={2.5} />
          Create Class
        </motion.button>
      </div>

      {/* Classroom Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
        gap: '24px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {loadingClassrooms ? (
          [...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                gridColumn: `span ${isMobile ? 12 : getCardColSpan(i, 4, isMobile)}`,
              }}
            >
              <Skeleton.Card />
            </div>
          ))
        ) : activeClassrooms.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '50px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            borderRadius: '20px',
            border: isDark ? '1.5px dashed #404040' : '1.5px dashed #cbd5e1'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: isDark ? '#262626' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px'
            }}>
              <Home size={28} color="#10b981" />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: '700', color: isDark ? '#f5f5f5' : '#1e293b' }}>
              No Classrooms Yet
            </h3>
            <p style={{ margin: '0 0 16px', maxWidth: '380px', fontSize: '0.88rem', color: isDark ? '#a3a3a3' : '#64748b' }}>
              Click <strong>Create Class</strong> above to create your first classroom.
            </p>
          </div>
        ) : activeClassrooms.map((cls, idx) => {
          const span = getCardColSpan(idx, activeClassrooms.length, isMobile);
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
                onSettings={onSettings}
                onDelete={(allowDelete || currentUser?.role === 'Admin') ? onDeleteClass : undefined}
                isArchived={false}
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
    </div>
  );
}

