import { ArrowRight, CheckCircle2, TerminalSquare, Code2, Lock } from 'lucide-react';
import { formatFullDate } from '../../utils/dateUtils';

export default function ActivitySubmissionSection({
  isDark,
  isArchived = false,
  styles,
  isMaterial,
  isSubmitted,
  isCheckingSubmission = false,
  assignment,
  submission,
  gradeData,
  onUnsubmit,
  onStartCoding,
  onViewCode
}) {
  const displayScore = gradeData?.grade != null ? gradeData.grade : null;
  const feedbackText = gradeData?.feedback || (gradeData?.grade != null 
    ? "No written feedback provided." 
    : "No feedback yet. Your submission is pending instructor review.");

  if (isMaterial) {
    return null;
  }

  if (!isSubmitted) {
    if (isCheckingSubmission) {
      return null;
    }
    if (isArchived) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '12px',
            backgroundColor: isDark ? 'rgba(148, 163, 184, 0.14)' : '#e2e8f0',
            border: isDark ? '1px solid rgba(148, 163, 184, 0.35)' : '1px solid #cbd5e1',
            color: isDark ? '#cbd5e1' : '#475569',
            fontSize: '0.88rem',
            fontWeight: '700'
          }}>
            <Lock size={15} /> Classroom Archived — Submissions Closed
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '32px' }}>
        <button
          onClick={onStartCoding}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '9px 28px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(16,185,129,0.2)',
            transition: 'all 0.2s ease'
          }}
        >
          Start <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '32px' }}>
      {/* Submitted state */}
      <div style={{ ...styles.submissionBox, backgroundColor: isDark ? '#1a201e' : '#ecfdf5', border: isDark ? '1px solid #232a29' : '1px solid #d1fae5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CheckCircle2 size={22} color="#10b981" />
          <div>
            <span style={{ fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b', fontSize: '0.95rem' }}>
              Code Submitted
            </span>
            <span style={{ fontSize: '0.8rem', color: isDark ? '#9AA0A6' : '#64748b', marginLeft: '10px' }}>
              {submission?.submittedAt ? `Turned in on ${formatFullDate(submission.submittedAt)}` : 'Turned in'}
            </span>
            {displayScore !== null && (
              <span style={{ fontSize: '0.8rem', color: '#10b981', marginLeft: '10px', fontWeight: 'bold' }}>
                Score: {displayScore} / {assignment?.points || 100} pts
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onStartCoding}
            style={{
              ...styles.viewCodeBtn,
              backgroundColor: isDark ? '#262626' : '#f1f5f9',
              color: isDark ? '#E8EAED' : '#334155',
              border: isDark ? '1px solid #404040' : '1px solid #cbd5e1'
            }}
            title="Open workspace in read-only mode"
          >
            <TerminalSquare size={15} style={{ marginRight: '5px' }} /> View Workspace
          </button>
          <button
            onClick={onViewCode}
            style={styles.viewCodeBtn}
          >
            <Code2 size={15} style={{ marginRight: '5px' }} /> View Code
          </button>
        </div>
      </div>

      {/* Instructor Feedback if available */}
      {(gradeData?.grade != null || gradeData?.feedback) && (
        <div style={{ marginTop: '16px' }}>
          <div style={styles.feedbackHeading}>Instructor Feedback</div>
          <div style={{ ...styles.feedbackBox, backgroundColor: isDark ? '#1a201e' : '#f8fafc', border: isDark ? '1px solid #232a29' : '1px solid #e2e8f0' }}>
            <p style={{ margin: 0, color: isDark ? '#E8EAED' : '#334155', fontSize: '0.95rem', lineHeight: '1.5' }}>
              {feedbackText}
            </p>
          </div>
        </div>
      )}
      
      {/* Unsubmit Option */}
      {isArchived ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '9999px',
            backgroundColor: isDark ? 'rgba(148, 163, 184, 0.12)' : '#f1f5f9',
            border: isDark ? '1px solid rgba(148, 163, 184, 0.28)' : '1px solid #cbd5e1',
            color: isDark ? '#94a3b8' : '#64748b',
            fontSize: '0.8rem',
            fontWeight: '600'
          }}>
            <Lock size={13} /> Classroom Archived — Read-Only
          </span>
        </div>
      ) : !(assignment?.disableBack || assignment?.disable_back) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
          <button
            onClick={onUnsubmit}
            style={{
              backgroundColor: 'transparent',
              color: isDark ? '#f87171' : '#dc2626',
              border: isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fca5a5',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Unsubmit
          </button>
        </div>
      )}
    </div>
  );
}

