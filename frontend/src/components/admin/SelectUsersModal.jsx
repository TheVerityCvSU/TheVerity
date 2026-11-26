import { motion } from 'framer-motion';

export default function SelectUsersModal({ isOpen, isDark, onClose }) {
  if (!isOpen) return null;

  return (
    <motion.div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '280px',
        zIndex: 1000
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <motion.div
        style={{
          backgroundColor: isDark ? '#1e1e1e' : 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.4)' : '0 10px 25px rgba(0,0,0,0.15)',
          border: isDark ? '1px solid #3a3a3a' : '1px solid #e2e8f0'
        }}
      >
        <h2 style={{ margin: '0 0 16px', color: isDark ? '#f1f5f9' : '#1e293b', fontSize: '1.25rem' }}>
          Action Required
        </h2>
        <div style={{ color: isDark ? '#cbd5e1' : '#334155', fontSize: '1rem', marginBottom: '24px' }}>
          Please select at least one user to perform this action.
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '9999px',
            padding: '10px 24px',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            width: '100%',
            boxShadow: '0 4px 12px rgba(0, 123, 255, 0.3)'
          }}
        >
          OK
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

