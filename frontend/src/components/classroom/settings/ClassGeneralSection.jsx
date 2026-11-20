import React, { useState } from 'react';
import { Check, Copy, Maximize, RefreshCw, X } from 'lucide-react';

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
  const inviteLink = `https://verity.app/join/${classCode}`;
  const isInviteOff = general.inviteCodes === 'Turned off';
  const [copiedLink, setCopiedLink] = useState(false);
  const [codeResetNotice, setCodeResetNotice] = useState(false);
  const [showLargeCodeModal, setShowLargeCodeModal] = useState(false);

  const handleCopyInviteLink = () => {
    if (!classCode || isInviteOff) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(inviteLink).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const triggerResetCode = () => {
    handleRegenerateCode();
    setCodeResetNotice(true);
    setTimeout(() => setCodeResetNotice(false), 2000);
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {codeResetNotice && (
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#10b981' }}>
                Code reset!
              </span>
            )}
            <select
              style={styles.selectText}
              value={general.inviteCodes}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'Reset') {
                  setGeneral({ ...general, inviteCodes: 'Turned on' });
                  triggerResetCode();
                } else {
                  setGeneral({ ...general, inviteCodes: val });
                }
              }}
            >
              <option style={styles.option} value="Turned on">Turned on</option>
              <option style={styles.option} value="Turned off">Turned off</option>
              <option style={styles.option} value="Reset">Reset</option>
            </select>
          </div>
        </div>

        <div style={{ ...styles.rowItem, opacity: isInviteOff ? 0.5 : 1 }}>
          <div style={styles.rowLabel}>Invite link</div>
          <div style={styles.rowActionGroup}>
            <span style={styles.rowValue}>
              {isInviteOff ? 'Disabled' : inviteLink}
            </span>
            {!isInviteOff && (
              <button
                type="button"
                onClick={handleCopyInviteLink}
                title={copiedLink ? 'Copied invite link!' : 'Copy invite link'}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px',
                  color: copiedLink ? '#10b981' : undefined,
                }}
              >
                {copiedLink ? <Check size={16} color="#10b981" /> : <Copy size={18} style={styles.actionIcon} />}
              </button>
            )}
          </div>
        </div>

        <div style={{ ...styles.rowItem, opacity: isInviteOff ? 0.5 : 1 }}>
          <div style={styles.rowLabel}>Class code</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ ...styles.rowValue, fontFamily: 'monospace', fontWeight: '800', color: isInviteOff ? '#9ca3af' : '#10b981', letterSpacing: '0.05em' }}>
              {isInviteOff ? 'Turned off' : (classCode || '...')}
            </div>
            {!isInviteOff && (
              <>
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
                  {copiedCode ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                </button>
                <button
                  type="button"
                  onClick={triggerResetCode}
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
              </>
            )}
          </div>
        </div>

        <div style={{ ...styles.rowItem, opacity: isInviteOff ? 0.5 : 1 }}>
          <div style={styles.rowLabel}>Class view</div>
          <button
            type="button"
            disabled={isInviteOff}
            onClick={() => !isInviteOff && setShowLargeCodeModal(true)}
            style={{
              ...styles.rowActionGroup,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: isInviteOff ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span style={styles.linkText}>Display class code</span>
            <Maximize size={18} style={{ ...styles.actionIcon, color: isDark ? '#60a5fa' : '#1a73e8' }} />
          </button>
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

      {showLargeCodeModal && (
        <div
          onClick={() => setShowLargeCodeModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            zIndex: 10050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
              border: isDark ? '1px solid #333333' : '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '28px',
              textAlign: 'center',
              boxShadow: '0 25px 50px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: isDark ? '#f3f4f6' : '#1e293b' }}>
                Class code
              </span>
              <button
                type="button"
                onClick={() => setShowLargeCodeModal(false)}
                style={{ background: 'none', border: 'none', color: isDark ? '#9ca3af' : '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            <div
              style={{
                fontSize: '3.2rem',
                fontWeight: '900',
                letterSpacing: '0.08em',
                color: '#10b981',
                padding: '22px 0',
                fontFamily: 'monospace',
                userSelect: 'all',
              }}
            >
              {classCode || '...'}
            </div>
            <p style={{ color: isDark ? '#9ca3af' : '#64748b', fontSize: '0.88rem', margin: '0 0 22px 0' }}>
              Students can enter this code to join {formData.name || classroom?.name || 'this class'}.
            </p>
            <button
              type="button"
              onClick={handleCopyCode}
              style={{
                backgroundColor: copiedCode ? '#059669' : '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 20px',
                fontWeight: '700',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {copiedCode ? <Check size={17} /> : <Copy size={17} />}
              {copiedCode ? 'Copied Code!' : 'Copy Code'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
