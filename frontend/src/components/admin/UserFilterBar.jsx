import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter } from 'lucide-react';

export default function UserFilterBar({
  query,
  setQuery,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  isDark,
  styles
}) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const roleDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setRoleOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dropdownStyle = {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    backgroundColor: isDark ? '#1e1e1e' : 'white',
    borderRadius: '16px',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
    padding: '14px 16px',
    zIndex: 100,
    minWidth: '180px',
    border: isDark ? '1px solid #3a3a3a' : '1px solid #e2e8f0',
  };

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
      <div
        style={{
          ...styles.searchPill,
          border: searchFocused ? '1.5px solid #007bff' : (isDark ? '1.5px solid #4a5568' : '1.5px solid #cbd5e1'),
          boxShadow: searchFocused ? (isDark ? '0 0 0 3px rgba(0, 123, 255, 0.25)' : '0 0 0 3px rgba(0, 123, 255, 0.15)') : 'none',
        }}
      >
        <Search size={15} color={searchFocused ? '#007bff' : (isDark ? '#94a3b8' : '#64748b')} style={{ flexShrink: 0 }} />
        <motion.input
          className="search-clean-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search..."
          style={{
            ...styles.searchInput,
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            boxShadow: 'none',
          }}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>

      {/* Role Filter */}
      <div ref={roleDropdownRef} style={{ position: 'relative' }}>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { setRoleOpen(p => !p); setStatusOpen(false); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '9999px',
            minWidth: '150px',
            border: roleFilter !== 'All' ? '1.5px solid #2563eb' : `1px solid ${isDark ? '#4a5568' : '#cbd5e1'}`,
            backgroundColor: roleFilter !== 'All' ? (isDark ? '#1e3a5f' : '#eff6ff') : (isDark ? '#2a2a2a' : 'white'),
            color: roleFilter !== 'All' ? '#2563eb' : (isDark ? '#e2e8f0' : '#334155'),
            fontSize: '0.83rem',
            fontWeight: '600',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <Filter size={13} style={{ flexShrink: 0 }} />
          <span style={{ width: '100px', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {roleFilter === 'All' ? 'Filter by Roles' : roleFilter}
          </span>
        </motion.button>
        <AnimatePresence>
          {roleOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              style={dropdownStyle}
            >
              <p style={{ margin: '0 0 10px', fontSize: '0.78rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['All', 'Student', 'Teacher'].map(role => (
                  <motion.button
                    key={role}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setRoleFilter(role); setRoleOpen(false); }}
                    style={roleFilter === role ? styles.filterChipActive : styles.filterChip}
                  >
                    {role === 'All' ? 'All Roles' : role}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Filter */}
      <div ref={statusDropdownRef} style={{ position: 'relative' }}>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { setStatusOpen(p => !p); setRoleOpen(false); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '9999px',
            minWidth: '150px',
            border: statusFilter !== 'All' ? '1.5px solid #2563eb' : `1px solid ${isDark ? '#4a5568' : '#cbd5e1'}`,
            backgroundColor: statusFilter !== 'All' ? (isDark ? '#1e3a5f' : '#eff6ff') : (isDark ? '#2a2a2a' : 'white'),
            color: statusFilter !== 'All' ? '#2563eb' : (isDark ? '#e2e8f0' : '#334155'),
            fontSize: '0.83rem',
            fontWeight: '600',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <Filter size={13} style={{ flexShrink: 0 }} />
          <span style={{ width: '100px', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {statusFilter === 'All' ? 'Filter by Status' : statusFilter}
          </span>
        </motion.button>
        <AnimatePresence>
          {statusOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              style={dropdownStyle}
            >
              <p style={{ margin: '0 0 10px', fontSize: '0.78rem', fontWeight: '700', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['All', 'Active', 'Inactive'].map(status => (
                  <motion.button
                    key={status}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setStatusFilter(status); setStatusOpen(false); }}
                    style={statusFilter === status ? styles.filterChipActive : styles.filterChip}
                  >
                    {status === 'All' ? 'All Status' : status}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

