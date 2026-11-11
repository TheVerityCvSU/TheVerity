import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export default function DeleteClassModal({
  confirmData,
  onCancel,
  onConfirm,
  isDark
}) {
  return (
    <AnimatePresence>
      {confirmData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(5px)',
            padding: '20px'
          }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: isDark ? '#1e1e24' : '#ffffff',
              border: isDark ? '1px solid #333' : '1px solid #e5e7eb',
              borderRadius: '24px',
              padding: '28px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 20px 50px rgba(0,0,0,0.15)'
            }}
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

            <div style={{ marginBottom: '22px', color: isDark ? '#cbd5e1' : '#334155', fontSize: '0.9rem', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 10px 0' }}>
                Are you sure you want to permanently delete this classroom? All materials, classwork, and student records inside it will be removed.
              </p>
              <div style={{
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: isDark ? '#26262b' : '#f8fafc',
                border: isDark ? '1px solid #3f3f46' : '1px solid #e2e8f0',
                fontWeight: '700',
                color: isDark ? '#f87171' : '#dc2626'
              }}>
                {confirmData.name}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: isDark ? '#2d2d38' : '#e2e8f0',
                  color: isDark ? '#cbd5e1' : '#475569',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                className="btn-anim"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
                  transition: 'all 0.2s ease'
                }}
                className="btn-anim"
              >
                Delete Classroom
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

