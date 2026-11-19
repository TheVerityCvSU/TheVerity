import React from 'react';
import { motion } from 'framer-motion';
import Skeleton from '../Skeleton';
import { formatUserDate } from '../../data/adminUsers';

export default function UsersTable({
  loading = false,
  filtered,
  users,
  selected = [],
  toggleAll,
  onToggleAll,
  toggleSel,
  onToggleSel,
  onOpenEdit,
  onEditUser,
  onViewUser,
  getUserStatus = (u) => u?.status || 'Active',
  fmt = formatUserDate,
  isDark,
  styles = {}
}) {
  const userList = Array.isArray(filtered) ? filtered : (Array.isArray(users) ? users : []);
  const safeSelected = Array.isArray(selected) ? selected : [];
  const handleToggleAll = toggleAll || onToggleAll;
  const handleToggleSel = toggleSel || onToggleSel;
  const handleEdit = onOpenEdit || onEditUser;
  const formatDate = typeof fmt === 'function' ? fmt : (val) => (val ? new Date(val).toLocaleDateString() : 'Never');

  const isAllChecked = safeSelected.length === userList.length && userList.length > 0;

  return (
    <div style={styles.tableWrap}>
      <div style={{
        backgroundColor: isDark ? '#374151' : '#a3aeb9',
        borderRadius: '9999px',
        padding: '12px 20px',
        display: 'grid',
        gridTemplateColumns: '36px minmax(130px, 1.4fr) minmax(160px, 1.6fr) minmax(95px, 0.9fr) minmax(115px, 1fr) minmax(170px, 1.5fr) minmax(95px, 0.8fr)',
        columnGap: '18px',
        alignItems: 'center',
        fontWeight: '700',
        color: isDark ? '#f1f5f9' : '#0f172a',
        fontSize: '0.85rem',
        marginBottom: '8px',
        minWidth: '940px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={isAllChecked}
            onChange={handleToggleAll}
          />
        </div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '6px' }}>Name</div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '6px' }}>Email</div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Role</div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Status</div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Last Login</div>
        <div style={{ textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Actions</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton.Row key={i} />)
        ) : userList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: isDark ? '#64748b' : '#94a3b8' }}>
            No users found
          </div>
        ) : (
          userList.map(u => (
            <div
              key={u.email}
              className="table-row-pill"
              style={{
                padding: '10px 20px',
                display: 'grid',
                gridTemplateColumns: '36px minmax(130px, 1.4fr) minmax(160px, 1.6fr) minmax(95px, 0.9fr) minmax(115px, 1fr) minmax(170px, 1.5fr) minmax(95px, 0.8fr)',
                columnGap: '18px',
                alignItems: 'center',
                fontSize: '0.85rem',
                minWidth: '940px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={safeSelected.includes(u.email)}
                  onChange={() => handleToggleSel && handleToggleSel(u.email)}
                />
              </div>
              <div 
                style={{ 
                  fontWeight: '600', 
                  color: isDark ? '#f1f5f9' : '#1e293b', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  paddingRight: '6px'
                }}
                title={u.name}
              >
                {u.name}
              </div>
              <div 
                style={{ 
                  color: isDark ? '#94a3b8' : '#64748b', 
                  fontSize: '0.8rem', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  paddingRight: '6px'
                }}
                title={u.email}
              >
                {u.email}
              </div>
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center' }}>
                <span style={styles.rolePill}>{u.role}</span>
              </div>
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center' }}>
                <span style={getUserStatus(u) === 'Active' ? styles.statusGreenPill : styles.statusRedPill}>
                  {getUserStatus(u)}
                </span>
              </div>
              <div 
                style={{ 
                  fontSize: '0.78rem', 
                  color: isDark ? '#94a3b8' : '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={formatDate(u.lastLogin)}
              >
                {formatDate(u.lastLogin)}
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', minWidth: 0 }}>
                <motion.button
                  whileHover={{ opacity: 0.7, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleEdit && handleEdit(u)}
                  style={styles.actionTextLink}
                >
                  Edit
                </motion.button>
                <motion.button
                  whileHover={{ opacity: 0.7, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onViewUser && onViewUser(u)}
                  style={{ ...styles.actionTextLink, color: isDark ? '#a78bfa' : '#6366f1' }}
                >
                  View
                </motion.button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
