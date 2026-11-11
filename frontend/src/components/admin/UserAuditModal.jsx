import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, CheckCircle } from 'lucide-react';

export default function UserAuditModal({
  viewUser,
  viewOrigin,
  isDark,
  onClose,
  flagHistory,
  flagHistoryLoading,
  classroomsMap,
  styles,
  fmt
}) {
  return (
    <AnimatePresence>
      {viewUser && (
        <motion.div
          style={{ ...styles.modalOverlay, transformOrigin: `${viewOrigin.x} ${viewOrigin.y}` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.div
            style={{ ...styles.modalCard, maxWidth: '480px', transformOrigin: `${viewOrigin.x} ${viewOrigin.y}` }}
            initial={{ opacity: 0, scale: 0.55, y: 32, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.6, y: 24, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.9, filter: { duration: 0.2 } }}
          >
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, color: isDark ? '#f1f5f9' : '#1e293b' }}>User Details</h2>
              <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: isDark ? '#374151' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={32} color={isDark ? '#94a3b8' : '#475569'} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: isDark ? '#f1f5f9' : '#0f172a' }}>{viewUser.name}</h3>
                <p style={{ margin: '4px 0 0', color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.85rem' }}>{viewUser.email}</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span style={viewUser.status === 'Active' ? styles.statusGreenPill : styles.statusRedPill}>
                  {viewUser.status === 'Active' ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: isDark ? '#2a2a2a' : '#f8fafc', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', border: isDark ? '1px solid #3a3a3a' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${isDark ? '#3a3a3a' : '#e2e8f0'}`, paddingBottom: '8px' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>Role</span>
                <span style={{ color: isDark ? '#f1f5f9' : '#1e293b', fontWeight: '700', fontSize: '0.9rem' }}>{viewUser.role}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${isDark ? '#3a3a3a' : '#e2e8f0'}`, paddingBottom: '8px' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>Last Login</span>
                <span style={{ color: isDark ? '#f1f5f9' : '#1e293b', fontWeight: '700', fontSize: '0.9rem' }}>{fmt(viewUser.lastLogin)}</span>
              </div>
            </div>

            {/* Flag History Section */}
            <div style={{ marginTop: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1e293b' }}>Flag History</span>
                {flagHistory.length > 0 && (
                  <span style={{ backgroundColor: '#f59e0b', color: 'white', borderRadius: '9999px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: '700' }}>
                    {flagHistory.length} event{flagHistory.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {flagHistoryLoading ? (
                <div style={{ textAlign: 'center', padding: '16px', color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.85rem' }}>Loading history...</div>
              ) : flagHistory.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center', padding: '16px', backgroundColor: isDark ? '#2a2a2a' : '#f8fafc', borderRadius: '12px', color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.85rem', border: isDark ? '1px solid #3a3a3a' : '1px solid #e2e8f0' }}>
                  <CheckCircle size={16} color="#16a34a" />
                  <span>No flags recorded</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                  {flagHistory.map((log, i) => {
                    let displayType = log.type || 'Security Flag';
                    let displayColor = log.severity === 'High' ? '#ef4444' : '#f59e0b';
                    
                    if (displayType === 'Alt-Tab / Copy-Paste Violation') {
                      const actionStr = (log.desc || '').toLowerCase();
                      if (actionStr.includes('paste') || actionStr.includes('copy') || actionStr.includes('clipboard')) {
                        displayType = 'Copy/Paste Violation';
                        displayColor = '#ef4444';
                      } else {
                        displayType = 'Exit Tab Violation';
                        displayColor = '#f59e0b';
                      }
                    } else if (displayType === 'Copy/Paste Violation') {
                      displayColor = '#ef4444';
                    } else if (displayType === 'Exit Tab Violation') {
                      displayColor = '#f59e0b';
                    } else if (displayType.toLowerCase().includes('malicious') || (log.desc || '').toLowerCase().includes('malicious')) {
                      displayType = 'Malicious Script Attempt';
                      displayColor = '#dc2626';
                    }

                    return (
                      <div key={log.id || i} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        backgroundColor: isDark ? '#2a2a2a' : '#fff',
                        border: `1px solid ${isDark ? '#3a3a3a' : '#e2e8f0'}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: displayColor }}>
                            {displayType}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap' }}>
                            {fmt(log.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: isDark ? '#cbd5e1' : '#475569' }}>
                          {(() => {
                            let displayDesc = log.desc || 'Violation recorded';
                            const match = displayDesc.match(/in classroom (\w+)/);
                            if (match) {
                              const activityName = classroomsMap[match[1]] || `classroom ${match[1]}`;
                              displayDesc = displayDesc.replace(`in classroom ${match[1]}`, `in ${activityName}`);
                            }
                            return displayDesc;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                style={styles.submitBlueBtn}
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

