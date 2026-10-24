import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { Home, Calendar, ClipboardList, Settings, Plus, X, Archive, TerminalSquare, Play, MoreHorizontal, Calendar as CalendarIcon, CheckCircle2, Code2, MoreVertical, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsPanel from './SettingsPanel';
import ProfileMenu from './ProfileMenu';
import StudentCalendar from './StudentCalendar';
import ClassroomSettings from './ClassroomSettings';
import CompilerView from './CompilerView';
import VideoPreviewModal from '../components/VideoPreviewModal';
import VideoThumbnailBackground from '../components/VideoThumbnailBackground';
import { apiFetch } from '../utils/api';
import Skeleton from '../components/Skeleton';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import ClassroomBannerIllustration from '../components/ClassroomBannerIllustration';
import { 
  getThemeStorageKeys,
  getClassroomStorageKey,
  getCachedClassrooms,
  saveCachedClassrooms,
  isPhantomClassroom,
  sortClassroomsAlphabetically,
  getClassroomTheme,
  THEME_PRESETS,
  getLessonType,
  extractVideoTitle,
  formatVideoTimestamp,
  cleanVideoFilename
} from '../utils/classroomUtils';

// Storage key uniquely scoped per student account
const getStorageKey = (user) => getClassroomStorageKey(user, 'student');

const cardThemes = [
  { // 0: Emerald Books
    id: 'emerald_books',
    name: 'Emerald Books',
    primary: '#137333',
    secondary: '#1e8e3e',
    gradient: 'linear-gradient(135deg, #137333 0%, #1e8e3e 100%)',
    textColor: 'white',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#ffffff',
    status: 'ACTIVE',
    statusColor: '#dcfce7',
    colSpan: 7
  },
  { // 1: Ocean Academia
    id: 'ocean_academia',
    name: 'Ocean Academia',
    primary: '#1a73e8',
    secondary: '#0d47a1',
    gradient: 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)',
    textColor: 'white',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#ffffff',
    status: 'ACTIVE',
    statusColor: '#93c5fd',
    colSpan: 5
  },
  { // 2: Royal Violet
    id: 'royal_violet',
    name: 'Royal Violet',
    primary: '#7c3aed',
    secondary: '#581c87',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #581c87 100%)',
    textColor: 'white',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#ffffff',
    status: 'ACTIVE',
    statusColor: '#f3e8ff',
    colSpan: 5
  },
  { // 3: Warm Amber
    id: 'warm_amber',
    name: 'Warm Amber',
    primary: '#ea580c',
    secondary: '#9a3412',
    gradient: 'linear-gradient(135deg, #ea580c 0%, #9a3412 100%)',
    textColor: 'white',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#ffffff',
    status: 'ACTIVE',
    statusColor: '#ffedd5',
    colSpan: 7
  },
  { // 4: Midnight Tech
    id: 'midnight_slate',
    name: 'Midnight Tech',
    primary: '#0f172a',
    secondary: '#1e293b',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    textColor: 'white',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#ffffff',
    status: 'ACTIVE',
    statusColor: '#cbd5e1',
    colSpan: 12
  }
];

const StudentCourseCard = ({ classroom, onClick, index, colSpan, isArchived = false, onArchive, onUnarchive }) => {
  const { isDark } = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isArchivedCard = Boolean(isArchived ?? classroom?.archived);
  const classTheme = (classroom.theme && (classroom.theme.primary || classroom.theme.id)) ? classroom.theme : getClassroomTheme(classroom);
  const theme = cardThemes.find(t => t.id === classTheme?.id) || cardThemes[index % cardThemes.length];
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const finalSpan = isMobile ? 12 : (colSpan || theme.colSpan);

  // Close menu when clicking outside
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

  let bgStyle = classTheme?.customImageUrl
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
        filter: isArchived ? 'grayscale(20%)' : 'none'
      }}
    >
      {/* ═══ Background banner illustration layer ═══ */}
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
      {isArchived && (
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '20px',
          backgroundColor: 'rgba(15, 23, 42, 0.35)',
          pointerEvents: 'none',
          zIndex: 2
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0, flex: 1, marginRight: '8px' }}>
            <span style={{ 
              backgroundColor: isArchived ? 'rgba(255, 255, 255, 0.2)' : theme.pillBg, 
              color: isArchived ? '#ffffff' : theme.pillText,
              padding: '4px 10px', 
              borderRadius: '20px', 
              fontSize: '0.75rem',
              fontWeight: 'bold',
              backdropFilter: isArchived ? 'blur(6px)' : 'none'
            }}>
              {classroom.code || `C${classroom.id}`}
            </span>
            {isArchived && (
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
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.22)'}
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  backgroundColor: isDark ? '#262626' : '#ffffff',
                  border: isDark ? '1px solid #404040' : '1px solid #e5e7eb',
                  borderRadius: '14px',
                  boxShadow: isDark
                    ? '0 12px 28px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.3)'
                    : '0 12px 28px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.06)',
                  zIndex: 100,
                  width: '160px',
                  overflow: 'hidden',
                  padding: '4px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {!isArchivedCard && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      if (onArchive) onArchive(classroom);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '10px',
                      color: isDark ? '#f3f4f6' : '#1f2937',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isDark ? '#333333' : '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Archive size={16} color={isDark ? '#9ca3af' : '#64748b'} />
                    Archive
                  </button>
                )}

                {isArchivedCard && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      if (onUnarchive) onUnarchive(classroom);
                      else if (onArchive) onArchive(classroom);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '10px',
                      color: isDark ? '#f3f4f6' : '#1f2937',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isDark ? '#333333' : '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <RefreshCw size={16} color={isDark ? '#9ca3af' : '#64748b'} />
                    Unarchive
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 'bold', lineHeight: 1.2, textShadow: theme.textColor === 'white' ? '0 2px 4px rgba(0,0,0,0.5)' : 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {classroom.name}
        </h3>
      </div>
      
      <div style={{ position: 'relative', zIndex: 10 }}>
        {isArchived && (
          <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1', marginBottom: '4px' }}>
            COMPLETED / READ-ONLY
          </p>
        )}
        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: theme.textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {classroom.section || 'Methods, parameters, and clean interfaces'}
        </p>
      </div>
    </motion.div>
  );
};

