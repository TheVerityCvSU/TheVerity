import React from 'react';
import { ClipboardList, Award, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import AttachmentCard from '../AttachmentCard';
import { formatShortDate } from '../../utils/dateUtils';

export default function ActivityHeroBanner({
  assignment,
  maxPoints,
  turnedInCount,
  gradedCount,
  enrolledCount,
  isInstructionsOpen,
  setIsInstructionsOpen,
  handleInstructionClick,
  setPreviewImage,
  setPreviewVideo,
  setPreviewIframe,
  isDark,
  styles
}) {
  return (
    <div style={styles.heroCard}>
      <div style={styles.heroTopRow}>
        <div style={styles.heroLeft}>
          <div style={styles.heroIconBox}>
            <ClipboardList size={26} color="#10b981" strokeWidth={2.2} />
          </div>
          <div>
            <div style={styles.heroPreTitle}>Evaluation & Grading</div>
            <h1 style={styles.heroTitle}>
              {assignment?.title || 'Class Activity'}
            </h1>

            <div style={styles.heroMetaRow}>
              <span style={styles.metaBadgeGray}>
                <Award size={13} /> {maxPoints} Points
              </span>
              <span style={styles.metaBadgeGray}>
                <Clock size={13} />
                {assignment?.noDueDate ? 'No Due Date' : (assignment?.dueDate ? `Due ${formatShortDate(assignment.dueDate)}` : 'No Due Date')}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Stats & Toggle Instructions */}
        <div style={styles.heroRight}>
          <div style={styles.statsPillRow}>
            <div style={styles.statPillItem}>
              <span style={styles.statPillNum}>{turnedInCount}</span>
              <span style={styles.statPillLabel}>Turned In</span>
            </div>
            <div style={styles.statPillDivider} />
            <div style={styles.statPillItem}>
              <span style={styles.statPillNum}>{gradedCount}</span>
              <span style={styles.statPillLabel}>Graded</span>
            </div>
            <div style={styles.statPillDivider} />
            <div style={styles.statPillItem}>
              <span style={styles.statPillNum}>{enrolledCount}</span>
              <span style={styles.statPillLabel}>Assigned</span>
            </div>
          </div>

          {(assignment?.details || assignment?.instruction || assignment?.attachments?.length > 0) && (
            <button
              onClick={() => setIsInstructionsOpen(prev => !prev)}
              style={styles.toggleInstructionsBtn}
              className="btn-anim"
            >
              {isInstructionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span>{isInstructionsOpen ? 'Hide Activity Details' : 'View Activity Details'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Activity Details Drawer */}
      {isInstructionsOpen && (
        <div style={styles.instructionsDrawer}>
          <div style={styles.instructionsDivider} />
          <h4 style={styles.instructionsHeading}>Activity Instructions & Resources</h4>

          {assignment?.details || assignment?.instruction ? (
            <div
              style={styles.instructionsContent}
              dangerouslySetInnerHTML={{
                __html: assignment.details || assignment.instruction
              }}
              onClick={handleInstructionClick}
            />
          ) : (
            <p style={{ margin: 0, color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.9rem' }}>
              No instructions specified for this activity.
            </p>
          )}

          {Array.isArray(assignment?.attachments) && assignment.attachments.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
                Attachments & Materials ({assignment.attachments.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {assignment.attachments.map((att, i) => (
                  <AttachmentCard
                    key={i}
                    att={att}
                    isDark={isDark}
                    onClick={(clickedAtt) => {
                      if (clickedAtt.type === 'image') setPreviewImage(clickedAtt);
                      else if (clickedAtt.type === 'video') setPreviewVideo(clickedAtt);
                      else if (clickedAtt.url) setPreviewIframe(clickedAtt);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
