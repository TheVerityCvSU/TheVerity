import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Check } from 'lucide-react';

export default function CreateClassModal({
  isOpen,
  isDark = false,
  onClose,
  onSubmit,
  isSubmitting = false,
  newClass = { name: '', section: '', subject: '', instructor: '', code: '' },
  setNewClass = () => {},
  teacherOptions = [],
  selectedCreateStudentIds = new Set(),
  setSelectedCreateStudentIds = () => {},
  createStudentQuery = '',
  setCreateStudentQuery = () => {},
  availableStudents = [],
  styles = {},
  muted
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div style={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            style={{ ...styles.modalCard, maxWidth: '520px' }}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>Create New Class</h2>
              <motion.button
                whileHover={isSubmitting ? {} : { scale: 1.05 }}
                whileTap={isSubmitting ? {} : { scale: 0.95 }}
                onClick={onClose}
                disabled={isSubmitting}
                style={{ ...styles.closeBtn, opacity: isSubmitting ? 0.5 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                <X size={20} />
              </motion.button>
            </div>

            <form onSubmit={onSubmit} style={styles.form}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#94a3b8' : '#475569', marginBottom: '6px' }}>Class Name *</label>
                <input required value={newClass.name} onChange={e => setNewClass({ ...newClass, name: e.target.value })} placeholder="e.g. Computer Science 101" style={styles.inputPill} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#94a3b8' : '#475569', marginBottom: '6px' }}>Section</label>
                  <input value={newClass.section} onChange={e => setNewClass({ ...newClass, section: e.target.value })} placeholder="e.g. Section A" style={styles.inputPill} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#94a3b8' : '#475569', marginBottom: '6px' }}>Subject</label>
                  <input value={newClass.subject} onChange={e => setNewClass({ ...newClass, subject: e.target.value })} placeholder="e.g. Programming" style={styles.inputPill} />
                </div>
              </div>

              {/* Single Instructor Only */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#94a3b8' : '#475569', marginBottom: '6px' }}>
                  <span>Instructor (1 Assigned) *</span>
                  <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700' }}>Fixed</span>
                </label>
                <select
                  required
                  value={newClass.instructor}
                  onChange={e => setNewClass({ ...newClass, instructor: e.target.value })}
                  style={{ ...styles.inputPill, cursor: 'pointer', appearance: 'auto' }}
                >
                  <option value="">Select Instructor...</option>
                  {teacherOptions.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Add Students Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#94a3b8' : '#475569' }}>
                    Add Students (Optional)
                  </label>
                  <span style={{ fontSize: '0.78rem', color: '#007bff', fontWeight: '600' }}>
                    {selectedCreateStudentIds.size} selected
                  </span>
                </div>

                {/* Student Search */}
                <div style={{ ...styles.searchPill, flex: 'none', maxWidth: '320px', marginBottom: '8px', padding: '6px 14px' }}>
                  <Search size={14} color={muted} />
                  <input
                    value={createStudentQuery}
                    onChange={e => setCreateStudentQuery(e.target.value)}
                    placeholder="Filter registered students..."
                    style={{ ...styles.searchInput, fontSize: '0.82rem' }}
                  />
                </div>

                {/* Student Checklist */}
                <div style={styles.studentPickerBox}>
                  {availableStudents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: muted, fontSize: '0.8rem' }}>
                      No registered students found
                    </div>
                  ) : (
                    availableStudents.map((st) => {
                      const isSelected = selectedCreateStudentIds.has(st.id || st.email);
                      return (
                        <div
                          key={st.id || st.email}
                          style={styles.studentItem(isSelected)}
                          onClick={() => {
                            const key = st.id || st.email;
                            setSelectedCreateStudentIds(prev => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            });
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: '600', color: isDark ? '#f4f4f5' : '#1e293b' }}>
                              {st.name}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: isDark ? '#a1a1aa' : '#64748b' }}>
                              {st.email}
                            </div>
                          </div>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '6px',
                            backgroundColor: isSelected ? '#007bff' : 'transparent',
                            border: isSelected ? '1px solid #007bff' : (isDark ? '1px solid #52525b' : '1px solid #cbd5e1'),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {isSelected && <Check size={13} color="white" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <motion.button
                whileHover={isSubmitting ? {} : { scale: 1.02 }}
                whileTap={isSubmitting ? {} : { scale: 0.98 }}
                type="submit"
                disabled={isSubmitting}
                style={{
                  ...styles.submitBlueBtn,
                  marginTop: '8px',
                  opacity: isSubmitting ? 0.7 : 1,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? 'Creating Classroom...' : 'Create Classroom'}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
