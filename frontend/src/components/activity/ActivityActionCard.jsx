import React from 'react';
import { BookOpen, ArrowLeft, ArrowRight, CheckCircle2, TerminalSquare, Code2 } from 'lucide-react';
import { formatFullDate } from '../../utils/dateUtils';

export default function ActivityActionCard({
  isMaterial,
  isSubmitted,
  submission,
  gradeData,
  assignment,
  styles,
  isDark,
  onBackToClassroom,
  onSubmit,
  onStartCoding,
  onUnsubmit,
  onShowCodePreview
}) {
  const displayScore = gradeData?.grade != null ? gradeData.grade : null;
  const feedbackText = gradeData?.feedback || (gradeData?.grade != null ? "No written feedback provided." : "No feedback yet. Your submission is pending instructor review.");

  if (isMaterial) {
    return (
      <div style={{
        marginTop: '32px',
        padding: '20px 24px',
        borderRadius: '12px',
        backgroundColor: isDark ? '#1f2425' : '#ecfdf5',
        border: `1px solid ${isDark ? '#2d3739' : '#a7f3d0'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <BookOpen size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: isDark ? '#f3f4f6' : '#065f46' }}>
              Reference Learning Material
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: isDark ? '#9ca3af' : '#047857' }}>
              This material is provided for study and review. No code or assignment submission is required.
            </p>
          </div>
        </div>

        <button
          onClick={onBackToClassroom}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            borderRadius: '50px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(16, 185, 129, 0.25)',
            transition: 'all 0.2s ease'
          }}
        >
          <ArrowLeft size={16} /> Back to Materials
        </button>
      </div>
    );
  }

  if (!isSubmitted) {
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
            onClick={onShowCodePreview}
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
      {!(assignment?.disableBack || assignment?.disable_back) && (
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
