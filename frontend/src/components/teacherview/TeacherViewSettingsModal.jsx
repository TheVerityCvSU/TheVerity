import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Moon, Sun } from 'lucide-react';

export default function TeacherViewSettingsModal({
  show,
  onClose,
  isDark,
  toggleDarkMode,
  editorFontSize,
  setEditorFontSize,
  theme
}) {
  return (
    <AnimatePresence>
      {show && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            style={{
              backgroundColor: theme.cardBg,
              borderRadius: '14px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              border: `1px solid ${theme.border}`,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} color={theme.accent} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: theme.textPrimary }}>
                  Monitoring Settings
                </h3>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: theme.textMuted
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Theme Toggle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: theme.bg,
                border: `1px solid ${theme.border}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isDark ? <Moon size={20} color="#10b981" /> : <Sun size={20} color="#f59e0b" />}
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem', color: theme.textPrimary }}>
                    {isDark ? 'Dark Theme' : 'Light Theme'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: theme.textSecondary }}>
                    Adjust workspace color scheme
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleDarkMode}
                style={{
                  position: 'relative',
                  width: '48px',
                  height: '26px',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: isDark ? '#10b981' : '#cbd5e1',
                  transition: 'background-color 0.25s ease',
                  padding: 0
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: isDark ? '24px' : '3px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transition: 'left 0.25s ease'
                  }}
                />
              </button>
            </div>

            {/* Font Size Selector */}
            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: theme.bg,
                border: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', fontSize: '0.88rem', color: theme.textPrimary }}>
                  Editor Font Size
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: theme.accent }}>
                  {editorFontSize}px
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[12, 14, 15, 16, 18, 20].map((sz) => (
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
                      padding: '7px 0',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: editorFontSize === sz ? '700' : '500',
                      border: `1px solid ${editorFontSize === sz ? theme.accent : theme.border}`,
                      backgroundColor: editorFontSize === sz ? theme.accentBg : theme.cardBg,
                      color: editorFontSize === sz ? theme.accent : theme.textPrimary,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                padding: '10px 0',
                backgroundColor: theme.accent,
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '700',
                width: '100%'
              }}
            >
              Done
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
