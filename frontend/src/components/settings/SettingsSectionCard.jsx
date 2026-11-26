import { Moon, Sun, CheckCircle2 } from 'lucide-react';
import ProfilePictureChanger from './ProfilePictureChanger';
import CheckUpdateField from './CheckUpdateField';
import { styles } from '../../pages/settingsStyles';

export default function SettingsSectionCard({
  section,
  isDark,
  role,
  values,
  setValues,
  currentUser,
  savedSection,
  onSave,
  toggleDarkMode,
  onOpenEmailModal,
  onOpenPasswordModal
}) {
  const SectionIcon = section.icon;
  const isAppearance = section.title === 'Appearance & Display';
  const isProfile = section.title === 'Profile Picture';
  const isUpdate = section.title === 'Check for Updates';

  return (
    <div
      style={{
        ...styles.sectionCard,
        ...(isDark ? {
          backgroundColor: '#323232',
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
          border: '1px solid #4A4A4A'
        } : {})
      }}
    >
      <div style={styles.sectionHead}>
        <div
          style={{
            ...styles.sectionIconCircle,
            ...(isDark ? {
              backgroundColor: '#3C3C3C',
              boxShadow: 'none',
              border: '1px solid #4E4E4E'
            } : {})
          }}
        >
          <SectionIcon size={22} color={isDark ? '#10b981' : '#4b5563'} />
        </div>
        <div>
          <h3 style={{ ...styles.sectionTitle, ...(isDark ? { color: '#E8EAED' } : {}) }}>{section.title}</h3>
          <p style={{ ...styles.sectionBlurb, ...(isDark ? { color: '#9AA0A6' } : {}) }}>{section.blurb}</p>
        </div>
      </div>

      <div style={styles.fields}>
        {/* Profile Picture Changer right at the top of Profile Picture section */}
        {isProfile && (
          <ProfilePictureChanger
            isDark={isDark}
            avatar={values['Profile Picture:Avatar']}
            onAvatarChange={(av) => setValues(prev => ({ ...prev, 'Profile Picture:Avatar': av }))}
          />
        )}

        {section.fields.map((f) => {
          const key = `${section.title}:${f.label}`;

          if (f.type === 'check_update') {
            return (
              <CheckUpdateField
                key={f.label}
                isDark={isDark}
                role={role}
              />
            );
          }

          if (f.type === 'dark_toggle') {
            return (
              <div
                key={f.label}
                style={{
                  ...styles.toggleRow,
                  gridColumn: '1 / -1',
                  ...(isDark ? {
                    backgroundColor: '#3A3A3A',
                    borderColor: '#4D4D4D'
                  } : {})
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {isDark ? <Moon size={22} color="#10b981" /> : <Sun size={22} color="#f59e0b" />}
                  <div>
                    <span style={{ ...styles.toggleLabel, display: 'block', ...(isDark ? { color: '#E8EAED' } : {}) }}>
                      {isDark ? 'Dark Mode (Enabled)' : 'Dark Mode (Disabled)'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: isDark ? '#9AA0A6' : '#64748b', display: 'block', marginTop: '2px' }}>
                      {isDark ? 'Workspace and dashboard use a sleek dark theme' : 'Workspace and dashboard use a clean light theme'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isDark}
                  onClick={toggleDarkMode}
                  style={{
                    ...styles.switch,
                    backgroundColor: isDark ? '#10b981' : '#cbd5e1',
                    transition: 'background-color 0.25s ease'
                  }}
                  title="Toggle Dark Mode"
                >
                  <span
                    style={{
                      ...styles.knob,
                      left: isDark ? '23px' : '3px',
                      transition: 'left 0.25s ease'
                    }}
                  />
                </button>
              </div>
            );
          }

          if (f.type === 'toggle') {
            const on = key in values ? values[key] : !!f.default;
            return (
              <div
                key={f.label}
                style={{
                  ...styles.toggleRow,
                  ...(isDark ? {
                    backgroundColor: '#3A3A3A',
                    borderColor: '#4D4D4D'
                  } : {})
                }}
              >
                <span style={{ ...styles.toggleLabel, ...(isDark ? { color: '#E8EAED' } : {}) }}>{f.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => setValues({ ...values, [key]: !on })}
                  style={{
                    ...styles.switch,
                    backgroundColor: on ? '#10b981' : (isDark ? '#525252' : '#cbd5e1'),
                    transition: 'background-color 0.2s'
                  }}
                  title={on ? 'On' : 'Off'}
                >
                  <span style={{ ...styles.knob, ...(on ? styles.knobOn : {}) }} />
                </button>
              </div>
            );
          }

          if (f.type === 'email_with_change' || f.type === 'password_with_change') {
            const isEmail = f.type === 'email_with_change';
            const displayValue = isEmail ? (values[key] || currentUser?.email || '') : '••••••••••••';
            return (
              <label
                key={f.label}
                style={{
                  ...styles.fieldLabel,
                  ...(isDark ? { color: '#E8EAED' } : {})
                }}
              >
                {f.label}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                  <input
                    type={isEmail ? 'email' : 'password'}
                    placeholder={f.placeholder}
                    value={displayValue}
                    disabled
                    readOnly
                    style={{
                      ...styles.input,
                      flex: 1,
                      opacity: 0.7,
                      cursor: 'default',
                      backgroundColor: isDark ? '#2A2A2A' : '#f3f4f6',
                      ...(isDark ? {
                        borderColor: '#4D4D4D',
                        color: '#E8EAED'
                      } : {})
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (isEmail) onOpenEmailModal();
                      else onOpenPasswordModal();
                    }}
                    style={{
                      padding: '0 18px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? '#4A4A4A' : '#e5e7eb',
                      color: isDark ? '#E8EAED' : '#475569',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    Change
                  </button>
                </div>
              </label>
            );
          }

          return (
            <label
              key={f.label}
              style={{
                ...styles.fieldLabel,
                ...(isDark ? { color: '#E8EAED' } : {})
              }}
            >
              {f.label}
              <input
                type={f.type === 'password' ? 'password' : f.type === 'file' ? 'file' : 'text'}
                placeholder={f.placeholder}
                value={f.type === 'file' ? undefined : (values[key] || '')}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                style={{
                  ...styles.input,
                  ...(isDark ? {
                    backgroundColor: '#3A3A3A',
                    borderColor: '#4D4D4D',
                    color: '#E8EAED'
                  } : {})
                }}
              />
            </label>
          );
        })}
      </div>

      {!isAppearance && !isUpdate && (
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.saveBtn}
            onClick={() => onSave(section.title)}
            title="Save Changes"
          >
            Save Changes
          </button>
          {savedSection === section.title && (
            <span style={{ ...styles.savedNote, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} color='#16a34a' />
              <span>Saved</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

