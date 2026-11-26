import JoditEditor from 'jodit-react';
import { X, Link2, Image, Video, FileText, Lock, Unlock } from 'lucide-react';
import AttachmentCard from '../AttachmentCard';

/**
 * Create / Modify modal for teacher activities and learning materials, including
 * Jodit rich instructions, file/link attachments, lockdown toggles, and test cases.
 */
export default function TeacherActivityFormModal({
  isOpen,
  onClose,
  isDark,
  styles,
  editingId,
  form,
  setForm,
  handleSubmit,
  handleAttachmentClick,
  handleAddLink,
  imageInputRef,
  videoInputRef,
  docInputRef,
  handleFilePicked,
  handleDropCapture,
  handlePasteCapture,
  joditRef,
  joditConfig,
  uploading,
  removeAttachment,
  onPreviewImage,
  onPreviewVideo,
  onPreviewIframe
}) {
  if (!isOpen) return null;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <h2 style={{ margin: 0, color: isDark ? '#E8EAED' : '#1f2937' }}>{editingId ? `Modify ${form.activityType}` : `Create ${form.activityType}`}</h2>
          <button onClick={onClose} style={styles.closeModalBtn}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.fieldLabel}>Title</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={styles.input}
          />

          {form.activityType !== 'Material' && (
            <>
              <div style={styles.labelRow}>
                <label style={styles.fieldLabel}>Due Date</label>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.noDueDate}
                    onChange={(e) => setForm({ ...form, noDueDate: e.target.checked })}
                  />
                  No Due Date
                </label>
              </div>
              <input
                type="date"
                disabled={form.noDueDate}
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                style={{ ...styles.input, opacity: form.noDueDate ? 0.5 : 1 }}
              />
            </>
          )}

          <div style={styles.labelRow}>
            <label style={styles.fieldLabel}>Instruction</label>
            <div style={styles.attachIcons}>
              <Link2 size={18} style={styles.attachIcon} title="Add link (Ctrl+K)" onMouseDown={(e) => handleAttachmentClick(e, handleAddLink)} />
              <Image size={18} style={styles.attachIcon} title="Upload image" onMouseDown={(e) => handleAttachmentClick(e, () => imageInputRef.current?.click())} />
              <Video size={18} style={styles.attachIcon} title="Upload video" onMouseDown={(e) => handleAttachmentClick(e, () => videoInputRef.current?.click())} />
              <FileText size={18} style={styles.attachIcon} title="Upload document (PDF, DOC)" onMouseDown={(e) => handleAttachmentClick(e, () => docInputRef.current?.click())} />
            </div>
          </div>
          <div onDragOverCapture={(e) => e.preventDefault()} onDropCapture={handleDropCapture} onPasteCapture={handlePasteCapture}>
            <JoditEditor
              ref={joditRef}
              value={form.instruction}
              config={joditConfig}
              onBlur={newContent => setForm(prev => ({ ...prev, instruction: newContent }))}
            />
          </div>

          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFilePicked(e, 'image')} />
          <input ref={videoInputRef} type="file" accept="video/*,.mp4,.webm,.mov,.m4v,.mkv" style={{ display: 'none' }} onChange={(e) => handleFilePicked(e, 'video')} />
          <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={(e) => handleFilePicked(e, 'document')} />

          {uploading && <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Uploading…</span>}

          {form.attachments?.length > 0 && (
            <div style={styles.attachmentList}>
              {form.attachments.map((att, i) => (
                <AttachmentCard
                  key={i}
                  att={att}
                  isDark={isDark}
                  onRemove={() => removeAttachment(i)}
                  onClick={(clickedAtt) => {
                    const targetName = (clickedAtt.name || clickedAtt.url || '').toLowerCase();
                    const isImg = clickedAtt.type === 'image' || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(targetName);
                    const isVid = clickedAtt.type === 'video' || /\.(mp4|webm|mov|m4v|mkv|avi)(\?.*)?$/i.test(targetName);
                    if (isImg) onPreviewImage(clickedAtt);
                    else if (isVid) onPreviewVideo(clickedAtt);
                    else onPreviewIframe(clickedAtt);
                  }}
                />
              ))}
            </div>
          )}

          {form.activityType !== 'Material' && (
            <>
              <label style={styles.fieldLabel}>Points</label>
              <select
                value={form.points}
                onChange={(e) => setForm({ ...form, points: e.target.value })}
                style={{ ...styles.input, width: '120px' }}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                <div>
                  <label style={styles.fieldLabel}>Time Limit (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 60 })}
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={styles.fieldLabel}>Auto-Save Interval</label>
                  <select
                    value={form.autoSaveInterval}
                    onChange={(e) => setForm({ ...form, autoSaveInterval: e.target.value })}
                    style={styles.input}
                  >
                    <option value="10s">10 Seconds</option>
                    <option value="30s">30 Seconds</option>
                    <option value="1m">1 Minute</option>
                  </select>
                </div>
              </div>
              <div style={{ ...styles.labelRow, marginTop: '5px', marginBottom: '6px' }}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.treatWarningsAsErrors}
                    onChange={(e) => setForm({ ...form, treatWarningsAsErrors: e.target.checked })}
                  />
                  Treat compiler warnings as errors
                </label>
              </div>
              <div
                onClick={() => setForm({ ...form, disableBack: !form.disableBack })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  backgroundColor: form.disableBack
                    ? (isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5')
                    : (isDark ? '#232323' : '#f8fafc'),
                  border: form.disableBack
                    ? '1px solid #10b981'
                    : (isDark ? '1px solid #383838' : '1px solid #e2e8f0'),
                  transition: 'all 0.2s ease',
                  marginTop: '6px',
                  marginBottom: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: form.disableBack ? '#10b981' : (isDark ? '#333' : '#e2e8f0'),
                    color: form.disableBack ? '#ffffff' : (isDark ? '#9ca3af' : '#64748b'),
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}>
                    {form.disableBack ? <Lock size={16} /> : <Unlock size={16} />}
                  </div>
                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: form.disableBack
                        ? (isDark ? '#a7f3d0' : '#065f46')
                        : (isDark ? '#E8EAED' : '#1e293b')
                    }}>
                      Strict Lockdown: Disable Student Back Navigation
                    </div>
                    <div style={{ fontSize: '0.74rem', color: isDark ? '#9ca3af' : '#64748b', marginTop: '2px' }}>
                      Students cannot leave workspace until they submit; unsubmitting is locked.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  aria-pressed={!!form.disableBack}
                  onClick={(e) => {
                    e.stopPropagation();
                    setForm({ ...form, disableBack: !form.disableBack });
                  }}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: form.disableBack ? '#10b981' : (isDark ? '#404040' : '#cbd5e1'),
                    position: 'relative',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    transition: 'background-color 0.2s ease',
                    outline: 'none',
                    flexShrink: 0
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      transform: form.disableBack ? 'translateX(20px)' : 'translateX(0)',
                      transition: 'transform 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }}
                  />
                </button>
              </div>

              <div style={{ marginTop: '12px', marginBottom: '14px', padding: '12px', backgroundColor: isDark ? '#262626' : '#f8fafc', borderRadius: '8px', border: isDark ? '1px solid #3c3c3c' : '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isDark ? '#E8EAED' : '#1e293b' }}>Automated Test Cases (Optional)</span>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#64748b' }}>Pre-configured test cases for students to validate their code against.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const list = Array.isArray(form.testCases) ? [...form.testCases] : [];
                      list.push({ id: `tc-${Date.now()}`, name: `Case ${list.length + 1}`, input: '', expectedOutput: '' });
                      setForm({ ...form, testCases: list });
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
                      border: '1px solid #10b981',
                      borderRadius: '5px',
                      color: isDark ? '#6ee7b7' : '#059669',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    + Add Test Case
                  </button>
                </div>

                {Array.isArray(form.testCases) && form.testCases.map((tc, idx) => (
                  <div key={tc.id || idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                    <input
                      type="text"
                      placeholder="Expected Output (stdout)"
                      value={tc.expectedOutput || ''}
                      onChange={(e) => {
                        const list = [...form.testCases];
                        list[idx] = { ...list[idx], expectedOutput: e.target.value };
                        setForm({ ...form, testCases: list });
                      }}
                      style={{ ...styles.input, flex: 1, margin: 0, fontSize: '0.82rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const list = form.testCases.filter((_, i) => i !== idx);
                        setForm({ ...form, testCases: list });
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px'
                      }}
                      title="Remove test case"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={styles.bottomRow}>
            {form.activityType !== 'Material' ? (
              <div style={styles.gradingGroup}>
                <span style={styles.fieldLabel}>Grading:</span>
                <label style={styles.radioLabel}>
                  <input type="radio" name="grading" checked={form.grading === 'On'} onChange={() => setForm({ ...form, grading: 'On' })} />
                  On
                </label>
                <label style={styles.radioLabel}>
                  <input type="radio" name="grading" checked={form.grading === 'Off'} onChange={() => setForm({ ...form, grading: 'Off' })} />
                  Off
                </label>
              </div>
            ) : <div />}
            <button type="submit" style={styles.assignBtn}>{editingId ? 'Save' : 'Assign'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
