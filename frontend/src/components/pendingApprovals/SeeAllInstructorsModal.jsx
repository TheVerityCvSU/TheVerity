import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SeeAllInstructorsModal({
  isOpen,
  onClose,
  pendingInstructors,
  renderInstructor,
  styles,
  isDark
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.modalOverlay}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={styles.modalContent}
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>All Pending Instructors ({pendingInstructors.length})</h2>
              <button
                onClick={onClose}
                style={styles.closeBtn}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#3a3a3a' : '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                &times;
              </button>
            </div>
            
            <div style={styles.modalListContainer}>
              {pendingInstructors.map(renderInstructor)}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

