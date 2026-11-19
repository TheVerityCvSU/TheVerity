import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Award, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import AttachmentCard from '../AttachmentCard';
import RichInstruction from '../RichInstruction';
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
          <div style={styles.heroIconBox} className="cls-aspect-square">
            <ClipboardList size={26} color="#10b981" strokeWidth={2.2} />
          </div>
          <div>
            {/* Principle 5: Wide positive tracking on ALL-CAPS eyebrow */}
            <div
              style={{
                ...styles.heroPreTitle,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontSize: '0.72rem',
                fontWeight: '700'
              }}
              className="tracking-eyebrow"
            >
              Evaluation & Grading
            </div>

            {/* Principle 7 & 8: Tight leading (1.16) and widow prevention (text-wrap: balance) */}
            <h1
              style={{
                ...styles.heroTitle,
                lineHeight: 1.16,
                textWrap: 'balance',
                letterSpacing: '-0.022em'
              }}
              className="heading-balanced display-heading"
            >
              {assignment?.title || 'Class Activity'}
            </h1>

            <div style={styles.heroMetaRow}>
              {/* Principle 3: Tabular numbers for numerical points */}
              <span style={styles.metaBadgeGray}>
                <Award size={13} />
                <span className="tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {maxPoints} Points
                </span>
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
          {/* Principle 3: Tabular numbers on all counters */}
          <div style={styles.statsPillRow}>
            <div style={styles.statPillItem}>
              <span style={styles.statPillNum} className="tabular-nums">
                {turnedInCount}
              </span>
              <span style={styles.statPillLabel}>Turned In</span>
            </div>
            <div style={styles.statPillDivider} />
            <div style={styles.statPillItem}>
              <span style={styles.statPillNum} className="tabular-nums">
                {gradedCount}
              </span>
              <span style={styles.statPillLabel}>Graded</span>
            </div>
            <div style={styles.statPillDivider} />
            <div style={styles.statPillItem}>
              <span style={styles.statPillNum} className="tabular-nums">
                {enrolledCount}
              </span>
              <span style={styles.statPillLabel}>Assigned</span>
            </div>
          </div>

          {/* Principle 10: 44px Touch Target & Principle 2: Optical Center & Principle 13: Affordance */}
          {(assignment?.details || assignment?.instruction || assignment?.attachments?.length > 0) && (
            <button
              onClick={() => setIsInstructionsOpen(prev => !prev)}
              style={{
                ...styles.toggleInstructionsBtn,
                minHeight: '44px',
                minWidth: '44px',
                padding: '10px 16px',
                cursor: 'pointer'
              }}
              className="btn-anim touch-target-44 clickable-affordance"
              aria-expanded={isInstructionsOpen}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  transform: isInstructionsOpen ? 'translateY(-1px)' : 'translateY(1px)'
                }}
              >
                {isInstructionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
              <span>{isInstructionsOpen ? 'Hide Activity Details' : 'View Activity Details'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Principle 15 (Progressive Disclosure) & Principle 19 (Interruptible Spring Animation) */}
      <AnimatePresence initial={false}>
        {isInstructionsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={styles.instructionsDrawer}>
              <div style={styles.instructionsDivider} />
              <h4
                style={{
                  ...styles.instructionsHeading,
                  textWrap: 'balance',
                  lineHeight: 1.25
                }}
                className="heading-balanced"
              >
                Activity Instructions & Resources
              </h4>

              {/* Principle 9: max-w-[65ch] & Principle 7: leading-relaxed (1.58) & Principle 8: text-wrap: pretty */}
              {assignment?.details || assignment?.instruction ? (
                <div style={{ maxWidth: '65ch', width: '100%' }} className="max-w-prose">
                  <RichInstruction
                    html={assignment.details || assignment.instruction}
                    style={{
                      ...styles.instructionsContent,
                      lineHeight: 1.58,
                      textWrap: 'pretty'
                    }}
                    onClick={handleInstructionClick}
                  />
                </div>
              ) : (
                <p style={{ margin: 0, color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.9rem', textWrap: 'pretty', maxWidth: '65ch' }}>
                  No instructions specified for this activity.
                </p>
              )}

              {Array.isArray(assignment?.attachments) && assignment.attachments.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: '700',
                      color: isDark ? '#94a3b8' : '#64748b',
                      marginBottom: '8px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase'
                    }}
                    className="tracking-eyebrow"
                  >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
