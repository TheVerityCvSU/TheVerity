import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, X, AlertCircle, Eye, EyeOff } from 'lucide-react';
import PasswordRequirements from '../PasswordRequirements';

export default function EditUserModal({
  editingUser,
  setEditingUser,
  editLoading,
  editError,
  showEditPassword,
  setShowEditPassword,
  policies,
  onClose,
  onSave,
  isDark,
  styles
}) {
  return (
    <AnimatePresence>
      {editingUser && (
        <motion.div style={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            style={{ ...styles.modalCard, maxWidth: '460px' }}
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} color={isDark ? '#60a5fa' : '#2563eb'} />
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>Edit User</h2>
              </div>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onClose} style={styles.closeBtn}>
                <X size={20} />
              </motion.button>
            </div>

            {editError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: isDark ? '#3f1d1d' : '#fee2e2',
                color: isDark ? '#fca5a5' : '#b91c1c',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px'
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={onSave} style={styles.form}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: '600', color: isDark ? '#cbd5e1' : '#475569' }}>
                  Full Name
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="First Name"
                    required
                    value={editingUser.firstName}
                    onChange={e => setEditingUser({ ...editingUser, firstName: e.target.value })}
                    style={{ ...styles.inputPill, flex: 1 }}
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={editingUser.lastName}
                    onChange={e => setEditingUser({ ...editingUser, lastName: e.target.value })}
                    style={{ ...styles.inputPill, flex: 1 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: '600', color: isDark ? '#cbd5e1' : '#475569' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={editingUser.email}
                  onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                  style={styles.inputPill}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: '600', color: isDark ? '#cbd5e1' : '#475569' }}>
                    Role
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                    style={styles.inputPill}
                  >
                    <option>Student</option>
                    <option>Teacher</option>
                    <option>Admin</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: '600', color: isDark ? '#cbd5e1' : '#475569' }}>
                    Status
                  </label>
                  <select
                    value={editingUser.status}
                    onChange={e => setEditingUser({ ...editingUser, status: e.target.value })}
                    style={styles.inputPill}
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: '600', color: isDark ? '#cbd5e1' : '#475569' }}>
                  New Password <span style={{ fontWeight: '400', fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b' }}>(Leave blank to keep current password)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={editingUser.password}
                    onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                    style={{ ...styles.inputPill, paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: 0,
                      bottom: 0,
                      margin: 'auto 0',
                      height: '24px',
                      width: '24px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: isDark ? '#9ca3af' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: 'none',
                      transition: 'color 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = isDark ? '#e4e4e7' : '#1f2937'}
                    onMouseLeave={e => e.currentTarget.style.color = isDark ? '#9ca3af' : '#64748b'}
                    title={showEditPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <PasswordRequirements password={editingUser.password} policies={policies} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  style={{ ...styles.submitBlueBtn, backgroundColor: isDark ? '#374151' : '#e2e8f0', color: isDark ? '#cbd5e1' : '#475569', flex: 1, boxShadow: 'none' }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={editLoading}
                  style={{ ...styles.submitBlueBtn, flex: 1, opacity: editLoading ? 0.7 : 1 }}
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

