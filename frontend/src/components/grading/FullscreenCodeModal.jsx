import { Code2, Copy, Check, X } from 'lucide-react';

export default function FullscreenCodeModal({
  isOpen,
  onClose,
  student,
  assignment,
  copiedCode,
  onCopyCode,
  isDark,
  styles
}) {
  if (!isOpen || !student) return null;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.codeModalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Code2 size={20} color="#10b981" />
            <div>
              <h3 style={styles.modalTitle}>
                {student.name}'s Submitted Code
              </h3>
              <div style={{ fontSize: '0.78rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                {assignment?.title} • {student.finalCode?.split('\n').length || 0} lines
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {student.finalCode && (
              <button
                onClick={() => onCopyCode(student.finalCode)}
                style={styles.modalCopyBtn}
                className="btn-anim"
              >
                {copiedCode ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              style={styles.closeModalBtn}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <pre style={styles.modalCodeBody}>
          <code>{student.finalCode || '// No code found for this submission.'}</code>
        </pre>
      </div>
    </div>
  );
}
