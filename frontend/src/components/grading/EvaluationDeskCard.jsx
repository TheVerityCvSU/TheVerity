import { 
  ClipboardList, CheckCircle2, Clock, PlayCircle, Code2, Copy, Check, 
  Award, RefreshCw, CheckCheck, AlertCircle 
} from 'lucide-react';
import { isStudentGraded, getStudentGrade } from '../../utils/gradeUtils';
import { formatFullDate, formatShortDate } from '../../utils/dateUtils';

export default function EvaluationDeskCard({
  selectedStudent,
  assignment,
  maxPoints,
  grades,
  gradeInput,
  setGradeInput,
  feedbackInput,
  setFeedbackInput,
  scorePresets,
  saveStatus,
  saveError,
  onEvaluate,
  onClearGrade,
  onOpenPlayback,
  onStartMonitoring,
  onOpenFullscreenCode,
  copiedCode,
  onCopyCode,
  isDark,
  styles
}) {
  if (!selectedStudent) {
    return (
      <div style={styles.evalCard}>
        <div style={styles.emptyEval}>
          <ClipboardList size={52} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ margin: 0, color: isDark ? '#f1f5f9' : '#0f172a', fontSize: '1.2rem', fontWeight: '700' }}>
            Select a Student
          </h3>
          <p style={{ margin: '6px 0 0 0', color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.9rem', maxWidth: '360px', lineHeight: 1.5 }}>
            Choose a student from the roster on the left to inspect their submitted code, review VCR proctoring playback, and assign their score and feedback.
          </p>
        </div>
      </div>
    );
  }

  const isGraded = isStudentGraded(grades, selectedStudent);
  const currentGrade = getStudentGrade(grades, selectedStudent);

  return (
    <div style={styles.evalCard}>
      {/* Selected Student Banner */}
      <div style={styles.evalStudentHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <div style={styles.evalLargeAvatar}>
            {selectedStudent.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={styles.evalStudentName}>
              {selectedStudent.name}
            </h2>
            <div style={styles.evalStudentSub}>
              {selectedStudent.submittedAt ? (
                <span style={{ color: isDark ? '#34d399' : '#059669', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                  <CheckCircle2 size={14} /> Turned in on {formatFullDate(selectedStudent.submittedAt)}
                </span>
              ) : selectedStudent.finalCode ? (
                <span style={{ color: isDark ? '#34d399' : '#059669', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                  <CheckCircle2 size={14} /> Code Submitted
                </span>
              ) : (
                <span style={{ color: isDark ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> Activity Assigned (No submission yet)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const handler = onOpenPlayback || onStartMonitoring;
              if (handler) handler(assignment, selectedStudent);
            }}
            style={styles.playbackActionBtn}
            className="btn-anim"
            title="Open Proctoring Playback timeline for this student"
          >
            <PlayCircle size={16} /> Proctoring Playback
          </button>

          {selectedStudent.finalCode && (
            <button
              onClick={onOpenFullscreenCode}
              style={styles.fullscreenCodeBtn}
              className="btn-anim"
              title="Expand code in fullscreen modal"
            >
              <Code2 size={16} /> Fullscreen
            </button>
          )}
        </div>
      </div>

      {/* Submitted Code Preview */}
      <div style={styles.codeSnippetSection}>
        <div style={styles.codeSnippetHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Code2 size={16} color="#10b981" />
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
              Submitted Code
            </span>
            {selectedStudent.finalCode && (
              <span style={styles.codeLengthBadge}>
                {selectedStudent.finalCode.split('\n').length} lines
              </span>
            )}
          </div>

          {selectedStudent.finalCode && (
            <button
              onClick={() => onCopyCode(selectedStudent.finalCode)}
              style={styles.copyCodeBtn}
              className="btn-anim"
            >
              {copiedCode ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>

        <div style={styles.codeBlockWrapper}>
          {selectedStudent.finalCode ? (
            <pre style={styles.codePre}>
              <code>{selectedStudent.finalCode}</code>
            </pre>
          ) : (
            <div style={styles.emptyCodeNotice}>
              <AlertCircle size={24} color={isDark ? '#64748b' : '#94a3b8'} style={{ margin: '0 auto 6px auto' }} />
              <span>No code has been submitted or saved yet for this student.</span>
            </div>
          )}
        </div>
      </div>

      {/* GRADING DESK: SCORE & FEEDBACK */}
      <div style={styles.gradingFormCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="#10b981" />
            <span style={{ fontSize: '0.98rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#0f172a' }}>
              Evaluation & Scoring
            </span>
          </div>

          {isGraded && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: isDark ? '#34d399' : '#059669', fontWeight: '600' }}>
                <Check size={13} strokeWidth={2.5} /> Graded {currentGrade?.gradedAt ? formatShortDate(currentGrade.gradedAt) : ''}
              </span>
              <button
                onClick={onClearGrade}
                style={styles.clearGradeBtn}
                title="Clear grade from this student"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Score Input + Presets */}
        <div style={{ marginBottom: '18px' }}>
          <label style={styles.inputLabel}>
            Score (out of {maxPoints} pts):
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                min="0"
                max={maxPoints}
                value={gradeInput}
                onChange={(e) => setGradeInput(e.target.value)}
                style={styles.scoreInput}
              />
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b' }}>
                / {maxPoints}
              </span>
            </div>

            {/* Preset Score Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {scorePresets.map(preset => {
                const isActive = String(gradeInput) === String(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGradeInput(String(preset))}
                    style={styles.scorePresetBtn(isActive)}
                    className="btn-anim"
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Feedback Textarea */}
        <div style={{ marginBottom: '18px' }}>
          <label style={styles.inputLabel}>
            Private Feedback & Notes:
          </label>
          <textarea
            rows={3}
            value={feedbackInput}
            onChange={(e) => setFeedbackInput(e.target.value)}
            placeholder={`Leave constructive feedback or review comments for ${selectedStudent.name}...`}
            style={styles.feedbackTextarea}
          />
        </div>

        {/* Evaluate CTA Row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '14px', paddingTop: '10px', borderTop: isDark ? '1px solid #3d3d3d' : '1px solid #f1f5f9' }}>
          {saveStatus === 'error' && (
            <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '600' }}>
              {saveError || 'Failed to save grade'}
            </span>
          )}

          <button
            onClick={onEvaluate}
            disabled={saveStatus === 'saving'}
            style={styles.evaluateSubmitBtn(saveStatus)}
            className="btn-anim"
          >
            {saveStatus === 'saving' ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>Saving...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <CheckCheck size={16} />
                <span>Grade Saved!</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>{isGraded ? 'Update Grade' : 'Save Grade'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
