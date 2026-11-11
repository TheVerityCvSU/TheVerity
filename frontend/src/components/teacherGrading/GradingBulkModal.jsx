import React from 'react';
import { X } from 'lucide-react';
import { getGradingModalStyles } from './gradingModalStyles';

export default function GradingBulkModal({
  turnedInStudentsCount,
  maxPoints,
  bulkGrade,
  setBulkGrade,
  bulkFeedback,
  setBulkFeedback,
  onApplyBulk,
  onClose,
  isDark
}) {
  const styles = getGradingModalStyles(isDark);
  const scorePresets = [
    maxPoints,
    Math.round(maxPoints * 0.95),
    Math.round(maxPoints * 0.9),
    Math.round(maxPoints * 0.85),
    Math.round(maxPoints * 0.8)
  ];

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.bulkModalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>Bulk Grade Submissions</h3>
            <p style={{ margin: '4px 0 0 0', color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.84rem' }}>
              Assign grades to all {turnedInStudentsCount} students who have turned in this activity.
            </p>
          </div>
          <button onClick={onClose} style={styles.closeModalBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', color: isDark ? '#e2e8f0' : '#334155', marginBottom: '4px' }}>
              Grade (out of {maxPoints}):
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <input
                type="number"
                min="0"
                max={maxPoints}
                value={bulkGrade}
                onChange={(e) => setBulkGrade(e.target.value)}
                style={{
                  width: '100px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
                  backgroundColor: isDark ? '#262626' : '#ffffff',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: '1rem',
                  fontWeight: '800',
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                {scorePresets.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setBulkGrade(String(p))}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: isDark ? '1px solid #383838' : '1px solid #cbd5e1',
                      backgroundColor: String(bulkGrade) === String(p) ? '#10b981' : (isDark ? '#2a2a2a' : '#ffffff'),
                      color: String(bulkGrade) === String(p) ? '#ffffff' : (isDark ? '#e2e8f0' : '#475569'),
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '700', color: isDark ? '#e2e8f0' : '#334155', marginBottom: '4px' }}>
              Feedback for all submitted students:
            </label>
            <textarea
              rows={3}
              value={bulkFeedback}
              onChange={(e) => setBulkFeedback(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: isDark ? '1px solid #3d3d3d' : '1px solid #cbd5e1',
                backgroundColor: isDark ? '#262626' : '#ffffff',
                color: isDark ? '#f8fafc' : '#0f172a',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                marginTop: '6px'
              }}
              placeholder="e.g. Great work completing this assignment!"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelModalBtn}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApplyBulk}
              style={styles.applyBulkBtn}
              className="btn-anim"
            >
              Apply to All ({turnedInStudentsCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

