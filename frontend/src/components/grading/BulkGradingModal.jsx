import React from 'react';
import { X } from 'lucide-react';

export default function BulkGradingModal({
  isOpen,
  onClose,
  turnedInCount,
  maxPoints,
  bulkGrade,
  setBulkGrade,
  bulkFeedback,
  setBulkFeedback,
  scorePresets,
  onApplyBulk,
  isDark,
  styles
}) {
  if (!isOpen) return null;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.bulkModalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>Bulk Grade Submissions</h3>
            <p style={{ margin: '4px 0 0 0', color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.84rem' }}>
              Assign grades to all {turnedInCount} students who have turned in this activity.
            </p>
          </div>
          <button onClick={onClose} style={styles.closeModalBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={styles.inputLabel}>Grade (out of {maxPoints}):</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <input
                type="number"
                min="0"
                max={maxPoints}
                value={bulkGrade}
                onChange={(e) => setBulkGrade(e.target.value)}
                style={{ ...styles.scoreInput, width: '100px' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                {scorePresets.slice(0, 5).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setBulkGrade(String(p))}
                    style={styles.scorePresetBtn(String(bulkGrade) === String(p))}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={styles.inputLabel}>Feedback for all submitted students:</label>
            <textarea
              rows={3}
              value={bulkFeedback}
              onChange={(e) => setBulkFeedback(e.target.value)}
              style={{ ...styles.feedbackTextarea, marginTop: '6px' }}
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
              Apply to All ({turnedInCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
