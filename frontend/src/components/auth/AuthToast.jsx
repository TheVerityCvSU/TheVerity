import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export default function AuthToast({ message, isDark, onClose }) {
  return (
    <AnimatePresence>
      {message && (
        <div
          style={{
            position: 'fixed',
            top: '28px',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 99999,
            padding: '0 16px'
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 20px',
              borderRadius: '14px',
              backgroundColor: message.type === 'error'
                ? (isDark ? '#3b1212' : '#fef2f2')
                : message.type === 'success'
                ? (isDark ? '#0f291e' : '#ecfdf5')
                : (isDark ? '#1a2233' : '#eff6ff'),
              border: `1px solid ${
                message.type === 'error'
                  ? (isDark ? '#7f1d1d' : '#fca5a5')
                  : message.type === 'success'
                  ? (isDark ? '#065f46' : '#6ee7b7')
                  : (isDark ? '#1e3a8a' : '#93c5fd')
              }`,
              color: message.type === 'error'
                ? (isDark ? '#fca5a5' : '#b91c1c')
                : message.type === 'success'
                ? (isDark ? '#6ee7b7' : '#047857')
                : (isDark ? '#93c5fd' : '#1d4ed8'),
              boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              maxWidth: '480px',
              width: 'auto',
              fontSize: '0.92rem',
              fontWeight: '500',
              textAlign: 'left'
            }}
          >
            {message.type === 'error' && <AlertCircle size={18} style={{ flexShrink: 0 }} />}
            {message.type === 'success' && <CheckCircle2 size={18} style={{ flexShrink: 0 }} />}
            {message.type === 'info' && <Info size={18} style={{ flexShrink: 0 }} />}

            <span style={{ lineHeight: 1.4, flex: 1 }}>{message.text}</span>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'currentColor',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.75,
                marginLeft: '6px',
                flexShrink: 0
              }}
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

