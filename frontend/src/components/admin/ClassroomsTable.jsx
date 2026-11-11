import React from 'react';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import Skeleton from '../Skeleton';

export default function ClassroomsTable({
  classes,
  loading,
  isDark,
  onViewClass,
  onDeleteClass,
  styles,
  headerBg,
  headerColor,
  rowBg,
  muted
}) {
  return (
    <div style={styles.tableWrap}>
      <div style={{
        backgroundColor: headerBg,
        borderRadius: '9999px',
        padding: '12px 24px',
        display: 'grid',
        gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
        alignItems: 'center',
        fontWeight: '700',
        color: headerColor,
        fontSize: '0.88rem',
        marginBottom: '10px'
      }}>
        <div>Class Name</div>
        <div>Instructor</div>
        <div>Term / Subject</div>
        <div>Status</div>
        <div style={{ textAlign: 'right' }}>Action</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton.Row key={i} />)
        ) : classes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: muted }}>
            No classrooms found
          </div>
        ) : (
          classes.map((c, i) => {
            const active = c.status === 'Active' || c.isActive || true;
            return (
              <div
                key={i}
                style={{
                  backgroundColor: rowBg,
                  borderRadius: '9999px',
                  padding: '10px 24px',
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
                  alignItems: 'center',
                  fontSize: '0.875rem'
                }}
              >
                <div style={{ fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                  {c.name || c.className || 'Unnamed'}
                </div>
                <div style={{ color: isDark ? '#cbd5e1' : '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} color="#818cf8" />
                  <span>{c.instructor || c.instructorName || 'Instructor'}</span>
                </div>
                <div style={{ color: muted }}>
                  {c.term || (c.subject ? `${c.subject}` : 'General')}
                </div>
                <div>
                  <span style={active ? styles.statusGreenPill : styles.statusRedPill}>
                    {active ? 'Active' : 'Archived'}
                  </span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onViewClass(c)}
                    style={styles.actionTextLink}
                  >
                    View
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onDeleteClass(c)}
                    style={{ ...styles.actionTextLink, color: '#ef4444' }}
                  >
                    Delete
                  </motion.button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
