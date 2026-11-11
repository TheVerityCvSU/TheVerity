import React from 'react';
import { motion } from 'framer-motion';

export default function InstructorPillRow({ instructor, onApprove, onReject, styles }) {
  const email = instructor.emailAddress || instructor.email || '';
  const name = instructor.name || instructor.fullName || (email ? email.split('@')[0] : 'Instructor');
  const initial = name.charAt(0).toUpperCase() || '?';

  return (
    <div style={styles.pillRow}>
      <div style={styles.leftInfo}>
        <div style={styles.avatar}>
          {initial}
        </div>
        <div style={styles.textColumn}>
          <span style={styles.displayName}>{name}</span>
          <span style={styles.displayEmail}>{email}</span>
        </div>
      </div>

      <div style={styles.actionsGroup}>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onApprove(email)}
          style={styles.acceptButton}
        >
          Accept
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onReject(email)}
          style={styles.declineButton}
        >
          Decline
        </motion.button>
      </div>
    </div>
  );
}

