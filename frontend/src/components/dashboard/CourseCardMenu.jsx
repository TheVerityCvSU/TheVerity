import { Settings, Copy, Check, Archive, RefreshCw, Trash2 } from 'lucide-react';

export default function CourseCardMenu({
  isDark,
  isArchivedCard,
  onSettings,
  classroom,
  copied,
  onCopyCode,
  onArchive,
  onUnarchive,
  onDelete,
  onClose
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '8px',
        backgroundColor: isDark ? '#262626' : '#ffffff',
        border: isDark ? '1px solid #404040' : '1px solid #e5e7eb',
        borderRadius: '14px',
        boxShadow: isDark
          ? '0 12px 28px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.3)'
          : '0 12px 28px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.06)',
        zIndex: 100,
        width: '180px',
        overflow: 'hidden',
        padding: '4px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {!isArchivedCard && onSettings && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onSettings(classroom);
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
          <Settings size={16} color={isDark ? '#9ca3af' : '#64748b'} /> Settings
        </button>
      )}

      <button
        type="button"
        onClick={(e) => {
          onCopyCode(e);
          onClose();
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
        {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} color={isDark ? '#9ca3af' : '#64748b'} />}
        {copied ? 'Code Copied!' : 'Copy Code'}
      </button>

      {!isArchivedCard && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            if (onArchive) onArchive(e, classroom.id);
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
          <Archive size={16} color={isDark ? '#9ca3af' : '#64748b'} /> Archive
        </button>
      )}

      {isArchivedCard && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            if (onUnarchive) onUnarchive(e, classroom.id);
            else if (onArchive) onArchive(e, classroom.id);
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
          <RefreshCw size={16} color={isDark ? '#9ca3af' : '#64748b'} /> Unarchive
        </button>
      )}

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onDelete(classroom);
          }}
          style={{
            width: '100%',
            padding: '10px 14px',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            borderRadius: '10px',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Trash2 size={16} /> Delete
        </button>
      )}
    </div>
  );
}

