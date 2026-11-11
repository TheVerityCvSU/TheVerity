import React from 'react';

export default function ClassDetailsSection({ formData, setFormData, role, styles }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>Class Details</h2>

      <div style={styles.inputGroup}>
        <div style={styles.inputWrapper}>
          <label style={styles.floatingLabel}>Class name (required)</label>
          <input
            style={styles.input}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            readOnly={role === 'student'}
          />
        </div>
      </div>

      <div style={styles.inputGroup}>
        <div style={styles.inputWrapper}>
          <label style={styles.floatingLabel}>Class description</label>
          <input
            style={styles.input}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            readOnly={role === 'student'}
          />
        </div>
      </div>

      <div style={styles.inputGroup}>
        <div style={styles.inputWrapper}>
          <label style={styles.floatingLabel}>Section</label>
          <input
            style={styles.input}
            value={formData.section}
            onChange={(e) => setFormData({ ...formData, section: e.target.value })}
            readOnly={role === 'student'}
          />
        </div>
      </div>

      <div style={styles.inputGroup}>
        <div style={styles.inputWrapper}>
          <label style={styles.floatingLabel}>Subject</label>
          <input
            style={styles.input}
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            readOnly={role === 'student'}
          />
        </div>
      </div>
    </div>
  );
}

