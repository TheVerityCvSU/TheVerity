import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import Skeleton from '../Skeleton';
import { isClassroomArchived } from '../../utils/classroomList';

export default function ClassroomsTable({
  classes,
  loading,
  isDark,
  onViewClass,
  onToggleArchive,
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
        gridTemplateColumns: 'minmax(140px, 2fr) minmax(130px, 1.5fr) minmax(110px, 1fr) minmax(90px, 1fr) minmax(100px, 1fr)',
        columnGap: '16px',
        alignItems: 'center',
        fontWeight: '700',
        color: headerColor,
        fontSize: '0.88rem',
        marginBottom: '10px',
        minWidth: '780px'
      }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Class Name</div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Instructor</div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Term / Subject</div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Status</div>
        <div style={{ textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Action</div>
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
            const isArchived = isClassroomArchived(c) || String(c.status || '').toLowerCase() === 'archived';
            const active = !isArchived;
            return (
              <div
                key={c.id || i}
                style={{
                  backgroundColor: rowBg,
                  borderRadius: '9999px',
                  padding: '10px 24px',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(140px, 2fr) minmax(130px, 1.5fr) minmax(110px, 1fr) minmax(90px, 1fr) minmax(160px, 1.2fr)',
                  columnGap: '16px',
                  alignItems: 'center',
                  fontSize: '0.875rem',
                  minWidth: '780px',
                  opacity: isArchived ? 0.85 : 1
                }}
              >
                <div style={{ fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={c.name || c.className || 'Unnamed'}>
                  {c.name || c.className || 'Unnamed'}
                </div>
                <div style={{ color: isDark ? '#cbd5e1' : '#475569', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={c.instructor || c.instructorName || 'Instructor'}>
                  <User size={14} color="#818cf8" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.instructor || c.instructorName || 'Instructor'}</span>
                </div>
                <div style={{ color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={c.term || (c.subject ? `${c.subject}` : 'General')}>
                  {c.term || (c.subject ? `${c.subject}` : 'General')}
                </div>
                <div style={{ minWidth: 0 }}>
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
                  {onToggleArchive && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onToggleArchive(c)}
                      style={{ ...styles.actionTextLink, color: isArchived ? '#10b981' : '#f59e0b' }}
                    >
                      {isArchived ? 'Unarchive' : 'Archive'}
                    </motion.button>
                  )}
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
