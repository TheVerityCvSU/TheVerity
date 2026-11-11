import React from 'react';
import { Plus, X } from 'lucide-react';

export default function CompilerFileTabs({
  activeFileId,
  setActiveFileId,
  extraFiles = [],
  handleAddFile,
  handleDeleteFile,
  handleRenameFile,
  renamingFileId,
  setRenamingFileId,
  renameValue,
  setRenameValue,
  theme,
  isDark,
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '32px',
        flexShrink: 0,
        backgroundColor: theme.tabsBg,
        borderBottom: theme.tabsBdr,
        userSelect: 'none',
        overflowX: 'auto',
      }}
    >
      {/* Main Program.cs Tab */}
      <div
        onClick={() => setActiveFileId('main')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 14px',
          height: '100%',
          borderRight: theme.tabsBdr,
          backgroundColor: activeFileId === 'main' ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
          color: activeFileId === 'main' ? (isDark ? '#e8eaed' : '#111827') : isDark ? '#9ca3af' : '#6b7280',
          fontSize: '0.75rem',
          fontWeight: activeFileId === 'main' ? '700' : '500',
          borderBottom: activeFileId === 'main' ? '2px solid #10b981' : '2px solid transparent',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold' }}>{'{ }'}</span>
        <span>Program.cs</span>
      </div>

      {/* Extra Files Tabs */}
      {extraFiles.map((f) => (
        <div
          key={f.id}
          onClick={() => setActiveFileId(f.id)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setRenamingFileId(f.id);
            setRenameValue(f.name);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 8px 0 12px',
            height: '100%',
            borderRight: theme.tabsBdr,
            backgroundColor: activeFileId === f.id ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
            color: activeFileId === f.id ? (isDark ? '#e8eaed' : '#111827') : isDark ? '#9ca3af' : '#6b7280',
            fontSize: '0.75rem',
            fontWeight: activeFileId === f.id ? '700' : '500',
            borderBottom: activeFileId === f.id ? '2px solid #10b981' : '2px solid transparent',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
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
                width: '90px',
                fontSize: '0.75rem',
                padding: '2px 5px',
                border: '1px solid #10b981',
                borderRadius: '4px',
                outline: 'none',
                backgroundColor: isDark ? '#333333' : '#ffffff',
                color: isDark ? '#e8eaed' : '#111827',
              }}
            />
          ) : (
            <span title="Double-click to rename file" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.65rem', color: isDark ? '#9ca3af' : '#6b7280' }}>{'{ }'}</span>
              <span>{f.name}.cs</span>
            </span>
          )}

          {renamingFileId !== f.id && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFile(f.id);
              }}
              title={`Delete ${f.name}.cs`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                color: isDark ? '#6b7280' : '#9ca3af',
                borderRadius: '3px',
                marginLeft: '2px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af')}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}

      {/* Add Another File Button */}
      <button
        type="button"
        onClick={handleAddFile}
        title="Add another C# file"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 12px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: isDark ? '#9ca3af' : '#6b7280',
          fontSize: '0.75rem',
          fontWeight: '600',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#10b981';
          e.currentTarget.style.backgroundColor = isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = isDark ? '#9ca3af' : '#6b7280';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Plus size={14} />
        <span>New File</span>
      </button>
    </div>
  );
}

