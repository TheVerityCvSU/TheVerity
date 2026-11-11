import React from 'react';
import { Archive, RefreshCw } from 'lucide-react';

export default function StudentCourseCardMenu({
  isDark,
  isArchivedCard,
  classroom,
  onArchive,
  onUnarchive,
  onClose
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        backgroundColor: isDark ? '#262626' : '#ffffff',
        border: isDark ? '1px solid #404040' : '1px solid #e5e7eb',
        borderRadius: '14px',
        boxShadow: isDark
          ? '0 12px 28px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.3)'
          : '0 12px 28px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.06)',
        zIndex: 100,
        width: '160px',
        overflow: 'hidden',
        padding: '4px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {!isArchivedCard && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            if (onArchive) onArchive(classroom);
          }}
          style={{
            width: '100%',
            padding: '10px 14px',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            borderRadius: '10px',
            color: isDark ? '#f3f4f6' : '#1f2937',
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? '#333333' : '#f1f5f9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Archive size={16} color={isDark ? '#9ca3af' : '#64748b'} />
          Archive
        </button>
      )}

      {isArchivedCard && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            if (onUnarchive) onUnarchive(classroom);
            else if (onArchive) onArchive(classroom);
          }}
          style={{
            width: '100%',
            padding: '10px 14px',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            borderRadius: '10px',
            color: isDark ? '#f3f4f6' : '#1f2937',
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? '#333333' : '#f1f5f9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <RefreshCw size={16} color={isDark ? '#9ca3af' : '#64748b'} />
          Unarchive
        </button>
      )}
    </div>
  );
}

