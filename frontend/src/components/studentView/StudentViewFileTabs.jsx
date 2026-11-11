import { Plus, X } from 'lucide-react';

export default function StudentViewFileTabs({
  isDark,
  submitted,
  activeFileId,
  setActiveFileId,
  extraFiles,
  renamingFileId,
  setRenamingFileId,
  renameValue,
  setRenameValue,
  handleAddFile,
  handleDeleteFile,
  handleRenameFile
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '28px',
        backgroundColor: isDark ? '#252526' : '#f3f4f6',
        borderBottom: isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db',
        overflowX: 'auto',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      {/* Program.cs (main) tab */}
      <div
        onClick={() => setActiveFileId('main')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '0 10px',
          height: '100%',
          cursor: 'pointer',
          borderRight: isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db',
          backgroundColor: activeFileId === 'main' ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
          color: activeFileId === 'main' ? (isDark ? '#e8eaed' : '#111827') : isDark ? '#9ca3af' : '#6b7280',
          fontSize: '0.75rem',
          fontWeight: activeFileId === 'main' ? '600' : '400',
          borderBottom: activeFileId === 'main' ? '2px solid #10b981' : '2px solid transparent',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{'{ }'}</span>
        Program.cs
      </div>

      {/* Extra file tabs */}
      {extraFiles.map((f) => (
        <div
          key={f.id}
          onDoubleClick={() => {
            if (!submitted) {
              setRenamingFileId(f.id);
              setRenameValue(f.name);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '0 6px 0 10px',
            height: '100%',
            borderRight: isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db',
            backgroundColor: activeFileId === f.id ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
            color: activeFileId === f.id ? (isDark ? '#e8eaed' : '#111827') : isDark ? '#9ca3af' : '#6b7280',
            fontSize: '0.75rem',
            fontWeight: activeFileId === f.id ? '600' : '400',
            borderBottom: activeFileId === f.id ? '2px solid #10b981' : '2px solid transparent',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            cursor: 'pointer'
          }}
        >
          {renamingFileId === f.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRenameFile(f.id, renameValue)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameFile(f.id, renameValue);
                if (e.key === 'Escape') setRenamingFileId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '80px',
                fontSize: '0.75rem',
                padding: '1px 4px',
                border: '1px solid #10b981',
                borderRadius: '3px',
                outline: 'none',
                backgroundColor: isDark ? '#333' : '#fff',
                color: isDark ? '#e8eaed' : '#111827'
              }}
            />
          ) : (
            <span onClick={() => setActiveFileId(f.id)} title="Double-click to rename">
              <span style={{ fontSize: '0.65rem', opacity: 0.6, marginRight: '3px' }}>{'{ }'}</span>
              {f.name}.cs
            </span>
          )}
          {!submitted && renamingFileId !== f.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFile(f.id);
              }}
              title="Delete file"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '1px',
                display: 'flex',
                alignItems: 'center',
                color: isDark ? '#555' : '#bbb',
                marginLeft: '1px',
                borderRadius: '2px'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#555' : '#bbb')}
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}

      {/* Add file button */}
      {!submitted && (
        <button
          onClick={handleAddFile}
          title="Add new file"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 10px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            color: isDark ? '#6b7280' : '#9ca3af',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#10b981';
            e.currentTarget.style.backgroundColor = isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Plus size={13} />
        </button>
      )}
    </div>
  );
}
