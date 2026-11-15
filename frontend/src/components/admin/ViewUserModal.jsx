import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, X, Mail, Check, Copy, Clock, Shield, Edit3 } from 'lucide-react';

export default function ViewUserModal({
  viewingUser,
  getUserStatus = (u) => u?.status || 'Active',
  fmt = (v) => (v ? new Date(v).toLocaleDateString() : 'Never'),
  copiedEmail = false,
  onCopyEmail = () => {},
  onOpenEdit = () => {},
  onToggleStatus = () => {},
  onClose = () => {},
  isDark = false,
  styles = {}
}) {
  return (
    <AnimatePresence>
      {viewingUser && (
        <motion.div style={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            style={{ ...styles.modalCard, maxWidth: '440px' }}
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={20} color={isDark ? '#60a5fa' : '#2563eb'} />
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>User Profile</h2>
              </div>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onClose} style={styles.closeBtn}>
                <X size={20} />
              </motion.button>
            </div>

            {/* User Identity Banner */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '12px 0 20px',
              borderBottom: isDark ? '1px solid #333333' : '1px solid #f1f5f9',
              marginBottom: '18px'
            }}>
              <div style={{
                position: 'relative',
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: isDark ? '#3b82f6' : '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '1.8rem',
                fontWeight: '700',
                boxShadow: '0 6px 18px rgba(37,99,235,0.3)',
                marginBottom: '12px'
              }}>
                {(viewingUser.name || 'U').charAt(0).toUpperCase()}
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a' }}>
                {viewingUser.name}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={styles.rolePill}>{viewingUser.role}</span>
                <span style={getUserStatus(viewingUser) === 'Active' ? styles.statusGreenPill : styles.statusRedPill}>
                  {getUserStatus(viewingUser)}
                </span>
              </div>
            </div>

            {/* Detail Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: isDark ? '#262626' : '#f8fafc',
                border: isDark ? '1px solid #383838' : '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <Mail size={16} color={isDark ? '#94a3b8' : '#64748b'} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.86rem', color: isDark ? '#e2e8f0' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {viewingUser.email}
                  </span>
                </div>
                <button
                  onClick={() => onCopyEmail(viewingUser.email)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copiedEmail ? '#22c55e' : (isDark ? '#94a3b8' : '#64748b'),
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}
                  title="Copy Email"
                >
                  {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: isDark ? '#262626' : '#f8fafc',
                border: isDark ? '1px solid #383838' : '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={16} color={isDark ? '#94a3b8' : '#64748b'} />
                  <span style={{ fontSize: '0.84rem', color: isDark ? '#94a3b8' : '#64748b' }}>Last Login:</span>
                </div>
                <span style={{ fontSize: '0.84rem', fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b' }}>
                  {fmt(viewingUser.lastLogin)}
                </span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: isDark ? '#262626' : '#f8fafc',
                border: isDark ? '1px solid #383838' : '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Shield size={16} color={isDark ? '#94a3b8' : '#64748b'} />
                  <span style={{ fontSize: '0.84rem', color: isDark ? '#94a3b8' : '#64748b' }}>Status:</span>
                </div>
                <span style={{
                  fontSize: '0.84rem',
                  fontWeight: '700',
                  color: getUserStatus(viewingUser) === 'Active' ? '#22c55e' : '#ef4444'
                }}>
                  {getUserStatus(viewingUser)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const u = viewingUser;
                  onClose();
                  onOpenEdit(u);
                }}
                style={{ ...styles.submitBlueBtn, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Edit3 size={15} />
                <span>Edit Account</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onToggleStatus}
                style={{
                  ...styles.submitBlueBtn,
                  flex: 1,
                  backgroundColor: (viewingUser.status || 'Active').toLowerCase() === 'active' ? (isDark ? '#3f2525' : '#fee2e2') : (isDark ? '#1b3b2b' : '#dcfce7'),
                  color: (viewingUser.status || 'Active').toLowerCase() === 'active' ? '#ef4444' : '#15803d',
                  boxShadow: 'none',
                  border: (viewingUser.status || 'Active').toLowerCase() === 'active' ? '1px solid #f87171' : '1px solid #86efac'
                }}
              >
                {(viewingUser.status || 'Active').toLowerCase() === 'active' ? 'Deactivate' : 'Activate'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

