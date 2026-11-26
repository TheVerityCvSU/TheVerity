import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronDown, PlayCircle, Check } from 'lucide-react';
import Skeleton from '../Skeleton';
import { getStudentGrade, isStudentGraded } from '../../utils/gradeUtils';
import { formatShortDate } from '../../utils/dateUtils';

export default function TeacherGradesTab({
  isDark,
  isMobile,
  styles,
  displayClassroom,
  bulkToastMsg,
  isClassroomArchivedState,
  gradingStudents,
  setShowBulkGradeModal,
  loadingClasswork,
  visibleClasswork,
  gradesActivityDropdownRef,
  isGradesActivityDropdownOpen,
  setIsGradesActivityDropdownOpen,
  activeGradingActivity,
  setSelectedGradingActivityId,
  gradingGrades,
  selectedStudentId,
  setSelectedStudentId,
  maxPoints,
  classroom,
  activeTab,
  onOpenPlayback,
  studentGradeInput,
  setStudentGradeInput,
  studentFeedbackInput,
  setStudentFeedbackInput,
  handleSaveIndividualGrade,
  indivSaveStatus,
  indivSaveError
}) {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #e2e8f0', paddingBottom: '18px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontWeight: '700', fontSize: '1.4rem' }}>
            Classroom Grades
          </h2>
          <p style={{ margin: '4px 0 0 0', color: isDark ? '#a3a3a3' : '#64748b', fontSize: '0.85rem' }}>
            Review and evaluate submissions for {displayClassroom?.name || 'this class'}.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {bulkToastMsg && (
            <span style={{ padding: '6px 12px', backgroundColor: isDark ? '#133527' : '#ecfdf5', color: isDark ? '#34d399' : '#059669', fontSize: '0.8rem', borderRadius: '8px', fontWeight: '700' }}>
              {bulkToastMsg}
            </span>
          )}
          {!isClassroomArchivedState && gradingStudents.length > 0 && (
            <button
              onClick={() => setShowBulkGradeModal(true)}
              style={styles.bulkGradeActionBtn}
              title="Grade all students who submitted this activity at once"
            >
              <CheckCircle2 size={16} />
              Grade All Submitted ({gradingStudents.length})
            </button>
          )}
        </div>
      </div>

      {loadingClasswork ? (
        <Skeleton.Grading isDark={isDark} isMobile={isMobile} showActivitySelector={true} />
      ) : visibleClasswork.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: isDark ? '#a3a3a3' : '#94a3b8' }}>
          No assignments created yet in this classroom.
        </div>
      ) : (
        <>
          <div style={styles.activitySelectionRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '0.88rem', fontWeight: '700', color: isDark ? '#E8EAED' : '#334155', display: 'flex', alignItems: 'center' }}>
                Activity:
              </span>
            </div>
            <div
              ref={gradesActivityDropdownRef}
              style={{ position: 'relative', minWidth: '260px', maxWidth: '420px', flex: '1 1 auto', zIndex: 35 }}
            >
              <button
                id="grades-activity-dropdown"
                type="button"
                aria-label="Select activity"
                aria-expanded={isGradesActivityDropdownOpen}
                onClick={() => setIsGradesActivityDropdownOpen(prev => !prev)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '9px 16px',
                  borderRadius: '9999px',
                  border: isGradesActivityDropdownOpen
                    ? '1px solid #10b981'
                    : (isDark ? '1px solid #3d4447' : '1px solid #cbd5e1'),
                  backgroundColor: isDark ? '#242a2b' : '#ffffff',
                  color: isDark ? '#E8EAED' : '#1e293b',
                  fontSize: '0.88rem',
                  fontWeight: '700',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: isGradesActivityDropdownOpen
                    ? '0 0 0 3px rgba(16, 185, 129, 0.16)'
                    : (isDark ? '0 2px 8px rgba(0,0,0,0.28)' : '0 1px 3px rgba(15,23,42,0.06)'),
                  transition: 'all 0.18s ease'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeGradingActivity?.title || 'Select activity'}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    flexShrink: 0,
                    color: isGradesActivityDropdownOpen ? '#10b981' : (isDark ? '#a3a3a3' : '#64748b'),
                    transform: isGradesActivityDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease, color 0.2s ease'
                  }}
                />
              </button>

              <AnimatePresence>
                {isGradesActivityDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      right: 0,
                      backgroundColor: isDark ? '#202526' : '#ffffff',
                      border: isDark ? '1px solid #383e40' : '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '6px',
                      boxShadow: isDark
                        ? '0 14px 32px rgba(0, 0, 0, 0.55)'
                        : '0 12px 28px rgba(15, 23, 42, 0.12)',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      zIndex: 50
                    }}
                  >
                    {visibleClasswork.map(act => {
                      const isSelected = String(act.id) === String(activeGradingActivity?.id);
                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => {
                            setSelectedGradingActivityId(act.id);
                            setIsGradesActivityDropdownOpen(false);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            padding: '9px 14px',
                            borderRadius: '9999px',
                            border: 'none',
                            backgroundColor: isSelected
                              ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                              : 'transparent',
                            color: isSelected
                              ? (isDark ? '#34d399' : '#059669')
                              : (isDark ? '#E8EAED' : '#1e293b'),
                            fontSize: '0.86rem',
                            fontWeight: isSelected ? '700' : '600',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background-color 0.15s ease, color 0.15s ease'
                          }}
                          onMouseOver={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {act.title}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div style={styles.gradingColumnsLayout}>
            <div style={styles.gradingRosterCol}>
              <div style={styles.rosterHeaderBox}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: isDark ? '#E8EAED' : '#1e293b', fontWeight: '700' }}>
                  Turned In ({gradingStudents.length})
                </h4>
              </div>

              <div style={styles.gradingStudentList}>
                {gradingStudents.length === 0 ? (
                  <div style={{ padding: '30px 12px', textAlign: 'center', color: isDark ? '#a3a3a3' : '#94a3b8', fontStyle: 'italic', fontSize: '0.88rem' }}>
                    No students have submitted this activity yet.
                  </div>
                ) : (
                  gradingStudents.map(s => {
                    const curGrade = getStudentGrade(gradingGrades, s);
                    const isEvaluated = isStudentGraded(gradingGrades, s);
                    const isSelected = selectedStudentId === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedStudentId(s.id)}
                        style={{
                          ...styles.gradingStudentRow,
                          backgroundColor: isSelected ? (isDark ? '#193326' : '#ecfdf5') : (isDark ? '#383838' : '#ffffff'),
                          borderColor: isSelected ? '#10b981' : (isDark ? '#4A4A4A' : '#e2e8f0')
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: isEvaluated ? '#10b981' : '#3b82f6',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            flexShrink: 0
                          }}>
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '600', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.name}
                          </span>
                        </div>

                        <div style={{ flexShrink: 0 }}>
                          {isEvaluated ? (
                            <span style={styles.gradeBadgeGraded}>
                              {curGrade?.grade ?? maxPoints}/{maxPoints}
                            </span>
                          ) : (
                            <span style={styles.gradeBadgeTurnedIn}>
                              Turned In
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={styles.gradingEvalCol}>
              {selectedStudentId && gradingStudents.some(s => s.id === selectedStudentId) ? (
                (() => {
                  const curStudent = gradingStudents.find(s => s.id === selectedStudentId);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isDark ? '1px solid #4A4A4A' : '1px solid #f1f5f9', paddingBottom: '14px' }}>
                        <div>
                          <h3 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.2rem', fontWeight: '700' }}>
                            {curStudent.name}
                          </h3>
                          <div style={{ fontSize: '0.8rem', color: isDark ? '#a3a3a3' : '#64748b', marginTop: '4px' }}>
                            Submitted {formatShortDate(curStudent.submittedAt) || 'recently'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              try {
                                sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, activeTab);
                                sessionStorage.setItem('verity_teacher_classwork_tab_active', activeTab);
                              } catch {}
                              onOpenPlayback && onOpenPlayback(activeGradingActivity, curStudent);
                            }}
                            style={styles.playbackActionBtn}
                            title="Open recording playback"
                          >
                            <PlayCircle size={15} /> Playback
                          </button>
                        </div>
                      </div>

                      <div>
                        <label style={styles.fieldLabel}>Submitted Code:</label>
                        <pre style={styles.codePreviewPre}>
                          {curStudent.finalCode || '// No code submitted or recorded.'}
                        </pre>
                      </div>

                      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ width: '130px' }}>
                          <label style={styles.fieldLabel}>Grade ({maxPoints} max):</label>
                          <input
                            type="number"
                            min="0"
                            max={maxPoints}
                            value={studentGradeInput}
                            disabled={isClassroomArchivedState}
                            onChange={(e) => setStudentGradeInput(e.target.value)}
                            style={{ ...styles.input, opacity: isClassroomArchivedState ? 0.7 : 1 }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={styles.fieldLabel}>Private Feedback:</label>
                          <textarea
                            rows={2}
                            value={studentFeedbackInput}
                            disabled={isClassroomArchivedState}
                            onChange={(e) => setStudentFeedbackInput(e.target.value)}
                            placeholder="Add feedback for this student…"
                            style={{ ...styles.input, resize: 'vertical', opacity: isClassroomArchivedState ? 0.7 : 1 }}
                          />
                        </div>
                      </div>

                      {!isClassroomArchivedState && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                          <button
                            onClick={handleSaveIndividualGrade}
                            disabled={indivSaveStatus === 'saving'}
                            style={{
                              ...styles.saveGradeBtn,
                              backgroundColor: indivSaveStatus === 'saved' ? '#10b981' : (indivSaveStatus === 'error' ? '#ef4444' : styles.saveGradeBtn.backgroundColor),
                              cursor: indivSaveStatus === 'saving' ? 'wait' : 'pointer',
                              opacity: indivSaveStatus === 'saving' ? 0.75 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            {indivSaveStatus === 'saving' && 'Saving...'}
                            {indivSaveStatus === 'saved' && (
                              <>
                                <Check size={15} /> Saved
                              </>
                            )}
                            {indivSaveStatus === 'error' && (indivSaveError || 'Error')}
                            {indivSaveStatus === 'idle' && 'Save Grade'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  Select a student from the left roster to evaluate their submission.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
