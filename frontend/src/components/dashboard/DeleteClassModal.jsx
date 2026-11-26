import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

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
          className="fixed inset-0 flex items-center justify-center p-5 z-[99999]"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: isDark ? 'rgba(17, 17, 17, 0.75)' : 'rgba(235, 235, 235, 0.75)',
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
            className="w-full max-w-[440px] text-left rounded-3xl p-7 shadow-2xl relative"
            style={{
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              border: isDark ? '1px solid #2C2C2E' : '1px solid #E5E7EB',
              borderRadius: '24px',
              padding: '28px',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'left',
              boxShadow: isDark
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                : '0 20px 40px -10px rgba(0, 0, 0, 0.12)',
              position: 'relative'
            }}
          >
            {/* Top-Right Close Button */}
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close dialog"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: isDark ? '#9CA3AF' : '#64748B',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease, color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#2C2C2E' : '#F1F5F9';
                e.currentTarget.style.color = isDark ? '#F3F4F6' : '#0F172A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = isDark ? '#9CA3AF' : '#64748B';
              }}
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', paddingRight: '28px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDark ? '#F87171' : '#DC2626',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.2rem',
                    fontWeight: '700',
                    color: isDark ? '#F9FAFB' : '#111827',
                    textAlign: 'left'
                  }}
                >
                  Delete classroom?
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: isDark ? '#9CA3AF' : '#64748B' }}>
                  Permanent removal confirmation
                </p>
              </div>
            </div>

            {/* Warning description with dynamic entity name in font-semibold */}
            <div
              className="text-left"
              style={{
                marginBottom: '24px',
                color: isDark ? '#D1D5DB' : '#374151',
                fontSize: '0.9rem',
                lineHeight: '1.55',
                textAlign: 'left'
              }}
            >
              <p style={{ margin: 0 }}>
                Are you sure you want to permanently delete{' '}
                <span
                  className="font-semibold"
                  style={{
                    fontWeight: 600,
                    color: isDark ? '#F87171' : '#DC2626'
                  }}
                >
                  {confirmData.name}
                </span>
                ? All materials, classwork, and student records inside it will be removed. This action cannot be undone.
              </p>
            </div>

            {/* Right-aligned footer buttons: justify-end gap-3 */}
            <div
              className="flex justify-end gap-3"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}
            >
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: isDark ? '1px solid #3A3A3C' : '1px solid #D1D5DB',
                  backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
                  color: isDark ? '#D1D5DB' : '#374151',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#3A3A3C' : '#F3F4F6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#2C2C2E' : '#FFFFFF';
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#B91C1C';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                }}
              >
                Delete classroom
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
