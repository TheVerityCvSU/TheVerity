
export default function ClassDetailsSection({ formData, setFormData, nameError = '', role, isDark, styles }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>Class Details</h2>

      <div style={styles.inputGroup}>
        <div
          style={{
            ...styles.inputWrapper,
            borderBottom: nameError
              ? '2px solid #ef4444'
              : styles.inputWrapper.borderBottom,
          }}
        >
          <label style={styles.floatingLabel}>Class name (required)</label>
          <input
            style={styles.input}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            readOnly={role === 'student'}
            placeholder="e.g., Object-Oriented Programming"
          />
        </div>
        {nameError && (
          <div style={{ marginTop: '6px', fontSize: '0.78rem', fontWeight: '600', color: isDark ? '#f87171' : '#dc2626' }}>
            {nameError}
          </div>
        )}
      </div>

      <div style={styles.inputGroup}>
        <div style={styles.inputWrapper}>
          <label style={styles.floatingLabel}>Class description</label>
          <textarea
            rows={2}
            style={{ ...styles.input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.45 }}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            readOnly={role === 'student'}
            placeholder="Add course syllabus, schedule, or class overview"
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
            placeholder="e.g., BSCS 3-A"
          />
        </div>
      </div>

      <div style={{ ...styles.inputGroup, marginBottom: 0 }}>
        <div style={styles.inputWrapper}>
          <label style={styles.floatingLabel}>Subject</label>
          <input
            style={styles.input}
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            readOnly={role === 'student'}
            placeholder="e.g., CS 301"
          />
        </div>
      </div>
    </div>
  );
}
