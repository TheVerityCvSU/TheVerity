import React from 'react';
import { motion } from 'framer-motion';
import PendingInstructorApproval from '../PendingInstructorApproval';

export default function SecurityControlPanel({
  users = [],
  onUpdateUser,
  onBulkActionClick,
  styles
}) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <PendingInstructorApproval users={users} onUpdateUser={onUpdateUser} />

      <div style={styles.sidePanelCard}>
        <h3 style={styles.sidePanelTitle}>Security Permission Control</h3>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onBulkActionClick('reset')}
          style={styles.secPillBtn}
          className="btn-anim"
        >
          Force Reset Password for Selected
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onBulkActionClick('suspend')}
          style={styles.secPillBtn}
          className="btn-anim"
        >
          Suspend Selected Account
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onBulkActionClick('delete')}
          style={{ ...styles.secPillBtn, borderColor: '#fca5a5', color: '#b91c1c', marginBottom: 0 }}
          className="btn-anim"
        >
          Deactivate / Delete Account
        </motion.button>
      </div>
    </div>
  );
}

