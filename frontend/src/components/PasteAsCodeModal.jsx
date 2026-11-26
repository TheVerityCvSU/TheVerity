import { motion, AnimatePresence } from 'framer-motion';
import { Code2, FileCode, FileText, X } from 'lucide-react';

/**
 * PasteAsCodeModal
 * Intercepts HTML/code and Word paste events in the instruction editor,
 * presenting a modern, theme-consistent modal prompting the user
 * to choose how to format the pasted content (e.g., Code Block vs HTML vs Plain Text).
 */
export default function PasteAsCodeModal({
  isOpen,
  isDark = false,
  data,
  onPasteCode,
  onPasteHtml,
  onPasteText,
  onPasteOnlyText,
  onClose
}) {
  if (!isOpen || !data) return null;

  const isWord = Boolean(data.isWord);

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 100005,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          style={{
            width: '100%',
            maxWidth: '470px',
            backgroundColor: isDark ? '#1a1f1e' : '#ffffff',
            borderRadius: '16px',
            border: isDark ? '1px solid #2e3d38' : '1px solid #e2e8f0',
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(16, 185, 129, 0.15)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px 16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: isDark ? '1px solid #26332f' : '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                flexShrink: 0
              }}>
                <Code2 size={22} />
              </div>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '1.12rem',
                  fontWeight: '700',
                  color: isDark ? '#f3f4f6' : '#1e293b',
                  letterSpacing: '-0.01em'
                }}>
                  {isWord ? 'Word Paste Detected' : 'Paste as Code?'}
                </h3>
                <p style={{
                  margin: '2px 0 0 0',
                  fontSize: '0.82rem',
                  color: isDark ? '#9ca3af' : '#64748b'
                }}>
                  {isWord ? 'Pasted from Word or Excel document' : 'Pasted content contains code or HTML tags'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: isDark ? '#9ca3af' : '#64748b',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#26332f' : '#f1f5f9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              title="Cancel (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Options */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{
              margin: '0 0 4px 0',
              fontSize: '0.88rem',
              color: isDark ? '#d1d5db' : '#334155',
              lineHeight: 1.5
            }}>
              {isWord
                ? 'Choose how you want to import this document text into instructions:'
                : 'Choose how you want to format this content in the instructions:'}
            </p>

            {!isWord ? (
              <>
                {/* Option 1: Paste as Code Block (Primary / Recommended) */}
                <button
                  type="button"
                  onClick={onPasteCode}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
                    border: '1.5px solid #10b981',
                    color: isDark ? '#e5e7eb' : '#065f46',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(16, 185, 129, 0.18)' : '#d1fae5';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <Code2 size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.92rem', color: isDark ? '#a7f3d0' : '#047857' }}>
                        Paste as Code Block
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '2px 7px',
                        borderRadius: '50px',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        fontWeight: '700'
                      }}>
                        Recommended
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#065f46', opacity: 0.9, lineHeight: 1.4 }}>
                      Preserves code formatting and characters (e.g. &lt;stdio.h&gt;) inside a monospace block.
                    </p>
                  </div>
                </button>

                {/* Option 2: Keep as HTML */}
                <button
                  type="button"
                  onClick={onPasteHtml}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#222826' : '#f8fafc',
                    border: isDark ? '1px solid #33403c' : '1px solid #e2e8f0',
                    color: isDark ? '#e5e7eb' : '#1e293b',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? '#29322f' : '#f1f5f9';
                    e.currentTarget.style.borderColor = isDark ? '#435450' : '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? '#222826' : '#f8fafc';
                    e.currentTarget.style.borderColor = isDark ? '#33403c' : '#e2e8f0';
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? '#2d3734' : '#e2e8f0',
                    color: isDark ? '#9ca3af' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <FileCode size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: '600', fontSize: '0.9rem', color: isDark ? '#f3f4f6' : '#1e293b' }}>
                      Keep as HTML
                    </span>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#64748b', lineHeight: 1.4 }}>
                      Renders HTML elements directly (tables, bold text, links, lists).
                    </p>
                  </div>
                </button>

                {/* Option 3: Plain Text */}
                <button
                  type="button"
                  onClick={onPasteOnlyText || onPasteText}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#222826' : '#f8fafc',
                    border: isDark ? '1px solid #33403c' : '1px solid #e2e8f0',
                    color: isDark ? '#e5e7eb' : '#1e293b',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? '#29322f' : '#f1f5f9';
                    e.currentTarget.style.borderColor = isDark ? '#435450' : '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? '#222826' : '#f8fafc';
                    e.currentTarget.style.borderColor = isDark ? '#33403c' : '#e2e8f0';
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? '#2d3734' : '#e2e8f0',
                    color: isDark ? '#9ca3af' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <FileText size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: '600', fontSize: '0.9rem', color: isDark ? '#f3f4f6' : '#1e293b' }}>
                      Insert as Plain Text
                    </span>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#64748b', lineHeight: 1.4 }}>
                      Strips all tags and inserts clean raw text without any formatting.
                    </p>
                  </div>
                </button>
              </>
            ) : (
              <>
                {/* Word: Keep Formatting */}
                <button
                  type="button"
                  onClick={onPasteHtml}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
                    border: '1.5px solid #10b981',
                    color: isDark ? '#e5e7eb' : '#065f46',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: '700', fontSize: '0.92rem', color: isDark ? '#a7f3d0' : '#047857' }}>
                      Keep Word Formatting
                    </span>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#065f46', opacity: 0.9 }}>
                      Preserves colors, tables, and document layout.
                    </p>
                  </div>
                </button>

                {/* Word: Clean Formatting */}
                <button
                  type="button"
                  onClick={onPasteOnlyText}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#222826' : '#f8fafc',
                    border: isDark ? '1px solid #33403c' : '1px solid #e2e8f0',
                    color: isDark ? '#e5e7eb' : '#1e293b',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: '600', fontSize: '0.9rem', color: isDark ? '#f3f4f6' : '#1e293b' }}>
                      Clean Formatting
                    </span>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#64748b' }}>
                      Removes messy Word styles and keeps standard text and lists.
                    </p>
                  </div>
                </button>
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 24px 18px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            borderTop: isDark ? '1px solid #26332f' : '1px solid #f1f5f9'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: isDark ? '1px solid #3a4743' : '1px solid #d1d5db',
                backgroundColor: 'transparent',
                color: isDark ? '#9ca3af' : '#475569',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.88rem',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#26332f' : '#f1f5f9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
