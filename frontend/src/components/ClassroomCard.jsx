import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MoreVertical } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { getClassroomTheme } from '../data/classroomTheme';
import { useClassroomBannerTheme } from './classroomCard/useClassroomBannerTheme';
import ClassroomCardBanner from './classroomCard/ClassroomCardBanner';
import ClassroomCardMenu from './classroomCard/ClassroomCardMenu';

export const getClassroomCardTheme = (cls) => getClassroomTheme(cls);

export default function ClassroomCard({
  classroom,
  onEnter,
  onOpenGrading,
  onArchive,
  onUnarchive,
  onSettings,
  onDelete,
  isArchived = false,
  role = 'Teacher',
  activeCount = 0
}) {
  const { isDark } = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reactive banner theme
  const theme = useClassroomBannerTheme(classroom);

  const handleCopyCode = (e) => {
    e.stopPropagation();
    const code = classroom.code || classroom.section || (classroom.id ? `vji${classroom.id}ku4` : 'vji3bku4');
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setMenuOpen(false);
    }, 1500);
  };

  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.35)' : '0 8px 24px rgba(0,0,0,0.08)' }}
      transition={{ duration: 0.2 }}
      style={{
        backgroundColor: isDark ? '#242424' : '#ffffff',
        borderRadius: '16px',
        border: isDark ? '1px solid #383838' : '1px solid #dadce0',
        overflow: 'visible',
        boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        height: '310px',
        position: 'relative',
        opacity: isArchived ? 0.75 : 1
      }}
      onClick={() => onEnter && onEnter(classroom)}
    >
      {/* Live activity green notification dot */}
      {Number(activeCount) > 0 && (
        <span
          title={`${activeCount} student${Number(activeCount) > 1 ? 's' : ''} currently working on an activity in this classroom`}
          style={{
            position: 'absolute',
            top: '-3px',
            left: '-3px',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: isDark
              ? '0 0 0 2.5px #1e1e1e, 0 0 12px #10b981'
              : '0 0 0 2.5px #ffffff, 0 0 12px #10b981',
            animation: 'live-pulse 1.8s infinite',
            zIndex: 40,
            pointerEvents: 'auto'
          }}
        />
      )}

      {/* Top Banner Header */}
      <ClassroomCardBanner
        classroom={classroom}
        theme={theme}
        role={role}
      />

      {/* Middle Body with Floating Avatar */}
      <div style={{ flex: 1, backgroundColor: isDark ? '#242424' : '#ffffff', padding: '14px 20px', position: 'relative' }}>
        {role === 'Student' && (
          <div
            style={{
              position: 'absolute',
              right: '16px',
              top: '-28px',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: isDark ? '#2c2c2c' : '#ffffff',
              border: isDark ? '3px solid #242424' : '3px solid #ffffff',
              boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.45)' : '0 4px 12px rgba(0,0,0,0.14)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}
            title={classroom.instructor ? `Instructor: ${classroom.instructor}` : 'Instructor'}
          >
            {(classroom.instructorAvatar || classroom.avatar) ? (
              <img
                src={classroom.instructorAvatar || classroom.avatar}
                alt={classroom.instructor || 'Instructor'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '1.25rem'
                }}
              >
                {(classroom.instructor || 'I').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer Action Bar */}
      <div
        style={{
          height: '52px',
          borderBottomLeftRadius: '15px',
          borderBottomRightRadius: '15px',
          borderTop: isDark ? '1px solid #333333' : '1px solid #e2e8f0',
          backgroundColor: isDark ? '#202020' : '#ffffff',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '16px',
          flexShrink: 0,
          position: 'relative'
        }}
      >
        <button
          style={iconButtonStyle}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(prev => !prev);
          }}
          title="More options"
        >
          <MoreVertical size={20} color={isDark ? '#a3a3a3' : '#5f6368'} />
        </button>

        {menuOpen && (
          <ClassroomCardMenu
            classroom={classroom}
            isArchived={isArchived}
            role={role}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            onSettings={onSettings}
            onDelete={onDelete}
            handleCopyCode={handleCopyCode}
            copied={copied}
            setMenuOpen={setMenuOpen}
            isDark={isDark}
          />
        )}
      </div>
    </motion.div>
  );
}

const iconButtonStyle = {
  background: 'none',
  border: 'none',
  padding: '6px',
  borderRadius: '50%',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.15s'
};
