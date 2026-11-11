import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function TeacherViewGradeModal({
  show,
  onClose,
  activeStudent,
  assignment,
  gradeInput,
  setGradeInput,
  feedbackInput,
  setFeedbackInput,
  onSaveGrade,
  theme
}) {
  return (
    <AnimatePresence>
      {show && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            style={{
              backgroundColor: theme.cardBg,
              borderRadius: '14px',
              padding: '24px',
              width: '100%',
              maxWidth: '440px',
              border: `1px solid ${theme.border}`,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px'
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: theme.textPrimary, fontSize: '1.2rem', fontWeight: '700' }}>
                  Grade {activeStudent?.name}
                </h3>
                <p style={{ margin: '4px 0 0 0', color: theme.textSecondary, fontSize: '0.85rem' }}>
                  Assign a grade for {assignment?.title || 'this assignment'}.
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: theme.textMuted,
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.88rem',
                    fontWeight: '600',
                    color: theme.textPrimary
                  }}
                >
                  Grade (Max: {assignment?.points || 100}):
                </label>
                <input
                  type="number"
                  min="0"
                  max={assignment?.points || 100}
                  value={gradeInput}
                  onChange={(e) => setGradeInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.bg,
                    color: theme.textPrimary,
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.88rem',
                    fontWeight: '600',
                    color: theme.textPrimary
                  }}
                >
                  Instructor Feedback:
                </label>
                <textarea
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="e.g. Clean solution, good variable names!"
                  style={{
                    width: '100%',
                    height: '85px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.bg,
                    color: theme.textPrimary,
                    fontSize: '0.9rem',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: 'transparent',
                    color: theme.textSecondary,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSaveGrade}
                  style={{
                    padding: '9px 20px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '700'
                  }}
                >
                  Save Grade
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
