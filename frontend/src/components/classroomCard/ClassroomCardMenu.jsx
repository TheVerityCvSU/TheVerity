import React from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Trash2, Archive, RotateCcw, Settings } from 'lucide-react';

export default function ClassroomCardMenu({
  classroom,
  isArchived,
  role,
  onArchive,
  onUnarchive,
  onSettings,
  onDelete,
  handleCopyCode,
  copied,
  setMenuOpen,
  isDark
}) {
  // Principle 10: Enforce 44px minimum interactive hit area
  const dropdownItemStyle = {
    minHeight: '44px',
    padding: '10px 14px',
    color: isDark ? '#E8EAED' : '#334155',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '8px',
    transition: 'background-color 0.15s ease, color 0.15s ease'
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      style={{
        position: 'absolute',
        bottom: '48px',
        right: '12px',
        transformOrigin: 'bottom right', // Principle 17: Origin-aware expansion
        backgroundColor: isDark ? '#222222' : '#ffffff',
        borderRadius: '12px',
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.15)',
        border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
        zIndex: 60,
        minWidth: '150px'
      }}
      className="origin-bottom-right"
      onClick={(e) => e.stopPropagation()}
    >
      {isArchived ? (
        <div
          style={dropdownItemStyle}
          className="clickable-affordance touch-target-44"
          onClick={(e) => {
            e.stopPropagation();
            if (onUnarchive) onUnarchive(e, classroom.id);
            else if (onArchive) onArchive(e, classroom.id);
            setMenuOpen(false);
          }}
        >
          <RotateCcw size={15} style={{ marginRight: '8px' }} /> Unarchive
        </div>
      ) : (
        <>
          <div
            style={dropdownItemStyle}
            className="clickable-affordance touch-target-44"
            onClick={(e) => {
              e.stopPropagation();
              if (onArchive) onArchive(e, classroom.id);
              setMenuOpen(false);
            }}
          >
            <Archive size={15} style={{ marginRight: '8px' }} /> Archive
          </div>
          {role === 'Teacher' && onSettings && (
            <div
              style={dropdownItemStyle}
              className="clickable-affordance touch-target-44"
              onClick={(e) => {
                e.stopPropagation();
                onSettings(classroom);
                setMenuOpen(false);
              }}
            >
              <Settings size={15} style={{ marginRight: '8px' }} /> Settings
            </div>
          )}
          <div
            style={dropdownItemStyle}
            className="clickable-affordance touch-target-44"
            onClick={handleCopyCode}
          >
            {copied ? <Check size={15} color="#10b981" style={{ marginRight: '8px' }} /> : <Copy size={15} style={{ marginRight: '8px' }} />}
            {copied ? 'Code Copied!' : 'Copy Code'}
          </div>
        </>
      )}

      {onDelete && (
        <div
          style={{ ...dropdownItemStyle, color: '#ef4444' }}
          className="clickable-affordance touch-target-44"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e, classroom.id);
            setMenuOpen(false);
          }}
        >
          <Trash2 size={15} style={{ marginRight: '8px' }} /> Delete
        </div>
      )}
    </motion.div>
  );
}

