import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, RefreshCw } from 'lucide-react';

export default function ClassroomSearchBar({
  query,
  setQuery,
  isDark,
  isSyncing,
  onSync,
  onCreateOpen,
  styles,
  muted
}) {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
      <div
        style={{
          ...styles.searchPill,
          maxWidth: '600px',
          flex: 1,
          border: searchFocused ? '1.5px solid #007bff' : (isDark ? '1px solid #3a3a3a' : '1px solid #e2e8f0'),
          boxShadow: searchFocused ? (isDark ? '0 0 0 3px rgba(0, 123, 255, 0.25)' : '0 0 0 3px rgba(0, 123, 255, 0.15)') : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s'
        }}
      >
        <Search size={16} color={searchFocused ? '#007bff' : muted} style={{ flexShrink: 0 }} />
        <motion.input
          className="search-clean-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by class name, instructor, or subject..."
          style={{ ...styles.searchInput, border: 'none', outline: 'none' }}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onSync}
          style={{
            ...styles.actionBtn,
            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
            color: isDark ? '#93c5fd' : '#2563eb',
            border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
            boxShadow: 'none'
          }}
          title="Synchronize classrooms between LAN and Online Cloud"
          disabled={isSyncing}
        >
          <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
          <span>{isSyncing ? 'Syncing...' : 'Sync & Refresh'}</span>
        </motion.button>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onCreateOpen} style={styles.addBlueBtn} className="btn-anim">
          <Plus size={16} /><span>Create New Class</span>
        </motion.button>
      </div>
    </div>
  );
}
