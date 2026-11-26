import { useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../data/api';
import { generateClassCode, normalizeClassroomSettings } from '../utils/classroomList';
import { useDarkMode } from '../hooks/useDarkMode';
import { getStyles } from './classroomSettingsStyles';
import ClassDetailsSection from '../components/classroom/settings/ClassDetailsSection';
import ClassGeneralSection from '../components/classroom/settings/ClassGeneralSection';

export default function ClassroomSettings({ classroom, onClose, onUpdate, role = 'teacher' }) {
  const { isDark } = useDarkMode();
  const styles = getStyles(isDark);

  const [formData, setFormData] = useState({
    name: classroom?.name || '',
    description: classroom?.description || '',
    section: classroom?.section || '',
    subject: classroom?.subject || '',
    code: classroom?.code || '',
  });

  const [general, setGeneral] = useState(() => normalizeClassroomSettings(classroom?.settings));
  const [copiedCode, setCopiedCode] = useState(false);
  const [nameError, setNameError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const settingsSyncKey = `${classroom?.id ?? ''}|${classroom?.name ?? ''}|${classroom?.description ?? ''}|${classroom?.section ?? ''}|${classroom?.subject ?? ''}|${classroom?.code ?? ''}|${typeof classroom?.settings === 'string' ? classroom.settings : JSON.stringify(classroom?.settings || null)}`;
  const [prevSettingsSyncKey, setPrevSettingsSyncKey] = useState(settingsSyncKey);
  if (settingsSyncKey !== prevSettingsSyncKey) {
    setPrevSettingsSyncKey(settingsSyncKey);
    setFormData({
      name: classroom?.name || '',
      description: classroom?.description || '',
      section: classroom?.section || '',
      subject: classroom?.subject || '',
      code: classroom?.code || '',
    });
    setGeneral(normalizeClassroomSettings(classroom?.settings));
    setNameError('');
    setSaveError('');
  }

  const handleRegenerateCode = () => {
    const newCode = generateClassCode(formData.code ? [formData.code] : []);
    setFormData((prev) => ({ ...prev, code: newCode }));
  };

  const handleCopyCode = () => {
    const currentCode = formData.code || classroom?.code || '';
    if (currentCode && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(currentCode).catch(() => {});
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    const trimmedName = String(formData.name || '').trim();
    if (!trimmedName) {
      setNameError('Class name is required.');
      return;
    }

    setNameError('');
    setSaveError('');
    setIsSaving(true);

    const payload = {
      name: trimmedName,
      description: String(formData.description || ''),
      section: String(formData.section || '').trim(),
      subject: String(formData.subject || '').trim(),
      code: String(formData.code || '').trim().toLowerCase(),
      settings: normalizeClassroomSettings(general),
    };

    try {
      const targetId = classroom?.id;
      let savedClassroom = {
        ...(classroom || {}),
        ...payload,
      };

      if (targetId != null) {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/classrooms/${targetId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSaveError(data?.message || 'Failed to save classroom settings.');
          setIsSaving(false);
          return;
        }
        if (data?.classroom) {
          savedClassroom = {
            ...(classroom || {}),
            ...data.classroom,
            settings: normalizeClassroomSettings(data.classroom.settings || payload.settings),
          };
        }
      }

      window.dispatchEvent(new CustomEvent('verity:classroom-updated', {
        detail: { classroom: savedClassroom }
      }));

      if (onUpdate) {
        await onUpdate(savedClassroom);
      }
      onClose();
    } catch {
      // Offline fallback: update local UI state so changes apply offline and sync on reconnect
      const fallbackClassroom = {
        ...(classroom || {}),
        ...payload,
      };
      window.dispatchEvent(new CustomEvent('verity:classroom-updated', {
        detail: { classroom: fallbackClassroom, persisted: false }
      }));
      if (onUpdate) {
        await onUpdate(fallbackClassroom);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={styles.container}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div style={styles.modalBox}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <button onClick={onClose} style={styles.iconButton} title="Close" disabled={isSaving}>
              <X size={24} />
            </button>
            <span style={styles.headerTitle}>Class settings</span>
          </div>
          {role !== 'student' && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                ...styles.saveButton,
                opacity: isSaving ? 0.7 : 1,
                cursor: isSaving ? 'wait' : 'pointer',
              }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>

        {/* Modal Scroll Content */}
        <div style={styles.scrollArea}>
          <div style={styles.content}>
            {saveError && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : '#fef2f2',
                  border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fecaca',
                  color: isDark ? '#fca5a5' : '#b91c1c',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                }}
              >
                {saveError}
              </div>
            )}

            <ClassDetailsSection
              formData={formData}
              setFormData={(next) => {
                if (nameError && String(next.name || '').trim()) setNameError('');
                setFormData(next);
              }}
              nameError={nameError}
              role={role}
              isDark={isDark}
              styles={styles}
            />

            {role !== 'student' && (
              <ClassGeneralSection
                formData={formData}
                classroom={classroom}
                general={general}
                setGeneral={setGeneral}
                handleRegenerateCode={handleRegenerateCode}
                handleCopyCode={handleCopyCode}
                copiedCode={copiedCode}
                isDark={isDark}
                styles={styles}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
