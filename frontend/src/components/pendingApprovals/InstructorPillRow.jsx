import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function InstructorPillRow({
  instructor,
  onApprove,
  onReject,
  onSelect,
  styles,
  isDark = false
}) {
  const [isHovered, setIsHovered] = useState(false);

  const email = instructor.emailAddress || instructor.email || '';
  const name = instructor.name || instructor.fullName || (email ? email.split('@')[0] : 'Instructor');
  const initial = name.charAt(0).toUpperCase() || '?';

  const handleSelect = () => {
    if (onSelect) {
      onSelect(instructor);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect();
    }
  };

  const rowStyle = {
    ...styles.pillRow,
    ...(onSelect ? styles.pillRowClickable : {}),
    ...(onSelect && isHovered
      ? {
          backgroundColor: isDark ? '#262626' : '#f8fafc',
          border: isDark ? '1px solid #4b5563' : '1px solid #cbd5e1',
          transform: 'translateY(-1px)'
        }
      : {})
  };

  return (
    <div
      style={rowStyle}
      onClick={handleSelect}
      onKeyDown={onSelect ? handleKeyDown : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? `View account details for ${name}` : undefined}
      title={onSelect ? 'Click to view full name and email' : undefined}
    >
      <div style={styles.leftInfo}>
        <div style={styles.avatar}>
          {initial}
        </div>
        <div style={styles.textColumn}>
          <span style={styles.displayName}>{name}</span>
          <span style={styles.displayEmail}>{email}</span>
        </div>
      </div>

      <div
        style={styles.actionsGroup}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={(e) => {
            e.stopPropagation();
            onApprove(email);
          }}
          style={styles.acceptButton}
        >
          Accept
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={(e) => {
            e.stopPropagation();
            onReject(email);
          }}
          style={styles.declineButton}
        >
          Decline
        </motion.button>
      </div>
    </div>
  );
}

