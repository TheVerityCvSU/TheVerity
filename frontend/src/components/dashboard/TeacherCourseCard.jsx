import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDarkMode } from '../../hooks/useDarkMode';
import { getClassroomTheme } from '../../data/classroomTheme';
import ClassroomBannerIllustration from '../ClassroomBannerIllustration';
import { cardThemes } from '../../data/teacherDashboardConstants';
import CourseCardMenu from './CourseCardMenu';

export default function TeacherCourseCard({
  classroom,
  onClick,
  onSettings,
  onArchive,
  onUnarchive,
  onDelete,
  isArchived,
  index,
  initial,
  animate,
  transition,
  colSpan,
  activeCount = 0
}) {
  const { isDark } = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);
  const isArchivedCard = Boolean(isArchived ?? classroom?.archived);
  const classTheme = (classroom.theme && (classroom.theme.primary || classroom.theme.id))
    ? classroom.theme
    : getClassroomTheme(classroom);
  const theme = cardThemes.find(t => t.id === classTheme?.id) || cardThemes[index % cardThemes.length];
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const finalSpan = isMobile ? 12 : (colSpan || theme.colSpan);

  const handleCopyCode = (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const code = classroom.code || `C${classroom.id}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleDocClick);
    return () => document.removeEventListener('pointerdown', handleDocClick);
  }, [menuOpen]);

  const bgStyle = classTheme?.customImageUrl
    ? {
        background: `linear-gradient(to right, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.5) 50%, rgba(15, 23, 42, 0.25) 100%), url(${classTheme.customImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background: `linear-gradient(135deg, ${classTheme?.primary || theme.primary}, ${classTheme?.secondary || theme.secondary})`,
      };

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition || { type: 'spring', stiffness: 300, damping: 22 }}
      whileHover={{ y: -5, scale: 1.015, boxShadow: '0 20px 35px rgba(0,0,0,0.22)' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(classroom)}
      style={{
        ...bgStyle,
        borderRadius: '20px',
        padding: '24px',
        minHeight: '240px',
        height: '260px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'visible',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        color: theme.textColor,
        gridColumn: `span ${finalSpan}`,
        width: '100%',
        boxSizing: 'border-box',
        opacity: isArchived ? 0.75 : 1
      }}
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
              ? '0 0 0 2.5px #18181b, 0 0 12px #10b981'
              : '0 0 0 2.5px #ffffff, 0 0 12px #10b981',
            animation: 'live-pulse 1.8s infinite',
            zIndex: 40,
            pointerEvents: 'auto'
          }}
        />
      )}

      {/* Background banner illustration layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '20px',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 1
        }}
      >
        {!classTheme?.customImageUrl && (
          <ClassroomBannerIllustration
            themeId={classTheme?.id || theme.id}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 'min(380px, 60%)',
              height: '100%',
              opacity: 0.95
            }}
          />
        )}
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCopyCode}
              title="Click to copy class code"
              style={{
                backgroundColor: theme.pillBg,
                color: theme.pillText,
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backdropFilter: 'blur(6px)',
                transition: 'transform 0.15s ease, background 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <span>{classroom.code || `C${classroom.id}`}</span>
              {copied ? <Check size={12} strokeWidth={2.8} /> : <Copy size={11} strokeWidth={2} />}
            </button>
          </div>

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="Classroom options"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(p => !p); }}
              style={{
                background: 'rgba(0,0,0,0.22)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(6px)',
                transition: 'background 0.2s ease, transform 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.38)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.22)'; }}
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <CourseCardMenu
                isDark={isDark}
                isArchivedCard={isArchivedCard}
                onSettings={onSettings}
                classroom={classroom}
                copied={copied}
                onCopyCode={handleCopyCode}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDelete={onDelete}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>
        <h3
          title={classroom.name}
          style={{
            margin: '12px 0 0',
            fontSize: '1.75rem',
            fontWeight: 'bold',
            lineHeight: 1.2,
            textShadow: theme.textColor === 'white' ? '0 2px 4px rgba(0,0,0,0.5)' : 'none',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word'
          }}
        >
          {classroom.name}
        </h3>
      </div>

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          {isArchived && (
            <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.statusColor, marginBottom: '4px', fontWeight: '700' }}>
              ARCHIVED
            </p>
          )}
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: theme.textColor }}>
            {classroom.section || 'General Section'}
          </p>
        </div>
        {classroom.subject && (
          <span style={{
            fontSize: '0.78rem',
            color: theme.textColor,
            opacity: 0.9,
            backgroundColor: 'rgba(0, 0, 0, 0.22)',
            padding: '3px 8px',
            borderRadius: '8px',
            maxWidth: '140px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {classroom.subject}
          </span>
        )}
      </div>
    </motion.div>
  );
}

