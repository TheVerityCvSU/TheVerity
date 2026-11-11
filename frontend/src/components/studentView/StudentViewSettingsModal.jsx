import { Settings, X, Moon, Sun } from 'lucide-react';

export default function StudentViewSettingsModal({
  showSettingsModal,
  setShowSettingsModal,
  isDark,
  toggleDarkMode,
  editorFontSize,
  setEditorFontSize
}) {
  if (!showSettingsModal) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
      onClick={() => setShowSettingsModal(false)}
    >
      <div
        style={{
          backgroundColor: isDark ? '#2c2c2c' : '#ffffff',
          color: isDark ? '#E8EAED' : '#1e293b',
          borderRadius: '20px',
          padding: '28px',
          width: '90%',
          maxWidth: '460px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
          border: isDark ? '1px solid #484848' : '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={22} color={isDark ? '#10b981' : '#0284c7'} />
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Workspace Settings</h3>
          </div>
          <button
            onClick={() => setShowSettingsModal(false)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isDark ? '#a3a3a3' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '6px'
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Dark Mode Toggle */}
        <div
          onClick={toggleDarkMode}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderRadius: '14px',
            backgroundColor: isDark ? '#222222' : '#f8fafc',
            border: isDark ? '1px solid #3c3c3c' : '1px solid #e2e8f0',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isDark ? <Moon size={22} color="#10b981" /> : <Sun size={22} color="#f59e0b" />}
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{isDark ? 'Dark Mode' : 'Light Mode'}</div>
              <div style={{ fontSize: '0.8rem', color: isDark ? '#a3a3a3' : '#64748b', marginTop: '2px' }}>
                Toggle dark coding environment
              </div>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            style={{
              width: '52px',
              height: '28px',
              borderRadius: '14px',
              backgroundColor: isDark ? '#10b981' : '#cbd5e1',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background-color 0.2s ease',
              padding: '2px'
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transform: isDark ? 'translateX(24px)' : 'translateX(0)',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>
        </div>

        {/* Editor Font Size */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px',
            borderRadius: '14px',
            backgroundColor: isDark ? '#222222' : '#f8fafc',
            border: isDark ? '1px solid #3c3c3c' : '1px solid #e2e8f0'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Editor Font Size</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#10b981' }}>{editorFontSize}px</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[13, 14, 16, 18, 20].map((sz) => (
              <button
                key={sz}
                onClick={() => {
                  setEditorFontSize(sz);
                  try {
                    localStorage.setItem('verity_editor_font_size', String(sz));
                  } catch {}
                }}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: '8px',
                  border: `1px solid ${editorFontSize === sz ? '#10b981' : isDark ? '#484848' : '#cbd5e1'}`,
                  backgroundColor: editorFontSize === sz ? (isDark ? '#064e3b' : '#ecfdf5') : isDark ? '#333333' : '#ffffff',
                  color: editorFontSize === sz ? '#10b981' : isDark ? '#E8EAED' : '#475569',
                  fontWeight: editorFontSize === sz ? '700' : '500',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {sz}px
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowSettingsModal(false)}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'opacity 0.15s ease'
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
