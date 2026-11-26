import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, AlertCircle } from 'lucide-react';
import PasswordRequirements from '../PasswordRequirements';

export default function AddUserModal({
  isOpen,
  isAddOpen,
  addOrigin = { x: '50%', y: '50%' },
  newUser = {},
  setNewUser = () => {},
  showAddPassword = false,
  setShowAddPassword = () => {},
  addError = null,
  addLoading = false,
  policies = null,
  onClose = () => {},
  onSubmit = () => {},
  isDark = false,
  styles = {}
}) {
  const visible = isOpen !== undefined ? isOpen : isAddOpen;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div style={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          <motion.div
            style={{ ...styles.modalCard, transformOrigin: `${addOrigin.x} ${addOrigin.y}` }}
            initial={{ opacity: 0, scale: 0.55, y: 32, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.6, y: 24, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.9, filter: { duration: 0.2 } }}
          >
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, color: isDark ? '#f1f5f9' : '#1e293b' }}>Add New User</h2>
              <motion.button type="button" disabled={addLoading} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onClose} style={styles.closeBtn}>
                <X size={20} />
              </motion.button>
            </div>
            {addError && (
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
                <span>{addError}</span>
              </div>
            )}
            <form onSubmit={onSubmit} style={styles.form}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="First Name"
                  required
                  value={newUser.firstName}
                  onChange={e => setNewUser({ ...newUser, firstName: e.target.value })}
                  style={{ ...styles.inputPill, flex: 1 }}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  required
                  value={newUser.lastName}
                  onChange={e => setNewUser({ ...newUser, lastName: e.target.value })}
                  style={{ ...styles.inputPill, flex: 1 }}
                />
              </div>
              <input
                type="email"
                placeholder="Email"
                required
                value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                style={styles.inputPill}
              />
              <div style={{ position: 'relative' }}>
                <input
                  type={showAddPassword ? 'text' : 'password'}
                  placeholder="Password"
                  required
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  style={{ ...styles.inputPill, paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowAddPassword(!showAddPassword)}
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
                  title={showAddPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showAddPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <PasswordRequirements password={newUser.password} policies={policies} />
              <select
                value={newUser.role}
                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                style={styles.inputPill}
              >
                <option>Student</option>
                <option>Teacher</option>
                <option>Admin</option>
              </select>
              <motion.button
                whileHover={addLoading ? {} : { scale: 1.05 }}
                whileTap={addLoading ? {} : { scale: 0.95 }}
                type="submit"
                disabled={addLoading}
                style={{ ...styles.submitBlueBtn, opacity: addLoading ? 0.7 : 1, cursor: addLoading ? 'not-allowed' : 'pointer' }}
              >
                {addLoading ? 'Adding User...' : 'Add User'}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

