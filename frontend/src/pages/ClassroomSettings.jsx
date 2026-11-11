import React, { useState } from 'react';
import { X } from 'lucide-react';
import { generateClassCode } from '../utils/classroomList';
import { useDarkMode } from '../hooks/useDarkMode';
import { getStyles } from './classroomSettingsStyles';
import ClassDetailsSection from '../components/classroom/settings/ClassDetailsSection';
import ClassGeneralSection from '../components/classroom/settings/ClassGeneralSection';
import ClassGradingSection from '../components/classroom/settings/ClassGradingSection';

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

  const [general, setGeneral] = useState({
    inviteCodes: 'Turned on',
    stream: 'Students can post and comment',
    classworkStream: 'Show condensed notifications',
    showDeleted: false,
  });

  const [grading, setGrading] = useState({
    autoDraftGrade: true,
    defaultGrade: 0,
    overallCalculation: 'No overall grade',
    showOverallToStudents: false,
  });

  const [copiedCode, setCopiedCode] = useState(false);

  const handleRegenerateCode = () => {
    const newCode = generateClassCode();
    setFormData((prev) => ({ ...prev, code: newCode }));
  };

  const handleCopyCode = () => {
    const currentCode = formData.code || classroom?.code || '';
    if (currentCode) {
      navigator.clipboard.writeText(currentCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate({
        ...(classroom || {}),
        ...formData,
      });
    }
    onClose();
  };

  return (
    <div
      style={styles.container}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={styles.modalBox}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <button onClick={onClose} style={styles.iconButton} title="Close">
              <X size={24} />
            </button>
            <span style={styles.headerTitle}>Class settings</span>
          </div>
          {role !== 'student' && (
            <button onClick={handleSave} style={styles.saveButton}>
              Save
            </button>
          )}
        </div>

        {/* Modal Scroll Content */}
        <div style={styles.scrollArea}>
          <div style={styles.content}>
            <ClassDetailsSection
              formData={formData}
              setFormData={setFormData}
              role={role}
              styles={styles}
            />

            {role !== 'student' && (
              <>
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

                <ClassGradingSection
                  grading={grading}
                  setGrading={setGrading}
                  isDark={isDark}
                  styles={styles}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
