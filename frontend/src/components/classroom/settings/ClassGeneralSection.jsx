import React from 'react';
import { Copy, Maximize, RefreshCw } from 'lucide-react';

export default function ClassGeneralSection({
  formData,
  classroom,
  general,
  setGeneral,
  handleRegenerateCode,
  handleCopyCode,
  copiedCode,
  isDark,
  styles,
}) {
  const classCode = formData.code || classroom?.code || '';

  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>General</h2>

      <div style={styles.subSection}>
        <h3 style={styles.subSectionTitle}>Invite codes</h3>

        <div style={styles.rowItem}>
          <div>
            <div style={styles.rowLabel}>Manage invite codes</div>
            <div style={styles.rowDesc}>Settings apply to both invite links and class codes</div>
          </div>
          <select
            style={styles.selectText}
            value={general.inviteCodes}
            onChange={(e) => {
              const val = e.target.value;
              setGeneral({ ...general, inviteCodes: val });
              if (val === 'Reset') {
                handleRegenerateCode();
              }
            }}
          >
            <option style={styles.option}>Turned on</option>
            <option style={styles.option}>Turned off</option>
            <option style={styles.option}>Reset</option>
          </select>
        </div>

        <div style={styles.rowItem}>
          <div style={styles.rowLabel}>Invite link</div>
          <div style={styles.rowActionGroup}>
            <span style={styles.rowValue}>https://verity.app/join/{classCode}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`https://verity.app/join/${classCode}`);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
            >
              <Copy size={18} style={styles.actionIcon} />
            </button>
          </div>
        </div>

        <div style={styles.rowItem}>
          <div style={styles.rowLabel}>Class code</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ ...styles.rowValue, fontFamily: 'monospace', fontWeight: '800', color: '#10b981', letterSpacing: '0.05em' }}>
              {classCode || '...'}
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: copiedCode ? '#10b981' : (isDark ? '#9ca3af' : '#64748b')
              }}
              title={copiedCode ? 'Copied!' : 'Copy class code'}
            >
              <Copy size={16} />
            </button>
            <button
              type="button"
              onClick={handleRegenerateCode}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: isDark ? '#9ca3af' : '#64748b'
              }}
              title="Regenerate class code"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div style={styles.rowItem}>
          <div style={styles.rowLabel}>Class view</div>
          <div style={styles.rowActionGroup}>
            <span style={styles.linkText}>Display class code</span>
            <Maximize size={18} style={{ ...styles.actionIcon, color: isDark ? '#60a5fa' : '#1a73e8' }} />
          </div>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.subSection}>
        <h3 style={styles.subSectionTitle}>Stream and classwork</h3>

        <div style={styles.rowItem}>
          <div style={styles.rowLabel}>Stream</div>
          <select
            style={styles.selectBox}
            value={general.stream}
            onChange={(e) => setGeneral({ ...general, stream: e.target.value })}
          >
            <option style={styles.option}>Students can post and comment</option>
            <option style={styles.option}>Students can only comment</option>
            <option style={styles.option}>Only teachers can post or comment</option>
          </select>
        </div>

        <div style={styles.rowItem}>
          <div style={styles.rowLabel}>Classwork on the Stream</div>
          <select
            style={styles.selectBox}
            value={general.classworkStream}
            onChange={(e) => setGeneral({ ...general, classworkStream: e.target.value })}
          >
            <option style={styles.option}>Show condensed notifications</option>
            <option style={styles.option}>Show attachments and details</option>
            <option style={styles.option}>Hide notifications</option>
          </select>
        </div>

        <div style={styles.rowItem}>
          <div>
            <div style={styles.rowLabel}>Show deleted items</div>
            <div style={styles.rowDesc}>Only teachers can view deleted items.</div>
          </div>
          <label style={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={general.showDeleted}
              onChange={(e) => setGeneral({ ...general, showDeleted: e.target.checked })}
              style={styles.toggleInput}
            />
            <div style={general.showDeleted ? styles.toggleSliderActive : styles.toggleSlider}>
              <div style={general.showDeleted ? styles.toggleCircleActive : styles.toggleCircle}></div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

