import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archive, X } from 'lucide-react';

/**
 * Shared confirmation dialog shown before archiving a classroom, course, or classwork item.
 */
export default function ArchiveConfirmModal({
  isOpen,
  itemName = '',
  title = 'Archive classroom?',
  subtitle = 'Move to Archived Classrooms',
  description,
  confirmLabel = 'Archive classroom',
  isDark = false,
  onCancel,
  onConfirm,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
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

            <div style={{ marginBottom: '16px', paddingRight: '28px', textAlign: 'left' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: '700',
                  color: isDark ? '#F9FAFB' : '#111827',
                  textAlign: 'left'
                }}
              >
                {title}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: isDark ? '#9CA3AF' : '#64748B' }}>
                {subtitle}
              </p>
            </div>

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
              {description || (
                <p style={{ margin: 0 }}>
                  Are you sure you want to archive{' '}
                  <span
                    className="font-semibold"
                    style={{
                      fontWeight: 600,
                      color: isDark ? '#FBBF24' : '#B45309'
                    }}
                  >
                    {itemName || 'this classroom'}
                  </span>
                  ? Past materials and activities remain accessible in read-only mode under Archived Classrooms, while new submissions and To-Do/Calendar entries are disabled until you unarchive it.
                </p>
              )}
            </div>

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
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#B45309';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#D97706';
                }}
              >
                <Archive size={15} />
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
