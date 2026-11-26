import { Code2, X } from 'lucide-react';
import { getModalStyles } from './submissionModalStyles';

export default function ActivityCodeModal({ isDark, code, onClose }) {
  const styles = getModalStyles(isDark);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Code2 size={20} color="#10b981" />
            <h3 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1e293b', fontSize: '1.1rem' }}>
              Submitted C# Code
            </h3>
          </div>
          <button
            onClick={onClose}
            style={styles.closeModalBtn}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
        <pre style={styles.modalCodeBody}>
          {code || "No code found."}
        </pre>
      </div>
    </div>
  );
}

