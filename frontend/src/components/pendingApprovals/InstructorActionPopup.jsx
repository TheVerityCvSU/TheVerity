import { motion, AnimatePresence } from 'framer-motion';

export default function InstructorActionPopup({ actionPopup, styles, isDark }) {
  return (
    <AnimatePresence>
      {actionPopup && (
        <motion.div
          key="action-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.popupOverlay}
        >
          <motion.div
            key="action-card"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            style={styles.popupCard}
          >
            <div style={styles.popupIconRing}>
              {actionPopup.type === 'approve' ? (
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="20" fill={isDark ? "rgba(34, 197, 94, 0.15)" : "#dcfce7"} />
                  <path
                    d="M11 20.5L17 27L29 14"
                    stroke={isDark ? "#4ade80" : "#16a34a"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="20" fill={isDark ? "rgba(239, 68, 68, 0.15)" : "#fee2e2"} />
                  <path
                    d="M14 14L26 26M26 14L14 26"
                    stroke={isDark ? "#f87171" : "#dc2626"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div>
              <p style={styles.popupTitle}>{actionPopup.type === 'approve' ? 'Instructor Approved' : 'Instructor Declined'}</p>
              <p style={styles.popupSub}>
                {actionPopup.type === 'approve' ? (
                  <><strong>{actionPopup.name}</strong> has been granted access as an instructor.</>
                ) : (
                  <><strong>{actionPopup.name}</strong>'s request has been rejected.</>
                )}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

