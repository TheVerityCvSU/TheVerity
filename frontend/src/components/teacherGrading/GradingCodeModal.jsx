import React from 'react';
import { Code2, Copy, Check, X } from 'lucide-react';
import { getGradingModalStyles } from './gradingModalStyles';

export default function GradingCodeModal({
  selectedStudent,
  assignmentTitle,
  copiedCode,
  onCopyCode,
  onClose,
  isDark
}) {
  const styles = getGradingModalStyles(isDark);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.codeModalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Code2 size={20} color="#10b981" />
            <div>
              <h3 style={styles.modalTitle}>
                {selectedStudent?.name}'s Submitted Code
              </h3>
              <div style={{ fontSize: '0.78rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                {assignmentTitle} • {selectedStudent?.finalCode?.split('\n').length || 0} lines
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedStudent?.finalCode && (
              <button
                onClick={() => onCopyCode(selectedStudent.finalCode)}
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
          <code>{selectedStudent?.finalCode || '// No code found for this submission.'}</code>
        </pre>
      </div>
    </div>
  );
}