export default function StudentDashboard({ currentUser, onLogout, onEnterClassroom, onOpenAssignment, socket, onOpenSandbox }) {
  const { isDark } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [activeView, setActiveView] = useState(() => localStorage.getItem('verity_student_view') || 'classrooms');
  const [slideDirection, setSlideDirection] = useState(1);
  const [settingsClassroom, setSettingsClassroom] = useState(null);
  const [showCompilerConfirm, setShowCompilerConfirm] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleEnterClassroom = (classroom) => {
    setIsFadingOut(true);
    setTimeout(() => onEnterClassroom(classroom), 250);
  };

  const VIEW_ORDER = { 'classrooms': 0, 'calendar': 1, 'archived': 2, 'compiler': 3, 'settings': 4 };

  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const navRefs = useRef({});

  useLayoutEffect(() => {
    const activeRef = navRefs.current[activeView];
    if (activeRef) {
      setIndicatorStyle(prev => ({
        left: activeRef.offsetLeft,
        width: activeRef.offsetWidth,
        opacity: 1,
        transition: prev.opacity === 0 ? 'none' : 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
      }));
    }
  }, [activeView]);

  const handleSetView = (view) => {
    if (view === 'workspace' && onOpenSandbox) {
      onOpenSandbox();
      return;
    }
    const currentIdx = VIEW_ORDER[activeView] ?? 0;
    const nextIdx = VIEW_ORDER[view] ?? 0;
    // Inverted logic: clicking a right tab slides the content right (entering from left)
    setSlideDirection(nextIdx >= currentIdx ? -1 : 1);
    setActiveView(view);
    localStorage.setItem('verity_student_view', view);
  };

  const drillVariants = {
    initial: (direction) => ({
      x: direction > 0 ? 40 : -40,
      opacity: 0
    }),
    animate: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.25, ease: 'easeOut' }
    },
    exit: (direction) => ({
      x: direction < 0 ? 40 : -40,
      opacity: 0,
      transition: { duration: 0.15, ease: 'easeIn' }
    })
  };

  // Load the student's joined classrooms
  const [classrooms, setClassrooms] = useState(() => {
    return sortClassroomsAlphabetically(getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c)));
  });

  const [loadingClassrooms, setLoadingClassrooms] = useState(
    () => getCachedClassrooms(currentUser, 'student').length === 0
  );

  const activeClassrooms = useMemo(() => {
    return sortClassroomsAlphabetically(classrooms.filter(c => !c.archived));
  }, [classrooms]);

  const archivedClassrooms = useMemo(() => {
    return sortClassroomsAlphabetically(classrooms.filter(c => c.archived));
  }, [classrooms]);

  const handleArchiveClass = (targetClassroom) => {
    const targetId = typeof targetClassroom === 'object' ? targetClassroom.id : targetClassroom;
    setClassrooms(prev => {
      const updated = prev.map(c => (String(c.id) === String(targetId) ? { ...c, archived: true } : c));
      saveCachedClassrooms(updated, currentUser, 'student');
      return updated;
    });
  };

  const handleUnarchiveClass = (targetClassroom) => {
    const targetId = typeof targetClassroom === 'object' ? targetClassroom.id : targetClassroom;
    setClassrooms(prev => {
      const updated = prev.map(c => (String(c.id) === String(targetId) ? { ...c, archived: false } : c));
      saveCachedClassrooms(updated, currentUser, 'student');
      return updated;
    });
  };

  // Re-sync local classrooms cache when currentUser changes to prevent cross-account pollution
  useEffect(() => {
    const cached = sortClassroomsAlphabetically(getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c)));
    setClassrooms(cached);
  }, [currentUser]);

  useEffect(() => {
    saveCachedClassrooms(classrooms, currentUser, 'student');
  }, [classrooms, currentUser]);

  useEffect(() => {
    let active = true;
    const fetchEnrolledClassrooms = async () => {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/classrooms`);
        if (res.ok && active) {
          const data = await res.json();
          const serverList = (Array.isArray(data) ? data : (data.classrooms || [])).filter(c => c && c.name && !isPhantomClassroom(c));
          const sortedList = sortClassroomsAlphabetically(serverList);
          setClassrooms(prev => {
            const archivedMap = new Map((prev || []).map(p => [String(p.id), !!p.archived]));
            const merged = sortedList.map(c => ({
              ...c,
              archived: archivedMap.has(String(c.id)) ? archivedMap.get(String(c.id)) : !!c.archived
            }));
            saveCachedClassrooms(merged, currentUser, 'student');
            return merged;
          });
        }
      } catch {} finally {
        if (active) setLoadingClassrooms(false);
      }
    };
    fetchEnrolledClassrooms();
    return () => { active = false; };
  }, [currentUser]);

  // Real-time banner updates listener
  useEffect(() => {
    const handleBannerUpdate = (e) => {
      const detail = e.detail;
      if (!detail || !detail.theme) return;
      setClassrooms(prev => prev.map(c => {
        const matches =
          (c.id != null && String(detail.classroomId) === String(c.id)) ||
          (c.code && detail.code && String(detail.code).toLowerCase() === String(c.code).toLowerCase()) ||
          (c.section && detail.code && String(detail.code).toLowerCase() === String(c.section).toLowerCase()) ||
          (c.name && detail.name && String(detail.name).toLowerCase() === String(c.name).toLowerCase()) ||
          (detail.keys && detail.keys.includes(`verity_classroom_theme_${c.id}`));
        if (matches) {
          return { ...c, theme: detail.theme };
        }
        return c;
      }));
    };
    window.addEventListener('verity:banner-updated', handleBannerUpdate);
    if (socket) {
      socket.on('classroom_theme_changed', (data) => handleBannerUpdate({ detail: data }));
    }
    return () => {
      window.removeEventListener('verity:banner-updated', handleBannerUpdate);
      if (socket) {
        socket.off('classroom_theme_changed');
      }
    };
  }, [socket]);

  // Scoped localStorage cache keys for instant render of To Do / activity list
  const getActivitiesStorageKey = (user) => {
    const id = user?.id || user?.email || 'anon';
    return `verity_cached_upcoming_activities_${id}`;
  };
  const getClassworkStorageKey = (user) => {
    const id = user?.id || user?.email || 'anon';
    return `verity_cached_classwork_${id}`;
  };

  // Instant local cache hydration strictly isolated for student's enrolled classes
  const [upcomingActivities, setUpcomingActivities] = useState(() => {
    try {
      const raw = localStorage.getItem(getActivitiesStorageKey(currentUser));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const userClassrooms = getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c));
          return parsed.filter(item => userClassrooms.some(c => String(c.id) === String(item.classroom_id || item.classId)));
        }
      }
    } catch {}
    return [];
  });
  const [allClasswork, setAllClasswork] = useState(() => {
    try {
      const raw = localStorage.getItem(getClassworkStorageKey(currentUser));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const userClassrooms = getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c));
          return parsed.filter(item => userClassrooms.some(c => String(c.id) === String(item.classroom_id || item.classId)));
        }
      }
    } catch {}
    return [];
  });

  // Re-hydrate user-scoped activities and classwork whenever currentUser changes
  useEffect(() => {
    try {
      const userClassrooms = getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c));
      const rawAct = localStorage.getItem(getActivitiesStorageKey(currentUser));
      if (rawAct) {
        const parsed = JSON.parse(rawAct);
        if (Array.isArray(parsed)) {
          setUpcomingActivities(parsed.filter(item => userClassrooms.some(c => String(c.id) === String(item.classroom_id || item.classId))));
        }
      } else {
        setUpcomingActivities([]);
      }
      const rawCw = localStorage.getItem(getClassworkStorageKey(currentUser));
      if (rawCw) {
        const parsed = JSON.parse(rawCw);
        if (Array.isArray(parsed)) {
          setAllClasswork(parsed.filter(item => userClassrooms.some(c => String(c.id) === String(item.classroom_id || item.classId))));
        }
      } else {
        setAllClasswork([]);
      }
    } catch {
      setUpcomingActivities([]);
      setAllClasswork([]);
    }
  }, [currentUser]);
  const [dashboardStats, setDashboardStats] = useState({ done: 0, dueSoon: 0, miss: 0 });
  const [loadingActivities, setLoadingActivities] = useState(() => {
    try {
      const raw = localStorage.getItem(getActivitiesStorageKey(currentUser));
      return !raw;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let active = true;
    
    const fetchAllActivities = async () => {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/classwork`);
        if (res.ok && active) {
          const data = await res.json();
          if (data && Array.isArray(data.classwork)) {
            const classList = Array.isArray(classrooms) ? classrooms : [];
            const isLegacyHardcoded = (item) => (item?.id === 1 || item?.id === 2) && (item?.title?.startsWith('Activity 1:') || item?.title?.startsWith('Activity 2:'));
            
            // Strictly filter classwork for student's enrolled classes
            const enrolled = data.classwork.filter(
              item => !item.archived && !isLegacyHardcoded(item) && (
                classList.length === 0 || classList.some(c => String(c.id) === String(item.classroom_id || item.classId))
              )
            );
            setAllClasswork(enrolled);
            try {
              localStorage.setItem(getClassworkStorageKey(currentUser), JSON.stringify(enrolled));
            } catch {}

            // Sort activities: nearest deadline first, followed by activities without deadline
            const sortedActivities = [...enrolled].sort((a, b) => {
              if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
              if (a.dueDate) return -1;
              if (b.dueDate) return 1;
              return new Date(b.posted || b.id || 0) - new Date(a.posted || a.id || 0);
            });
            setUpcomingActivities(sortedActivities);
            try {
              localStorage.setItem(getActivitiesStorageKey(currentUser), JSON.stringify(sortedActivities));
            } catch {}

            // Calculate stats using submissions
            try {
              const subRes = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/student/submissions`);
              if (subRes.ok && active) {
                const subData = await subRes.json();
                const submittedAssignmentIds = new Set((subData.submissions || []).map(s => String(s.assignment_id)));
                let done = 0, dueSoon = 0, miss = 0;
                const now = new Date();
                sortedActivities.forEach(cw => {
                  if (submittedAssignmentIds.has(String(cw.id))) {
                    done++;
                  } else {
                    const due = cw.dueDate ? new Date(cw.dueDate) : null;
                    if (due && due < now) {
                      miss++;
                    } else {
                      dueSoon++;
                    }
                  }
                });
                setDashboardStats({ done, dueSoon, miss });
              }
            } catch (e) {
              console.warn('Failed to fetch submissions for stats', e);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch classwork:', err);
      } finally {
        if (active) setLoadingActivities(false);
      }
    };
    
    fetchAllActivities();
    
    return () => { active = false; };
  }, [classrooms, currentUser]);

  // Real video durations map dynamically resolved from video files
  const [videoDurations, setVideoDurations] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_video_durations');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleVideoDurationLoaded = (videoSrc, durationInSec) => {
    const formatted = formatVideoTimestamp(durationInSec);
    if (formatted && videoSrc) {
      setVideoDurations(prev => {
        if (prev[videoSrc] === formatted) return prev;
        const updated = { ...prev, [videoSrc]: formatted };
        try { localStorage.setItem('verity_video_durations', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
  };

  // Compute all available video lessons strictly for student's active enrolled classrooms
  const videoLessons = useMemo(() => {
    const list = [];
    const classList = Array.isArray(activeClassrooms) ? activeClassrooms : [];
    if (classList.length === 0) return []; // Not in any active classroom = no video lessons!

    allClasswork.forEach(item => {
      // Must strictly belong to an active enrolled classroom
      const classObj = classList.find(c => String(c.id) === String(item.classroom_id || item.classId));
      if (!classObj) return;

      if (getLessonType(item) === 'video') {
        const videoAttachment = item.attachments?.find(a => 
          a?.type === 'video' || 
          a?.type === 'youtube' || 
          /\.(mp4|webm|mov|m4v|mkv|avi)(\?|$)/i.test(a?.url || '') || 
          /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(a?.name || '')
        );
        const match = (item.details || item.instruction || '').match(/<video[^>]*src="([^"]+)"/);
        const ytMatch = (item.details || item.instruction || '').match(/(?:src="|href=")([^"]*(?:youtube\.com|youtu\.be)[^"]*)"/);
        const src = videoAttachment?.url || (match ? match[1] : '') || (ytMatch ? ytMatch[1] : '');
        if (!src) return;

        const title = extractVideoTitle(src, videoAttachment, item.title);

        list.push({
          id: String(item.id),
          title,
          subject: (classObj.name || classObj.subject || 'COURSE').toUpperCase(),
          duration: formatVideoTimestamp(item.duration) || (src?.includes('1792768564903_HCI_Lesson_1_ITEC_80') ? '52:21' : null) || '52:21',
          src,
          item,
          classObj
        });
      }
    });

    return list;
  }, [allClasswork, activeClassrooms]);

  // Track seen state in localStorage per user
  const [seenVideoMap, setSeenVideoMap] = useState({});

  useEffect(() => {
    const uid = currentUser?.id || 'anon';
    const map = {};
    videoLessons.forEach(v => {
      const key = `verity_seen_video_${uid}_${v.id}`;
      map[v.id] = localStorage.getItem(key) === 'true';
    });
    setSeenVideoMap(map);
  }, [videoLessons, currentUser]);

  // First unseen video lesson (null if all are seen)
  const unseenVideo = useMemo(() => {
    return videoLessons.find(v => !seenVideoMap[v.id]) || null;
  }, [videoLessons, seenVideoMap]);

  // Real timestamp of the video lesson (replaces fixed 25 min)
  const currentVideoDuration = useMemo(() => {
    if (!unseenVideo) return '52:21';
    if (unseenVideo.src && videoDurations[unseenVideo.src]) {
      return videoDurations[unseenVideo.src];
    }
    const formatted = formatVideoTimestamp(unseenVideo.duration);
    if (formatted) return formatted;
    if (unseenVideo.src?.includes('1792768564903_HCI_Lesson_1_ITEC_80')) {
      return '52:21';
    }
    return unseenVideo.duration && unseenVideo.duration !== '25 min' ? unseenVideo.duration : '52:21';
  }, [unseenVideo, videoDurations]);

  // Active playing video modal
  const [activePlayingVideo, setActivePlayingVideo] = useState(null);

  const handleStartSession = (videoToPlay) => {
    const target = videoToPlay || unseenVideo;
    if (!target) return;
    setActivePlayingVideo(target);

    // Mark as seen immediately in localStorage and state
    const uid = currentUser?.id || 'anon';
    const key = `verity_seen_video_${uid}_${target.id}`;
    try {
      localStorage.setItem(key, 'true');
    } catch {}
    setSeenVideoMap(prev => ({ ...prev, [target.id]: true }));
  };

  const handleResetVideoSeen = (e) => {
    if (e) e.stopPropagation();
    const uid = currentUser?.id || 'anon';
    videoLessons.forEach(v => {
      const key = `verity_seen_video_${uid}_${v.id}`;
      try {
        localStorage.removeItem(key);
      } catch {}
    });
    setSeenVideoMap({});
  };

  const handleViewActivityDetails = (videoItem) => {
    const target = videoItem || unseenVideo;
    if (target?.item && onOpenAssignment) {
      const classObj = classrooms.find(c => String(c.id) === String(target.item.classroom_id || target.item.classId));
      if (classObj) {
        onOpenAssignment(classObj, target.item);
      }
    }
  };

  // "Input Class Code" modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const handleJoin = async (e) => {
    if (e) e.preventDefault();
    setJoinError('');
    const code = classCode.trim();
    if (!code) {
      setJoinError('Please enter a class code.');
      return;
    }
    const alreadyJoined = classrooms.some(c =>
      (c.code && c.code.toLowerCase() === code.toLowerCase()) ||
      (c.section && c.section.toLowerCase() === code.toLowerCase()) ||
      (c.name && c.name.toLowerCase() === code.toLowerCase()) ||
      String(c.id).toLowerCase() === code.toLowerCase()
    );
    if (alreadyJoined) {
      setJoinError('You have already joined this class.');
      return;
    }
    setIsJoining(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/classrooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, studentName: currentUser?.name, studentEmail: currentUser?.email })
      });
      const data = await res.json();
      if (!res.ok) {
        setIsJoining(false);
        setJoinError(data.message || 'No class found with that code.');
        return;
      }
      const joined = data.classroom;
      if (joined.theme) {
        const keys = getThemeStorageKeys(joined);
        keys.forEach(k => {
          try { localStorage.setItem(k, JSON.stringify(joined.theme)); } catch {}
        });
      }
      const updated = sortClassroomsAlphabetically([joined, ...classrooms.filter(c => c.id !== joined.id)]);
      setClassrooms(updated);
      setIsJoining(false);
      setIsModalOpen(false);
      setClassCode('');
    } catch {
      setIsJoining(false);
      setJoinError('Could not connect to server.');
    }
  };

  const navItems = [
    { id: 'classrooms', Icon: Home, label: 'Home' },
    { id: 'calendar', Icon: Calendar, label: 'Calendar' },
    { id: 'archived', Icon: Archive, label: 'Archived' },
    { id: 'compiler', Icon: Code2, label: 'Compiler' },
  ];

  const bgColor = isDark ? '#1a1a1a' : '#f8f9fa';
  const textColor = isDark ? '#f5f5f5' : '#111827';
  const textMuted = isDark ? '#a3a3a3' : '#6b7280';
  const cardBg = isDark ? '#262626' : '#ffffff';
  
  useEffect(() => {
    document.documentElement.style.backgroundColor = bgColor;
    document.body.style.backgroundColor = bgColor;
    return () => {
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
    };
  }, [bgColor]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: isFadingOut ? 0 : 1 }} 
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        minHeight: '100vh',
        backgroundColor: bgColor,
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        color: textColor,
      }}
    >
      {/* Top Header Navigation */}
      <header 
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px clamp(20px, 3vw, 48px)',
        backgroundColor: bgColor,
        borderBottom: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Smooth gradient transition at the bottom of the header */}
        {activeView !== 'compiler' && (
          <div style={{
            position: 'absolute',
            bottom: '-30px',
            left: 0,
            right: 0,
            height: '30px',
            background: `linear-gradient(to bottom, ${bgColor}, transparent)`,
            pointerEvents: 'none'
          }} />
        )}

        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }} onClick={() => handleSetView('classrooms')}>
          <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
          <span style={{ color: textColor, fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
          <span style={{ fontSize: '0.7rem', color: textMuted, marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</span>
        </div>

        {/* Center: Navigation */}
        <div 
          className="header-center-nav"
          style={{ 
            display: isMobile ? 'none' : 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '8px',
            opacity: 1,
            pointerEvents: 'auto',
            position: 'relative'
          }}
        >
          <div style={{
            position: 'absolute',
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            top: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '50px',
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 4px 16px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.35)',
            transition: indicatorStyle.transition || 'none',
            opacity: indicatorStyle.opacity,
            pointerEvents: 'none',
            zIndex: 0,
          }} />

          {navItems.map(item => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                ref={el => navRefs.current[item.id] = el}
                onClick={() => handleSetView(item.id)}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '50px',
                  background: 'transparent',
                  border: '1px solid transparent',
                  color: active ? '#10b981' : textMuted,
                  fontWeight: active ? '700' : '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <item.Icon size={18} />
                {item.label}
              </button>
            );
          })}


          <button
            ref={el => navRefs.current['settings'] = el}
            onClick={() => handleSetView('settings')}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              borderRadius: '50px',
              backgroundColor: 'transparent',
              color: textMuted,
              border: 'none',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            <Settings size={20} />
            <span style={{ marginLeft: '8px', fontWeight: '600', fontSize: '0.9rem' }}>Settings</span>
          </button>
        </div>

        {/* Right: Profile */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: '16px' }}>
          <button
            onClick={() => { setJoinError(''); setClassCode(''); setIsModalOpen(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              borderRadius: '50px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
              opacity: 1,
              pointerEvents: 'auto'
            }}
          >
            <Plus size={18} /> Add course
          </button>
          <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: activeView === 'compiler' ? 'hidden' : 'visible',
        padding: activeView === 'compiler' ? 0 : '32px clamp(20px, 3vw, 48px)',
        maxWidth: '100%',
        margin: 0,
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <AnimatePresence mode="wait" custom={slideDirection}>
          {activeView === 'classrooms' && (
            <motion.div
              key="classrooms"
              custom={slideDirection}
              variants={drillVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {/* Hero Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px', flexWrap: 'wrap', gap: '20px' }}>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              >
                <p style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()} · YOUR LEARNING DASHBOARD
                </p>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 12px', color: textColor }}>
                  Good morning, {currentUser?.name || 'Verity Student'}.
                </h1>
              </motion.div>
              
              {/* Stats Pill */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                style={{ 
                  display: 'flex', 
                  backgroundColor: cardBg, 
                  borderRadius: '50px', 
                  padding: '16px 32px',
                  gap: '32px',
                  boxShadow: isDark ? '0 4px 15px rgba(0,0,0,0.2)' : '0 4px 15px rgba(0,0,0,0.05)',
                  border: isDark ? '1px solid #333' : '1px solid #e5e7eb'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{dashboardStats.done}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: textMuted, marginTop: '2px' }}>Done</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{dashboardStats.dueSoon}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: textMuted, marginTop: '2px' }}>Due Soon</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{dashboardStats.miss}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: textMuted, marginTop: '2px' }}>Miss</div>
                </div>
              </motion.div>
            </div>

            {/* Content Grid layout: Left Column (Courses) + Right Column (This week / To Do Card) */}
            <div style={{
              display: 'flex',
              gap: '32px',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'flex-start',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              
              {/* Left Column: Enrolled Courses */}
              <div style={{ flex: '1 1 0%', minWidth: 0, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Enrolled courses</h2>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
                  gap: '24px'
                }}>
                  {loadingClassrooms ? (
                    [...Array(4)].map((_, i) => (
                      <div key={i} style={{ gridColumn: `span ${isMobile ? 12 : cardThemes[i % cardThemes.length].colSpan}`, height: '260px', backgroundColor: cardBg, borderRadius: '20px', animation: 'pulse 1.5s infinite' }} />
                    ))
                  ) : (
                    activeClassrooms.map((cls, idx) => (
                      <motion.div
                        key={cls.id}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                        style={{ gridColumn: `span ${isMobile ? 12 : cardThemes[idx % cardThemes.length].colSpan}` }}
                      >
                        <StudentCourseCard key={cls.id} classroom={cls} index={idx} colSpan={cardThemes[idx % cardThemes.length].colSpan} onClick={handleEnterClassroom} onArchive={handleArchiveClass} onUnarchive={handleUnarchiveClass} isArchived={false} />
                      </motion.div>
                    ))
                  )}
                  {activeClassrooms.length === 0 && !loadingClassrooms && (
                    <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center' }}>
                      <p style={{ color: textMuted, margin: '0 0 16px', fontSize: '0.95rem' }}>You have not enrolled in any courses yet.</p>
                      <button onClick={() => setIsModalOpen(true)} style={{ padding: '8px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                        Join a Course
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Dedicated Sidebar content (This week, To Do) */}
              <aside style={{
                flex: isMobile ? '1 1 auto' : '0 0 380px',
                width: isMobile ? '100%' : '380px',
                maxWidth: isMobile ? '100%' : '420px',
                flexShrink: 0,
                backgroundColor: cardBg,
                borderRadius: '32px',
                padding: '32px',
                boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.2)' : '0 10px 30px rgba(0,0,0,0.03)',
                alignSelf: 'flex-start',
                boxSizing: 'border-box'
              }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>This week</h2>
                    <p style={{ fontSize: '0.8rem', color: textMuted, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — 
                      {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: isDark ? '#333' : '#f3f4f6', borderRadius: '50%' }}>
                    <CalendarIcon size={18} color={textMuted} />
                  </div>
                </div>

                {/* Video Lesson Card or Caught Up State */}
                {unseenVideo ? (
                  <div
                    onClick={() => handleStartSession(unseenVideo)}
                    style={{
                      backgroundColor: cardBg,
                      borderRadius: '24px',
                      padding: '14px 14px 18px 14px',
                      marginBottom: '32px',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                      boxShadow: isDark
                        ? '0 4px 20px -2px rgba(0, 0, 0, 0.35)'
                        : '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = isDark
                        ? '0 8px 25px -4px rgba(0, 0, 0, 0.45)'
                        : '0 8px 25px -4px rgba(0, 0, 0, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = isDark
                        ? '0 4px 20px -2px rgba(0, 0, 0, 0.35)'
                        : '0 4px 20px -2px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    {/* Upper Banner Container */}
                    <div
                      style={{
                        height: '135px',
                        borderRadius: '18px',
                        overflow: 'hidden',
                        position: 'relative',
                        backgroundColor: isDark ? '#0f172a' : '#1e293b',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '12px'
                      }}
                    >
                      {/* Video Thumbnail Background */}
                      <VideoThumbnailBackground
                        src={unseenVideo.src}
                        title={unseenVideo.title}
                        isDark={isDark}
                        onDurationLoaded={(durationInSec) => handleVideoDurationLoaded(unseenVideo.src, durationInSec)}
                      />

                      {/* Top Badges Row */}
                      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        {/* Top-Left: New Pill & Subject Pill */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span
                            style={{
                              backgroundColor: '#d1fae5',
                              color: '#065f46',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              padding: '3px 12px',
                              borderRadius: '9999px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              width: 'fit-content',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                            }}
                          >
                            New
                          </span>
                          <span
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              color: '#065f46',
                              fontSize: '0.72rem',
                              fontWeight: '800',
                              letterSpacing: '0.04em',
                              padding: '4px 12px',
                              borderRadius: '9999px',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              width: 'fit-content',
                              whiteSpace: 'nowrap',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                            title={unseenVideo.subject}
                          >
                            {unseenVideo.subject}
                          </span>
                        </div>

                        {/* Top-Right: Duration Pill */}
                        <span
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            color: '#1e293b',
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          {currentVideoDuration}
                        </span>
                      </div>

                      {/* Middle-Right / Bottom-Right Play Button */}
                      <button
                        type="button"
                        aria-label="Play video lesson"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartSession(unseenVideo);
                        }}
                        style={{
                          position: 'absolute',
                          right: '14px',
                          bottom: '14px',
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          backgroundColor: '#065f46',
                          border: '2px solid rgba(255, 255, 255, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
                          transition: 'transform 0.2s, background-color 0.2s, box-shadow 0.2s',
                          zIndex: 3
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.08)';
                          e.currentTarget.style.backgroundColor = '#047857';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.backgroundColor = '#065f46';
                        }}
                      >
                        <Play size={16} fill="white" color="white" style={{ marginLeft: '2px' }} />
                      </button>
                    </div>

                    {/* Lower Details Area */}
                    <div style={{ padding: '14px 6px 4px 6px' }}>
                      <h4
                        style={{
                          margin: '0 0 6px 0',
                          fontSize: '1.25rem',
                          fontWeight: '800',
                          color: textColor,
                          letterSpacing: '-0.02em',
                          lineHeight: 1.25,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={unseenVideo.title}
                      >
                        {unseenVideo.title}
                      </h4>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.88rem',
                          fontWeight: '600',
                          color: textMuted
                        }}
                      >
                        Not started • {currentVideoDuration}
                      </p>
                    </div>
                  </div>
                ) : videoLessons.length > 0 ? (
                  /* Caught Up State: text and icon remain, card box and replay button removed */
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '4px 0',
                      marginBottom: '24px',
                      color: isDark ? '#34d399' : '#059669'
                    }}
                  >
                    <CheckCircle2 size={18} color={isDark ? '#34d399' : '#059669'} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                      You're all caught up in video lesson!
                    </span>
                  </div>
                ) : null}

                {/* "To Do" Section */}
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '0 0 16px' }}>To Do</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {loadingActivities ? (
                    <div style={{ color: textMuted, fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>Loading tasks...</div>
                  ) : upcomingActivities.filter(act => (classrooms || []).some(c => String(c.id) === String(act.classroom_id || act.classId))).length === 0 ? (
                    <div style={{ color: textMuted, fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>No upcoming tasks!</div>
                  ) : (
                    upcomingActivities
                      .filter(act => (classrooms || []).some(c => String(c.id) === String(act.classroom_id || act.classId)))
                      .slice(0, 5)
                      .map((act) => {
                      const d = act.dueDate ? new Date(act.dueDate) : null;
                      const hasValidDate = d && !isNaN(d.getTime());
                      const time = hasValidDate ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
                      const now = new Date();
                      const isToday = hasValidDate && d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                      const isTomorrow = hasValidDate && new Date(now.getTime() + 86400000).getDate() === d.getDate() && new Date(now.getTime() + 86400000).getMonth() === d.getMonth();
                      const label = hasValidDate ? (isToday ? 'Today' : (isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))) : 'Assigned';
                      const classObj = classrooms.find(c => String(c.id) === String(act.classroom_id || act.classId));
                      const courseName = classObj ? (classObj.name || 'Course') : 'Course';
                      const initial = courseName.charAt(0).toUpperCase();
                      const bgCol = classObj?.theme?.color || '#059669';

                      const handleOpenTask = () => {
                        if (classObj && onOpenAssignment) {
                          onOpenAssignment(classObj, act);
                        } else if (classObj) {
                          handleEnterClassroom(classObj);
                        }
                      };

                      return (
                        <div 
                          key={act.id} 
                          onClick={handleOpenTask}
                          title={`Open ${act.title}`}
                          style={{ display: 'flex', gap: '16px', alignItems: 'center', cursor: 'pointer', padding: '8px', borderRadius: '12px', margin: '-8px', transition: 'background-color 0.2s' }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ textAlign: 'right', minWidth: '70px', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{time}</div>
                            <div style={{ fontSize: '0.65rem', color: textMuted, textTransform: 'uppercase' }}>{label}</div>
                          </div>
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: bgCol, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0 }}>
                            {initial}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.95rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.title}</div>
                            <div style={{ fontSize: '0.75rem', color: textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{courseName} - {act.points || 100} pts</div>
                          </div>
                          <MoreHorizontal size={18} color={textMuted} style={{ cursor: 'pointer', flexShrink: 0 }} />
                        </div>
                      );
                    })
                  )}
                </div>
              </aside>
            </div>
            </motion.div>
          )}

          {/* Other Views */}
          {activeView === 'settings' && (
            <motion.div key="settings" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <SettingsPanel role="Student" />
            </motion.div>
          )}
          {activeView === 'compiler' && (
            <motion.div key="compiler" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <CompilerView />
            </motion.div>
          )}
          {activeView === 'calendar' && (
            <motion.div key="calendar" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <StudentCalendar classrooms={classrooms} />
            </motion.div>
          )}
          {activeView === 'archived' && (
            <motion.div
              key="archived"
              custom={slideDirection}
              variants={drillVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', width: '100%' }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '30px'
              }}>
                <h1 style={{ fontSize: '2.25rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: textColor }}>
                  Archived Classrooms
                </h1>
              </div>

              {/* Content Grid or Empty State */}
              {archivedClassrooms.length === 0 ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '80px 20px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: isDark ? '#a3a3a3' : '#6b7280', fontWeight: '600' }}>
                    No Archived Classrooms
                  </h3>
                  <p style={{ marginTop: '10px', fontSize: '0.95rem', color: isDark ? '#6b7280' : '#9ca3af', maxWidth: '420px', lineHeight: 1.5 }}>
                    Classrooms that are archived will appear here.
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
                  gap: '24px',
                  width: '100%'
                }}>
                  {archivedClassrooms.map((cls, idx) => (
                    <motion.div
                      key={cls.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      style={{ gridColumn: `span ${isMobile ? 12 : cardThemes[idx % cardThemes.length].colSpan}` }}
                    >
                      <StudentCourseCard
                        classroom={cls}
                        index={idx}
                        colSpan={cardThemes[idx % cardThemes.length].colSpan}
                        onClick={handleEnterClassroom}
                        isArchived={true}
                        onArchive={handleArchiveClass}
                        onUnarchive={handleUnarchiveClass}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      {isMobile && (
        <nav style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          backgroundColor: isDark ? '#262626' : '#ffffff',
          borderTop: isDark ? '1px solid #3f3f46' : '1px solid #e5e7eb',
          height: '65px',
          flexShrink: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          position: 'sticky',
          bottom: 0,
          zIndex: 60
        }}>
          {[...navItems, { id: 'settings', Icon: Settings, label: 'Settings' }].map(({ id, Icon, label }) => {
            const active = activeView === id;
            return (
              <button
                key={id}
                onClick={() => handleSetView(id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  color: active ? '#10b981' : (isDark ? '#a3a3a3' : '#64748b'),
                  cursor: 'pointer',
                  padding: '8px',
                  minWidth: '64px'
                }}
              >
                <Icon size={20} style={{ marginBottom: '4px' }} />
                <span style={{ fontSize: '0.65rem', fontWeight: active ? '700' : '600' }}>{label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* COMPILER CONFIRM MODAL */}
      <AnimatePresence>

      </AnimatePresence>

      {/* VIDEO PREVIEW MODAL */}
      {activePlayingVideo && (
        <VideoPreviewModal 
          src={activePlayingVideo.src} 
          name={activePlayingVideo.title} 
          onClose={() => setActivePlayingVideo(null)} 
        />
      )}

      {/* INPUT CLASS CODE MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, backdropFilter: 'blur(4px)'
          }}
          onClick={() => { setIsModalOpen(false); setJoinError(''); setClassCode(''); }}
        >
          <div
            style={{ backgroundColor: cardBg, padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Join a Class</h2>
              <button onClick={() => { setIsModalOpen(false); setJoinError(''); setClassCode(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color={textMuted} />
              </button>
            </div>
            
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: textMuted }}>Class Code</label>
                <input
                  type="text" autoFocus
                  placeholder="e.g. CS101"
                  value={classCode}
                  onChange={(e) => { setClassCode(e.target.value); if (joinError) setJoinError(''); }}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                    border: `1.5px solid ${isDark ? '#444' : '#e5e7eb'}`,
                    backgroundColor: isDark ? '#1a1a1a' : 'white',
                    color: textColor, boxSizing: 'border-box', outline: 'none'
                  }}
                />
              </div>
              {joinError && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>{joinError}</p>}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => { setIsModalOpen(false); setJoinError(''); setClassCode(''); }} style={{ padding: '10px 20px', borderRadius: '50px', background: 'transparent', border: `1px solid ${isDark ? '#444' : '#e5e7eb'}`, color: textColor, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isJoining} style={{ padding: '10px 24px', borderRadius: '50px', background: '#10b981', color: 'white', border: 'none', cursor: isJoining ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                  {isJoining ? 'Joining...' : 'Join Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}


