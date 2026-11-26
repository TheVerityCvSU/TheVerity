import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CreateClassModal({
  isOpen,
  onClose,
  onSubmit,
  isDark = false,
  isSubmitting = false,
  newClass = { name: '', section: '', subject: '' },
  setNewClass = () => {}
}) {
  const [nameFocused, setNameFocused] = useState(false);
  const [sectionFocused, setSectionFocused] = useState(false);
  const [subjectFocused, setSubjectFocused] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            style={{
              backgroundColor: isDark ? '#1e1e1e' : '#fff',
              padding: '32px',
              borderRadius: '24px',
              width: '90%',
              maxWidth: '400px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h2 style={{
              margin: '0 0 24px',
              color: isDark ? '#fff' : '#111827',
              fontSize: '1.5rem',
              fontWeight: 'bold'
            }}>
              Create Class
            </h2>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: isDark ? '#a3a3a3' : '#4b5563'
                }}>
                  Class Name (Required)
                </label>
                <input
                  type="text"
                  value={newClass.name}
                  onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: `2px solid ${nameFocused ? '#10b981' : (isDark ? '#404040' : '#e5e7eb')}`,
                    backgroundColor: isDark ? '#262626' : '#f9fafb',
                    color: isDark ? '#fff' : '#111827',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  placeholder="e.g., AP Computer Science"
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: isDark ? '#a3a3a3' : '#4b5563'
                }}>
                  Section (Optional)
                </label>
                <input
                  type="text"
                  value={newClass.section}
                  onChange={(e) => setNewClass({ ...newClass, section: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: `2px solid ${sectionFocused ? '#10b981' : (isDark ? '#404040' : '#e5e7eb')}`,
                    backgroundColor: isDark ? '#262626' : '#f9fafb',
                    color: isDark ? '#fff' : '#111827',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={() => setSectionFocused(true)}
                  onBlur={() => setSectionFocused(false)}
                  placeholder="e.g., Room 204"
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: isDark ? '#a3a3a3' : '#4b5563'
                }}>
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  value={newClass.subject}
                  onChange={(e) => setNewClass({ ...newClass, subject: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: `2px solid ${subjectFocused ? '#10b981' : (isDark ? '#404040' : '#e5e7eb')}`,
                    backgroundColor: isDark ? '#262626' : '#f9fafb',
                    color: isDark ? '#fff' : '#111827',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={() => setSubjectFocused(true)}
                  onBlur={() => setSubjectFocused(false)}
                  placeholder="e.g., Programming"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: isDark ? '#a3a3a3' : '#6b7280',
                    fontWeight: '600',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.5 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
                    opacity: isSubmitting ? 0.7 : 1,
                    pointerEvents: isSubmitting ? 'none' : 'auto'
                  }}
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

