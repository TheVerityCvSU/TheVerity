import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export default function DeleteClassModal({
  deleteConfirmClass,
  isDark,
  onClose,
  onConfirm,
  styles
}) {
  return (
    <AnimatePresence>
      {deleteConfirmClass && (
        <motion.div
          style={styles.modalOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            style={{ ...styles.modalCard, maxWidth: '420px' }}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0
              }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                  Delete Classroom
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                  Permanent removal confirmation
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '20px', color: isDark ? '#cbd5e1' : '#334155', fontSize: '0.9rem', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 10px 0' }}>
                Are you sure you want to permanently delete this classroom and all of its associated data? This action cannot be undone.
              </p>
              <div style={{
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: isDark ? '#262626' : '#f1f5f9',
                border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0',
                fontWeight: '700',
                color: isDark ? '#f87171' : '#dc2626'
              }}>
                {deleteConfirmClass.name}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onClose}
                style={{
                  ...styles.submitBlueBtn,
                  backgroundColor: isDark ? '#374151' : '#e2e8f0',
                  color: isDark ? '#cbd5e1' : '#475569',
                  flex: 1,
                  boxShadow: 'none'
                }}
                className="btn-anim"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onConfirm}
                style={{
                  ...styles.submitBlueBtn,
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  flex: 1,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)'
                }}
                className="btn-anim"
              >
                Delete Classroom
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
