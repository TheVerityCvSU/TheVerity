import { X, Check, Copy } from 'lucide-react';
import ClassroomSettings from '../../pages/ClassroomSettings';
import { THEME_PRESETS } from '../../utils/themePresets';
import { saveClassroomTheme } from '../../data/classroomTheme';

/**
 * Renders classroom customization, class code display, info, settings, and bulk-grading modals.
 */
export default function TeacherClassworkSecondaryModals({
  isDark,
  styles,
  classroom,
  displayClassroom,
  classCode,
  classSettings,
  currentUser,
  socket,
  isCustomizeOpen,
  setIsCustomizeOpen,
  bannerTheme,
  setBannerTheme,
  originalBannerTheme,
  isClassCodeModalOpen,
  setIsClassCodeModalOpen,
  codeCopied,
  copyToClipboard,
  isClassInfoModalOpen,
  setIsClassInfoModalOpen,
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  handleUpdateClassroom,
  showBulkGradeModal,
  setShowBulkGradeModal,
  gradingStudents,
  maxPoints,
  bulkGradeVal,
  setBulkGradeVal,
  bulkFeedbackVal,
  setBulkFeedbackVal,
  handleApplyBulkGrade
}) {
  return (
    <>
      {isCustomizeOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsCustomizeOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.3rem' }}>Customize Appearance</h2>
                <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
                  Choose a theme color, background graphic, or image for this class banner.
                </p>
              </div>
              <button onClick={() => setIsCustomizeOpen(false)} style={styles.closeModalBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <label style={styles.fieldLabel}>Select Theme Preset:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '12px' }}>
                {THEME_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => setBannerTheme(preset)}
                    style={{
                      borderRadius: '12px',
                      padding: '10px',
                      border: bannerTheme.id === preset.id ? '2px solid #10b981' : (isDark ? '2px solid #4A4A4A' : '2px solid #e2e8f0'),
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      backgroundColor: bannerTheme.id === preset.id ? (isDark ? '#193326' : '#f0fdf4') : (isDark ? '#383838' : 'white'),
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{
                      height: '42px',
                      borderRadius: '8px',
                      background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      {bannerTheme.id === preset.id && <Check size={18} />}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b' }}>
                      {preset.name}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={styles.fieldLabel}>Or use Custom Header Image (URL):</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={bannerTheme.customImageUrl || ''}
                    onChange={(e) => setBannerTheme({ ...bannerTheme, customImageUrl: e.target.value })}
                    style={styles.input}
                  />
                  {bannerTheme.customImageUrl && (
                    <button
                      onClick={() => setBannerTheme({ ...bannerTheme, customImageUrl: '' })}
                      style={{ padding: '0 12px', border: isDark ? '1px solid #4A4A4A' : '1px solid #cbd5e1', borderRadius: '8px', background: isDark ? '#3A3A3A' : 'white', color: isDark ? '#a3a3a3' : '#64748b', cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '10px' }}>
                <button
                  onClick={() => {
                    setBannerTheme(originalBannerTheme || bannerTheme);
                    setIsCustomizeOpen(false);
                  }}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    saveClassroomTheme(classroom, bannerTheme, socket);
                    setIsCustomizeOpen(false);
                  }}
                  style={styles.saveGradeBtn}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isClassCodeModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsClassCodeModalOpen(false)}>
          <div style={{ ...styles.modalCard, maxWidth: '440px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b' }}>Class code</span>
              <button onClick={() => setIsClassCodeModalOpen(false)} style={styles.closeModalBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{
              fontSize: '3.5rem',
              fontWeight: '900',
              letterSpacing: '0.08em',
              color: '#10b981',
              padding: '24px 0',
              fontFamily: 'monospace',
              userSelect: 'all'
            }}>
              {classCode}
            </div>

            <p style={{ color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.9rem', margin: '0 0 24px 0' }}>
              Share this code with your students so they can join this class from their student dashboard.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => copyToClipboard(classCode)}
                style={{
                  ...styles.addButton,
                  backgroundColor: codeCopied ? '#059669' : '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {codeCopied ? <Check size={18} /> : <Copy size={18} />}
                {codeCopied ? 'Copied Code!' : 'Copy Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isClassInfoModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsClassInfoModalOpen(false)}>
          <div style={{ ...styles.modalCard, maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.2rem' }}>About Class</h3>
              <button onClick={() => setIsClassInfoModalOpen(false)} style={styles.closeModalBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              <div style={styles.infoFieldRow}>
                <span style={styles.infoFieldLabel}>Class Name</span>
                <span style={styles.infoFieldValue}>{displayClassroom?.name || 'Verity'}</span>
              </div>
              {displayClassroom?.description && (
                <div style={styles.infoFieldRow}>
                  <span style={styles.infoFieldLabel}>Description</span>
                  <span style={styles.infoFieldValue}>{displayClassroom.description}</span>
                </div>
              )}
              <div style={styles.infoFieldRow}>
                <span style={styles.infoFieldLabel}>Section</span>
                <span style={styles.infoFieldValue}>{displayClassroom?.section || '2'}</span>
              </div>
              <div style={styles.infoFieldRow}>
                <span style={styles.infoFieldLabel}>Subject</span>
                <span style={styles.infoFieldValue}>{displayClassroom?.subject || 'Computer Science'}</span>
              </div>
              <div style={styles.infoFieldRow}>
                <span style={styles.infoFieldLabel}>Class Code</span>
                <span style={{ ...styles.infoFieldValue, color: classSettings.inviteCodes === 'Turned off' ? '#9ca3af' : '#10b981', fontWeight: '700' }}>
                  {classSettings.inviteCodes === 'Turned off' ? 'Turned off' : classCode}
                </span>
              </div>
              <div style={styles.infoFieldRow}>
                <span style={styles.infoFieldLabel}>Instructor</span>
                <span style={styles.infoFieldValue}>{displayClassroom?.instructor || currentUser?.name || 'Instructor'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setIsClassInfoModalOpen(false)} style={styles.saveGradeBtn}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsModalOpen && (
        <ClassroomSettings
          classroom={displayClassroom}
          onClose={() => setIsSettingsModalOpen(false)}
          onUpdate={handleUpdateClassroom}
          role="teacher"
        />
      )}

      {showBulkGradeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowBulkGradeModal(false)}>
          <div style={{ ...styles.modalCard, maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.2rem' }}>Bulk Grade All Submitted</h3>
                <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
                  Assign grades to all {gradingStudents.length} student(s) who turned in this activity.
                </p>
              </div>
              <button onClick={() => setShowBulkGradeModal(false)} style={styles.closeModalBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
              <div>
                <label style={styles.fieldLabel}>Grade (out of {maxPoints}):</label>
                <input
                  type="number"
                  min="0"
                  max={maxPoints}
                  value={bulkGradeVal}
                  onChange={(e) => setBulkGradeVal(e.target.value)}
                  style={{ ...styles.input, marginTop: '6px' }}
                />
              </div>

              <div>
                <label style={styles.fieldLabel}>Feedback for all submitted:</label>
                <textarea
                  value={bulkFeedbackVal}
                  onChange={(e) => setBulkFeedbackVal(e.target.value)}
                  style={{ ...styles.input, height: '80px', marginTop: '6px', resize: 'vertical' }}
                  placeholder="e.g. Great job on this activity!"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" onClick={() => setShowBulkGradeModal(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="button" onClick={handleApplyBulkGrade} style={styles.saveGradeBtn}>
                  Apply to All ({gradingStudents.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
