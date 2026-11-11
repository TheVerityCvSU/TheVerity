import React from 'react';
import { motion } from 'framer-motion';
import Skeleton from '../Skeleton';

export default function UsersTable({
  loading,
  filtered,
  selected,
  toggleAll,
  toggleSel,
  onOpenEdit,
  onViewUser,
  getUserStatus,
  fmt,
  isDark,
  styles
}) {
  return (
    <div style={styles.tableWrap}>
      <div style={{
        backgroundColor: isDark ? '#374151' : '#a3aeb9',
        borderRadius: '9999px',
        padding: '12px 20px',
        display: 'grid',
        gridTemplateColumns: '40px 1.5fr 1.5fr 1fr 1fr 1.2fr 1fr',
        alignItems: 'center',
        fontWeight: '700',
        color: isDark ? '#f1f5f9' : '#0f172a',
        fontSize: '0.85rem',
        marginBottom: '8px'
      }}>
        <div>
          <input
            type="checkbox"
            checked={selected.length === filtered.length && filtered.length > 0}
            onChange={toggleAll}
          />
        </div>
        <div>Name</div>
        <div>Email</div>
        <div>Role</div>
        <div>Status</div>
        <div>Last Login</div>
        <div style={{ textAlign: 'right' }}>Actions</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton.Row key={i} />)
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: isDark ? '#64748b' : '#94a3b8' }}>
            No users found
          </div>
        ) : (
          filtered.map(u => (
            <div
              key={u.email}
              className="table-row-pill"
              style={{
                padding: '10px 20px',
                display: 'grid',
                gridTemplateColumns: '40px 1.5fr 1.5fr 1fr 1fr 1.2fr 1fr',
                alignItems: 'center',
                fontSize: '0.85rem'
              }}
            >
              <div>
                <input
                  type="checkbox"
                  checked={selected.includes(u.email)}
                  onChange={() => toggleSel(u.email)}
                />
              </div>
              <div style={{ fontWeight: '600', color: isDark ? '#f1f5f9' : '#1e293b' }}>{u.name}</div>
              <div style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {u.email}
              </div>
              <div><span style={styles.rolePill}>{u.role}</span></div>
              <div>
                <span style={getUserStatus(u) === 'Active' ? styles.statusGreenPill : styles.statusRedPill}>
                  {getUserStatus(u)}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: isDark ? '#94a3b8' : '#64748b' }}>{fmt(u.lastLogin)}</div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                <motion.button
                  whileHover={{ opacity: 0.7, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onOpenEdit(u)}
                  style={styles.actionTextLink}
                >
                  Edit
                </motion.button>
                <motion.button
                  whileHover={{ opacity: 0.7, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onViewUser(u)}
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

