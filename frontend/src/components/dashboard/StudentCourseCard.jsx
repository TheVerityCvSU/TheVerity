import { useState, useRef, useEffect } from 'react';
import { Archive, MoreVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDarkMode } from '../../hooks/useDarkMode';
import { getClassroomTheme } from '../../data/classroomTheme';
import ClassroomBannerIllustration from '../ClassroomBannerIllustration';
import { cardThemes } from '../../data/studentDashboardConstants';
import StudentCourseCardMenu from './StudentCourseCardMenu';

export default function StudentCourseCard({
  classroom,
  onClick,
  index,
  colSpan,
  isArchived = false,
  onArchive,
  onUnarchive
}) {
  const { isDark } = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isArchivedCard = Boolean(isArchived ?? classroom?.archived);
  const classTheme = (classroom.theme && (classroom.theme.primary || classroom.theme.id))
    ? classroom.theme
    : getClassroomTheme(classroom);
  const theme = cardThemes.find(t => t.id === classTheme?.id) || cardThemes[index % cardThemes.length];
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const finalSpan = isMobile ? 12 : (colSpan || theme.colSpan);

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
      whileHover={{ y: -4, scale: 1.01, boxShadow: '0 15px 30px rgba(0,0,0,0.15)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
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
        boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
        color: theme.textColor,
        gridColumn: `span ${finalSpan}`,
        width: '100%',
        boxSizing: 'border-box',
        filter: isArchivedCard ? 'grayscale(55%) saturate(0.6)' : 'none',
        opacity: isArchivedCard ? 0.88 : 1,
        border: isArchivedCard ? '1px dashed rgba(148, 163, 184, 0.6)' : undefined
      }}
    >
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

      {/* Subtle overlay for archived state */}
      {isArchivedCard && (
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '20px',
          backgroundColor: 'rgba(15, 23, 42, 0.42)',
          pointerEvents: 'none',
          zIndex: 2
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0, flex: 1, marginRight: '8px' }}>
            <span style={{
              backgroundColor: isArchivedCard ? 'rgba(255, 255, 255, 0.2)' : theme.pillBg,
              color: isArchivedCard ? '#ffffff' : theme.pillText,
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              backdropFilter: isArchivedCard ? 'blur(6px)' : 'none'
            }}>
              {classroom.code || `C${classroom.id}`}
            </span>
            {isArchivedCard && (
              <span style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(8px)',
                padding: '3px 8px',
                borderRadius: '20px',
                fontSize: '0.7rem',
                fontWeight: '700',
                letterSpacing: '0.04em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Archive size={11} />
                ARCHIVED
              </span>
            )}
            <span style={{ fontSize: '0.85rem', color: theme.textColor, fontWeight: '500', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {classroom.instructor || 'Instructor'}
            </span>
          </div>

          {/* 3-dot Menu */}
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              aria-label="Classroom options"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(p => !p);
              }}
              style={{
                background: 'rgba(0, 0, 0, 0.22)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(6px)',
                transition: 'background 0.2s, transform 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.22)'; }}
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && (
              <StudentCourseCardMenu
                isDark={isDark}
                isArchivedCard={isArchivedCard}
                classroom={classroom}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>
        <h3 style={{
          margin: 0,
          fontSize: '1.75rem',
          fontWeight: 'bold',
          lineHeight: 1.2,
          textShadow: theme.textColor === 'white' ? '0 2px 4px rgba(0,0,0,0.5)' : 'none',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {classroom.name}
        </h3>
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        {isArchivedCard && (
          <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1', marginBottom: '4px', fontWeight: '700' }}>
            ARCHIVED • READ-ONLY
          </p>
        )}
        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: theme.textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {classroom.section || 'Methods, parameters, and clean interfaces'}
        </p>
      </div>
    </motion.div>
  );
}

