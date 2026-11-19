import React from 'react';
import { X, Clock, Award } from 'lucide-react';
import RichInstruction from '../RichInstruction';

export default function ActivityDetailModal({ activity, onClose, isDark, styles }) {
  if (!activity) return null;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={styles.modalTypeBadge(activity.theme)}>
              {activity.type || activity.activityType || 'Activity'}
            </span>
            {activity.className && (
              <span style={styles.modalClassBadge}>{activity.className}</span>
            )}
          </div>
          <button onClick={onClose} style={styles.modalCloseBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <h3 style={styles.modalTitle}>{activity.title}</h3>

          <div style={styles.modalMetaBox}>
            <Clock size={18} color="#10b981" />
            <div>
              <div style={{ fontSize: '0.74rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                Scheduled Due Date & Deadline
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#0f172a' }}>
                {activity.parsedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                • {activity.deadlineTime}
              </div>
            </div>
          </div>

          {activity.points && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Award size={16} color="#10b981" />
              <span style={{ fontSize: '0.86rem', color: isDark ? '#cbd5e1' : '#334155' }}>
                Points: <strong>{activity.points} pts</strong>
              </span>
            </div>
          )}

          {activity.details ? (
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  color: isDark ? '#94a3b8' : '#64748b',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}
              >
                Instructions
              </div>
              <RichInstruction
                style={styles.modalInstructionsBody}
                html={activity.details}
              />
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button onClick={onClose} style={styles.modalDismissBtn} className="btn-anim">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

