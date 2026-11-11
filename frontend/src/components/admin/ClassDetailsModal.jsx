import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, UserPlus, Check } from 'lucide-react';

export default function ClassDetailsModal({
  viewClass,
  isDark,
  onClose,
  viewStudents,
  viewLoadingStudents,
  viewStudentQuery,
  setViewStudentQuery,
  showAddStudentsInView,
  setShowAddStudentsInView,
  selectedAddStudentIds,
  setSelectedAddStudentIds,
  addStudentQuery,
  setAddStudentQuery,
  availableStudentsForView,
  onEnrollStudents,
  styles,
  tagBg,
  headerBg,
  headerColor,
  rowBg,
  muted
}) {
  return (
    <AnimatePresence>
      {viewClass && (
        <motion.div style={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            style={{ ...styles.modalCard, maxWidth: '640px' }}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                  {viewClass.name || viewClass.className || 'Class Details'}
                </h2>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#15803d' }}>
                  Active
                </span>
              </div>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onClose} style={styles.closeBtn}>
                <X size={20} />
              </motion.button>
            </div>

            {/* Class Info Pills */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#475569' }}>
                Instructor: <strong style={{ backgroundColor: tagBg, borderRadius: '9999px', padding: '3px 12px', color: isDark ? '#f1f5f9' : '#1e293b' }}>{viewClass.instructor || viewClass.instructorName || 'Fixed Instructor'}</strong>
              </span>
              <span style={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#475569' }}>
                Subject: <strong style={{ backgroundColor: tagBg, borderRadius: '9999px', padding: '3px 12px', color: isDark ? '#f1f5f9' : '#1e293b' }}>{viewClass.subject || viewClass.term || 'General'}</strong>
              </span>
              <span style={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#475569' }}>
                Code: <strong style={{ backgroundColor: '#dcfce7', borderRadius: '9999px', padding: '3px 12px', color: '#15803d', fontFamily: 'monospace', fontWeight: '800' }}>{viewClass.code || 'N/A'}</strong>
              </span>
              <span style={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#475569' }}>
                Enrolled Students: <strong style={{ backgroundColor: '#e0e7ff', borderRadius: '9999px', padding: '3px 12px', color: '#4338ca', fontWeight: '800' }}>{viewStudents.length}</strong>
              </span>
            </div>

            {/* Action Bar inside View Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div style={{ ...styles.searchPill, maxWidth: '320px', flex: 1, padding: '6px 14px' }}>
                <Search size={14} color={muted} />
                <input
                  className="search-clean-input"
                  value={viewStudentQuery}
                  onChange={e => setViewStudentQuery(e.target.value)}
                  placeholder="Search enrolled students..."
                  style={{ ...styles.searchInput, fontSize: '0.82rem', border: 'none', outline: 'none' }}
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowAddStudentsInView(o => !o)}
                style={styles.actionBtn}
                className="btn-anim"
              >
                <UserPlus size={15} />
                <span>{showAddStudentsInView ? 'Close Picker' : 'Add Students'}</span>
              </motion.button>
            </div>

            {/* Add Students Drawer/Section */}
            <AnimatePresence>
              {showAddStudentsInView && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    backgroundColor: isDark ? '#262626' : '#f1f5f9',
                    borderRadius: '16px',
                    padding: '14px',
                    marginBottom: '16px',
                    border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: '700', color: isDark ? '#f4f4f5' : '#1e293b' }}>
                      Enroll Registered Students
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: '700' }}>
                      {selectedAddStudentIds.size} selected
                    </span>
                  </div>

                  <div style={{ ...styles.searchPill, flex: 'none', maxWidth: '320px', padding: '6px 12px', backgroundColor: isDark ? '#1e1e1e' : 'white' }}>
                    <Search size={13} color={muted} />
                    <input
                      className="search-clean-input"
                      value={addStudentQuery}
                      onChange={e => setAddStudentQuery(e.target.value)}
                      placeholder="Search available students..."
                      style={{ ...styles.searchInput, fontSize: '0.8rem', border: 'none', outline: 'none' }}
                    />
                  </div>

                  <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {availableStudentsForView.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '12px', color: muted, fontSize: '0.8rem' }}>
                        No additional students available to enroll
                      </div>
                    ) : (
                      availableStudentsForView.map(st => {
                        const isSelected = selectedAddStudentIds.has(st.id || st.email);
                        return (
                          <div
                            key={st.id || st.email}
                            style={styles.studentItem(isSelected)}
                            onClick={() => {
                              const key = st.id || st.email;
                              setSelectedAddStudentIds(prev => {
                                const next = new Set(prev);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                              });
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: '600', color: isDark ? '#f4f4f5' : '#1e293b' }}>
                                {st.name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: isDark ? '#a1a1aa' : '#64748b' }}>
                                {st.email}
                              </div>
                            </div>
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '5px',
                              backgroundColor: isSelected ? '#10b981' : 'transparent',
                              border: isSelected ? '1px solid #10b981' : (isDark ? '1px solid #52525b' : '1px solid #cbd5e1'),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {isSelected && <Check size={12} color="white" />}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onEnrollStudents}
                    disabled={selectedAddStudentIds.size === 0}
                    style={{
                      ...styles.submitBlueBtn,
                      padding: '9px',
                      fontSize: '0.85rem',
                      backgroundColor: selectedAddStudentIds.size > 0 ? '#10b981' : (isDark ? '#3f3f46' : '#cbd5e1'),
                      cursor: selectedAddStudentIds.size > 0 ? 'pointer' : 'not-allowed',
                      boxShadow: selectedAddStudentIds.size > 0 ? '0 4px 10px rgba(16, 185, 129, 0.3)' : 'none'
                    }}
                  >
                    Enroll {selectedAddStudentIds.size} Student{selectedAddStudentIds.size === 1 ? '' : 's'}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Enrolled Students Table */}
            <div style={styles.tableWrap}>
              <div style={{ backgroundColor: headerBg, borderRadius: '9999px', padding: '10px 20px', display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr', alignItems: 'center', fontWeight: '700', color: headerColor, fontSize: '0.85rem', marginBottom: '8px' }}>
                <div>Student Name</div><div>Email Address</div><div>Enrollment</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {viewLoadingStudents ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: muted }}>Loading student roster...</div>
                ) : viewStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: muted }}>No students currently enrolled</div>
                ) : (
                  viewStudents
                    .filter(st => {
                      const q = viewStudentQuery.toLowerCase();
                      return !q || (st.name || '').toLowerCase().includes(q) || (st.email || '').toLowerCase().includes(q);
                    })
                    .map((st, i) => (
                      <div key={i} style={{ backgroundColor: rowBg, borderRadius: '9999px', padding: '8px 20px', display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr', alignItems: 'center', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>{st.name}</div>
                        <div style={{ color: muted }}>{st.email}</div>
                        <div><span style={styles.statusGreenPill}>Enrolled</span></div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
