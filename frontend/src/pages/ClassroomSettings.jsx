import React, { useState } from 'react';
import { X, Copy, Maximize, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { generateClassCode } from '../utils/classroomUtils';
import { useDarkMode } from '../hooks/useDarkMode';

export default function ClassroomSettings({ classroom, onClose, onUpdate, role = 'teacher' }) {
  const { isDark } = useDarkMode();
  const styles = getStyles(isDark);

  const [formData, setFormData] = useState({
    name: classroom.name || '',
    description: classroom.description || '',
    section: classroom.section || '',
    subject: classroom.subject || '',
    code: classroom.code || ''
  });

  const [general, setGeneral] = useState({
    inviteCodes: 'Turned on',
    stream: 'Students can post and comment',
    classworkStream: 'Show condensed notifications',
    showDeleted: false
  });

  const [grading, setGrading] = useState({
    autoDraftGrade: true,
    defaultGrade: 0,
    overallCalculation: 'No overall grade',
    showOverallToStudents: false
  });

  const [copiedCode, setCopiedCode] = useState(false);

  const handleRegenerateCode = () => {
    const newCode = generateClassCode();
    setFormData(prev => ({ ...prev, code: newCode }));
  };

  const handleCopyCode = () => {
    const currentCode = formData.code || classroom.code || '';
    if (currentCode) {
      navigator.clipboard.writeText(currentCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate({
        ...classroom,
        ...formData
      });
    }
    onClose();
  };

  return (
    <div style={styles.container} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.modalBox}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <button onClick={onClose} style={styles.iconButton} title="Close">
              <X size={24} />
            </button>
            <span style={styles.headerTitle}>Class settings</span>
          </div>
          {role !== 'student' && (
            <button onClick={handleSave} style={styles.saveButton}>Save</button>
          )}
        </div>

        <div style={styles.scrollArea}>
          <div style={styles.content}>

            {/* CLASS DETAILS */}
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Class Details</h2>
              
              <div style={styles.inputGroup}>
                <div style={styles.inputWrapper}>
                  <label style={styles.floatingLabel}>Class name (required)</label>
                  <input 
                    style={styles.input} 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    readOnly={role === 'student'}
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <div style={styles.inputWrapper}>
                  <label style={styles.floatingLabel}>Class description</label>
                  <input 
                    style={styles.input} 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    readOnly={role === 'student'}
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <div style={styles.inputWrapper}>
                  <label style={styles.floatingLabel}>Section</label>
                  <input 
                    style={styles.input} 
                    value={formData.section} 
                    onChange={e => setFormData({...formData, section: e.target.value})} 
                    readOnly={role === 'student'}
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <div style={styles.inputWrapper}>
                  <label style={styles.floatingLabel}>Subject</label>
                  <input 
                    style={styles.input} 
                    value={formData.subject} 
                    onChange={e => setFormData({...formData, subject: e.target.value})} 
                    readOnly={role === 'student'}
                  />
                </div>
              </div>
            </div>

            {/* GENERAL */}
            {role !== 'student' && (
              <>
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
                        onChange={e => {
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
                        <span style={styles.rowValue}>https://verity.app/join/{formData.code || classroom.code || ''}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`https://verity.app/join/${formData.code || classroom.code || ''}`);
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
                          {formData.code || classroom.code || '...'}
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: copiedCode ? '#10b981' : (isDark ? '#9ca3af' : '#64748b') }}
                          title={copiedCode ? 'Copied!' : 'Copy class code'}
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={handleRegenerateCode}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: isDark ? '#9ca3af' : '#64748b' }}
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
                        onChange={e => setGeneral({...general, stream: e.target.value})}
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
                        onChange={e => setGeneral({...general, classworkStream: e.target.value})}
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
                        <input type="checkbox" checked={general.showDeleted} onChange={e => setGeneral({...general, showDeleted: e.target.checked})} style={styles.toggleInput} />
                        <div style={general.showDeleted ? styles.toggleSliderActive : styles.toggleSlider}>
                          <div style={general.showDeleted ? styles.toggleCircleActive : styles.toggleCircle}></div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* GRADING */}
                <div style={styles.card}>
                  <h2 style={styles.sectionTitle}>Grading</h2>

                  <div style={styles.subSection}>
                    <h3 style={styles.subSectionTitle}>Draft grade for missing assignments</h3>
                    <p style={styles.paragraph}>When a student hasn't turned in their submission by the due date, or you have marked the submission as missing, it will automatically receive a draft grade. Students won't see this grade until you return it.</p>
                    
                    <div style={styles.rowItem}>
                      <div style={styles.rowLabel}>Automatically apply a draft grade to Missing assignments</div>
                      <label style={styles.toggleSwitch}>
                        <input type="checkbox" checked={grading.autoDraftGrade} onChange={e => setGrading({...grading, autoDraftGrade: e.target.checked})} style={styles.toggleInput} />
                        <div style={grading.autoDraftGrade ? styles.toggleSliderActive : styles.toggleSlider}>
                          <div style={grading.autoDraftGrade ? styles.toggleCircleActive : styles.toggleCircle}></div>
                        </div>
                      </label>
                    </div>

                    {grading.autoDraftGrade && (
                      <div style={{ ...styles.inputWrapper, width: '150px', marginTop: '15px' }}>
                        <label style={styles.floatingLabel}>Default grade</label>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <input 
                            type="number"
                            style={{ ...styles.input, borderBottom: 'none' }} 
                            value={grading.defaultGrade} 
                            onChange={e => setGrading({...grading, defaultGrade: e.target.value})} 
                          />
                          <span style={{ paddingRight: '15px', color: isDark ? '#9ca3af' : '#5f6368' }}>%</span>
                        </div>
                        <div style={{ height: '2px', backgroundColor: isDark ? '#10b981' : '#1a73e8', width: '100%' }}></div>
                      </div>
                    )}
                  </div>

                  <div style={styles.divider} />

                  <div style={styles.subSection}>
                    <h3 style={styles.subSectionTitle}>Grade calculation</h3>
                    
                    <div style={styles.rowItem}>
                      <div>
                        <div style={styles.rowLabel}>Overall grade calculation</div>
                        <div style={styles.rowDesc}>Choose a grading system. <span style={styles.linkText}>Learn more</span></div>
                      </div>
                      <select 
                        style={styles.selectBox}
                        value={grading.overallCalculation}
                        onChange={e => setGrading({...grading, overallCalculation: e.target.value})}
                      >
                        <option style={styles.option}>No overall grade</option>
                        <option style={styles.option}>Total points</option>
                        <option style={styles.option}>Weighted by category</option>
                      </select>
                    </div>

                    <div style={styles.rowItem}>
                      <div style={styles.rowLabel}>Show overall grade to students</div>
                      <label style={styles.toggleSwitch}>
                        <input type="checkbox" checked={grading.showOverallToStudents} onChange={e => setGrading({...grading, showOverallToStudents: e.target.checked})} style={styles.toggleInput} disabled={grading.overallCalculation === 'No overall grade'} />
                        <div style={grading.showOverallToStudents ? styles.toggleSliderActive : (grading.overallCalculation === 'No overall grade' ? styles.toggleSliderDisabled : styles.toggleSlider)}>
                          <div style={grading.showOverallToStudents ? styles.toggleCircleActive : styles.toggleCircle}></div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div style={styles.divider} />

                  <div style={styles.subSection}>
                    <h3 style={styles.subSectionTitle}>Grade categories</h3>
                    <div style={{ ...styles.linkText, marginTop: '10px', fontSize: '0.9rem', fontWeight: '500' }}>Add grade category</div>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

const getStyles = (isDark) => ({
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(6px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial, Helvetica, sans-serif',
    padding: '20px',
  },
  modalBox: {
    width: '100%',
    maxWidth: '820px',
    maxHeight: '90vh',
    backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: isDark 
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)' 
      : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: isDark ? '1px solid #333333' : '1px solid #e0e0e0',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
  },
  header: {
    height: '64px',
    backgroundColor: isDark ? '#262626' : '#ffffff',
    borderBottom: isDark ? '1px solid #333333' : '1px solid #e0e0e0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  iconButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: isDark ? '#9ca3af' : '#5f6368',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    borderRadius: '50%',
    transition: 'background-color 0.2s, color 0.2s',
  },
  headerTitle: {
    fontSize: '1.25rem',
    color: isDark ? '#f3f4f6' : '#3c4043',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    fontWeight: '600',
    fontSize: '0.875rem',
    padding: '8px 22px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.15s, opacity 0.15s',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px 20px',
    backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
  },
  content: {
    maxWidth: '780px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  card: {
    backgroundColor: isDark ? '#262626' : '#ffffff',
    borderRadius: '12px',
    border: isDark ? '1px solid #333333' : '1px solid #dadce0',
    padding: '28px',
    boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: '500',
    color: isDark ? '#f3f4f6' : '#202124',
    margin: '0 0 20px 0',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  inputWrapper: {
    backgroundColor: isDark ? '#333333' : '#f1f3f4',
    borderRadius: '6px 6px 0 0',
    borderBottom: isDark ? '2px solid #10b981' : '1px solid #5f6368',
    padding: '8px 16px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'background-color 0.2s, border-color 0.2s',
  },
  floatingLabel: {
    fontSize: '0.75rem',
    color: isDark ? '#9ca3af' : '#5f6368',
    marginBottom: '2px',
  },
  input: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '0.95rem',
    color: isDark ? '#e8eaed' : '#202124',
    width: '100%',
    padding: '4px 0',
  },
  subSection: {
    marginBottom: '16px',
  },
  subSectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '500',
    color: isDark ? '#f3f4f6' : '#202124',
    margin: '0 0 16px 0',
  },
  paragraph: {
    fontSize: '0.875rem',
    color: isDark ? '#9ca3af' : '#5f6368',
    lineHeight: '1.5',
    marginBottom: '20px',
  },
  rowItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    minHeight: '48px',
  },
  rowLabel: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: isDark ? '#e8eaed' : '#3c4043',
  },
  rowDesc: {
    fontSize: '0.75rem',
    color: isDark ? '#9ca3af' : '#5f6368',
    marginTop: '4px',
  },
  rowValue: {
    fontSize: '0.875rem',
    color: isDark ? '#d1d5db' : '#5f6368',
  },
  rowActionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  actionIcon: {
    color: isDark ? '#9ca3af' : '#5f6368',
    cursor: 'pointer',
  },
  linkText: {
    color: isDark ? '#60a5fa' : '#1a73e8',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  selectText: {
    color: isDark ? '#60a5fa' : '#1a73e8',
    backgroundColor: isDark ? '#262626' : 'transparent',
    border: isDark ? '1px solid #404040' : 'none',
    borderRadius: '4px',
    padding: isDark ? '4px 8px' : '0',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    outline: 'none',
  },
  selectBox: {
    backgroundColor: isDark ? '#333333' : '#f1f3f4',
    border: isDark ? '1px solid #4b5563' : '1px solid #dadce0',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '0.875rem',
    color: isDark ? '#e8eaed' : '#3c4043',
    outline: 'none',
    cursor: 'pointer',
    minWidth: '200px',
  },
  option: {
    backgroundColor: isDark ? '#262626' : '#ffffff',
    color: isDark ? '#e8eaed' : '#202124',
  },
  divider: {
    height: '1px',
    backgroundColor: isDark ? '#333333' : '#e0e0e0',
    margin: '20px 0',
  },
  toggleSwitch: {
    position: 'relative',
    display: 'inline-block',
    width: '36px',
    height: '20px',
  },
  toggleInput: {
    opacity: 0,
    width: 0,
    height: 0,
  },
  toggleSlider: {
    position: 'absolute',
    cursor: 'pointer',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: isDark ? '#4b5563' : '#b9b9b9',
    transition: '.3s',
    borderRadius: '24px',
  },
  toggleSliderActive: {
    position: 'absolute',
    cursor: 'pointer',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#10b981',
    transition: '.3s',
    borderRadius: '24px',
  },
  toggleSliderDisabled: {
    position: 'absolute',
    cursor: 'not-allowed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: isDark ? '#374151' : '#e0e0e0',
    transition: '.3s',
    borderRadius: '24px',
  },
  toggleCircle: {
    position: 'absolute',
    height: '14px',
    width: '14px',
    left: '3px',
    bottom: '3px',
    backgroundColor: 'white',
    transition: '.3s',
    borderRadius: '50%',
  },
  toggleCircleActive: {
    position: 'absolute',
    height: '14px',
    width: '14px',
    left: '3px',
    bottom: '3px',
    backgroundColor: 'white',
    transition: '.3s',
    borderRadius: '50%',
    transform: 'translateX(16px)',
  },
});
