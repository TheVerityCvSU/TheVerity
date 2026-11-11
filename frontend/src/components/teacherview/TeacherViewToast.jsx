import { motion, AnimatePresence } from 'framer-motion';

export default function TeacherViewToast({ toast, isDark }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          style={
            toast.isAlert
              ? {
                  position: 'fixed',
                  bottom: '24px',
                  right: '24px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  boxShadow: 'none',
                  color: isDark ? '#f87171' : '#dc2626',
                  fontWeight: '700',
                  fontSize: '0.88rem',
                  zIndex: 99999,
                  pointerEvents: 'none'
                }
              : {
                  position: 'fixed',
                  bottom: '24px',
                  right: '24px',
                  backgroundColor:
                    toast.type === 'error'
                      ? isDark
                        ? '#450a0a'
                        : '#fee2e2'
                      : toast.type === 'warning'
                      ? isDark
                        ? '#451a03'
                        : '#fef3c7'
                      : isDark
                      ? '#052e16'
                      : '#dcfce7',
                  border: `1px solid ${
                    toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f59e0b' : '#22c55e'
                  }`,
                  color:
                    toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#b45309' : '#15803d',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.22)',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  zIndex: 99999
                }
          }
        >
          {toast.message ? toast.message.charAt(0).toUpperCase() + toast.message.slice(1) : ''}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
