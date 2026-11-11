import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useCurrentUser } from '../hooks/useCurrentUser';
import Skeleton from '../components/Skeleton';
import ChangeEmailModal from '../components/ChangeEmailModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { migrateUserClassroomsOnEmailChange } from '../data/classroomCache';
import { SECTIONS } from '../data/settingsConstants';
import SettingsSectionCard from '../components/settings/SettingsSectionCard';
import { styles } from './settingsStyles';

export default function SettingsPanel({ role = 'Student', onBack, loading = false }) {
  const sections = SECTIONS[role] || SECTIONS.Student;
  const STORAGE_KEY = `verity:settings:${role}`;
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const { currentUser, updateCurrentUser } = useCurrentUser();

  const [values, setValues] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      const user = currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (user?.name) {
        const nameParts = user.name.split(' ');
        parsed['User Details:First Name'] = nameParts[0];
        parsed['User Details:Last Name'] = nameParts.slice(1).join(' ');
      }
      if (user?.email) {
        parsed['User Details:Email Address'] = user.email;
      }
      parsed['Profile Picture:Avatar'] = user?.avatar || user?.profilePicture || null;
      return parsed;
    } catch {
      return {};
    }
  });

  const [savedSection, setSavedSection] = useState(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [securityNotice, setSecurityNotice] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    setValues(prev => {
      const updated = { ...prev };
      if (currentUser.name) {
        const nameParts = currentUser.name.split(' ');
        updated['User Details:First Name'] = nameParts[0];
        updated['User Details:Last Name'] = nameParts.slice(1).join(' ');
      }
      if (currentUser.email) updated['User Details:Email Address'] = currentUser.email;
      const storedAvatar = currentUser.avatar || currentUser.profilePicture || null;
      if (prev['Profile Picture:Avatar'] === undefined || prev['Profile Picture:Avatar'] === null) {
        updated['Profile Picture:Avatar'] = storedAvatar;
      }
      return updated;
    });
  }, [currentUser]);

  const handleSave = async (sectionTitle) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      if (sectionTitle === 'User Details') {
        const firstVal = values[`${sectionTitle}:First Name`];
        const lastVal = values[`${sectionTitle}:Last Name`];
        const payload = {};
        const fullName = [firstVal, lastVal].filter(Boolean).join(' ');
        if (fullName.trim()) payload.name = fullName.trim();
        if (Object.keys(payload).length > 0) {
          await updateCurrentUser(payload);
        }
      } else if (sectionTitle === 'Profile Picture') {
        const avatarVal = values[`${sectionTitle}:Avatar`];
        const payload = { avatar: avatarVal !== undefined ? avatarVal : null };
        await updateCurrentUser(payload);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
    setSavedSection(sectionTitle);
    setTimeout(() => {
      setSavedSection((current) => (current === sectionTitle ? null : current));
    }, 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', padding: '0 clamp(15px, 5vw, 50px)', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <h1 style={{ ...styles.title, ...(isDark ? { color: '#E8EAED' } : {}) }}>Settings</h1>
          </div>
        </div>

        {/* Security Notification Banner */}
        {securityNotice && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 18px',
              borderRadius: '12px',
              backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : '#ecfdf5',
              border: '1px solid #34d399',
              color: isDark ? '#34d399' : '#059669',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            <CheckCircle2 size={18} />
            <span>{securityNotice.msg}</span>
          </div>
        )}

        {/* Settings sections */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Skeleton.Settings />
            <Skeleton.Settings />
          </div>
        ) : (
          sections.map((section) => (
            <SettingsSectionCard
              key={section.title}
              section={section}
              isDark={isDark}
              role={role}
              values={values}
              setValues={setValues}
              currentUser={currentUser}
              savedSection={savedSection}
              onSave={handleSave}
              toggleDarkMode={toggleDarkMode}
              onOpenEmailModal={() => setIsEmailModalOpen(true)}
              onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
            />
          ))
        )}
      </div>

      {/* Change Email Modal */}
      <ChangeEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        currentEmail={values['User Details:Email Address'] || currentUser?.email || ''}
        onSuccess={(newEmail, updatedUserData) => {
          const oldEmail = values['User Details:Email Address'] || currentUser?.email || '';
          migrateUserClassroomsOnEmailChange(oldEmail, newEmail, currentUser?.id);

          setValues(prev => {
            const nextVals = {
              ...prev,
              'User Details:Email Address': newEmail
            };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(nextVals));
            } catch (_) {}
            return nextVals;
          });
          updateCurrentUser({ email: newEmail, ...(updatedUserData || {}) });
          setSecurityNotice({
            type: 'success',
            msg: `Email successfully verified and updated to ${newEmail}!`
          });
          setTimeout(() => setSecurityNotice(null), 4000);
        }}
        isDark={isDark}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={(msg) => {
          setSecurityNotice({
            type: 'success',
            msg: msg || 'Password updated successfully!'
          });
          setTimeout(() => setSecurityNotice(null), 4000);
        }}
        isDark={isDark}
      />
    </div>
  );
}
