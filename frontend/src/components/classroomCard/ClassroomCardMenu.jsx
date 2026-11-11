import React from 'react';
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
  const dropdownItemStyle = {
    padding: '8px 12px',
    color: isDark ? '#E8EAED' : '#334155',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '6px',
    transition: 'background-color 0.15s'
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '48px',
        right: '12px',
        backgroundColor: isDark ? '#222222' : '#ffffff',
        borderRadius: '12px',
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.15)',
        border: isDark ? '1px solid #383838' : '1px solid #e2e8f0',
        zIndex: 60,
        minWidth: '140px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {isArchived ? (
        <div
          style={dropdownItemStyle}
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
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e, classroom.id);
            setMenuOpen(false);
          }}
        >
          <Trash2 size={15} style={{ marginRight: '8px' }} /> Delete
        </div>
      )}
    </div>
  );
}

