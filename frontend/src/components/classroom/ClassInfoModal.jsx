import { X } from 'lucide-react';

export default function ClassInfoModal({
  isOpen,
  onClose,
  classroom,
  isDark,
  styles
}) {
  if (!isOpen) return null;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.infoModalContent} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: isDark ? '#f5f5f5' : '#1e293b' }}>
            Class Details
          </h3>
          <button
            onClick={onClose}
            style={styles.closeBtn}
          >
            <X size={20} color={isDark ? '#a3a3a3' : '#64748b'} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={styles.infoFieldLabel}>Subject / Course</label>
            <div style={styles.infoFieldValue}>{classroom?.subject || classroom?.name || 'General Studies'}</div>
          </div>
          {classroom?.description && (
            <div>
              <label style={styles.infoFieldLabel}>Description</label>
              <div style={styles.infoFieldValue}>{classroom.description}</div>
            </div>
          )}
          <div>
            <label style={styles.infoFieldLabel}>Section</label>
            <div style={styles.infoFieldValue}>{classroom?.section || 'Section 1'}</div>
          </div>
          <div>
            <label style={styles.infoFieldLabel}>Instructor</label>
            <div style={styles.infoFieldValue}>{classroom?.instructor || 'Instructor'}</div>
          </div>
          <div>
            <label style={styles.infoFieldLabel}>Room / Campus</label>
            <div style={styles.infoFieldValue}>{classroom?.room || 'Online Virtual Lab'}</div>
          </div>
        </div>
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={styles.infoCloseActionBtn}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
