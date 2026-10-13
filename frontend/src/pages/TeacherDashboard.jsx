import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Home, Calendar, ClipboardList, Settings, MoreVertical, Plus, LogOut, User, X, Menu, Archive, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsPanel from './SettingsPanel';
import ProfileMenu from './ProfileMenu';
import TeacherCalendar from './TeacherCalendar';
import ClassroomSettings from './ClassroomSettings';
import ClassroomCard from '../components/ClassroomCard';
import { apiFetch } from '../utils/api';
import Skeleton from '../components/Skeleton';
import { useDarkMode } from '../hooks/useDarkMode';
import { useSidebarNav } from '../hooks/useSidebarNav';
import { useMediaQuery } from '../hooks/useMediaQuery';

const getStorageKey = (user) => {
  const identifier = user?.email || user?.id || (user?.name ? user.name.toLowerCase().replace(/\s+/g, '_') : null);
  return identifier ? `verity_teacher_classrooms_${identifier}` : 'verity_teacher_classrooms_anon';
};

import { isPhantomClassroom, mergeClassroomsPreservingOrder, generateClassCode } from '../utils/classroomUtils';
export { isPhantomClassroom, mergeClassroomsPreservingOrder, generateClassCode };

const cardThemes = [
  { // 0: C# Programming
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
    gradient: 'linear-gradient(to right, rgba(15, 23, 42, 1) 0%, rgba(15, 23, 42, 0.85) 30%, rgba(15, 23, 42, 0.3) 60%, transparent 100%)',
    textColor: 'white',
    pillBg: '#dcfce7',
    pillText: '#065f46',
    status: 'ACTIVE',
    statusColor: '#cbd5e1',
    colSpan: 7
  },
  { // 1: Data Structures
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
    gradient: 'linear-gradient(to right, rgba(30, 27, 75, 1) 0%, rgba(30, 27, 75, 0.85) 30%, rgba(30, 27, 75, 0.3) 60%, transparent 100%)',
    textColor: 'white',
    pillBg: '#f3e8ff',
    pillText: '#6b21a8',
    status: 'ACTIVE',
    statusColor: '#e9d5ff',
    colSpan: 5
  },
  { // 2: NICE
    image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=600&q=80',
    gradient: 'linear-gradient(to right, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.9) 30%, rgba(255, 255, 255, 0.4) 60%, transparent 100%)',
    textColor: '#0f172a',
    pillBg: '#e0e7ff',
    pillText: '#4338ca',
    status: 'ACTIVE',
    statusColor: '#64748b',
    colSpan: 5
  },
  { // 3: Verity
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80',
    gradient: 'linear-gradient(to right, rgba(15, 23, 42, 1) 0%, rgba(15, 23, 42, 0.85) 30%, rgba(15, 23, 42, 0.3) 60%, transparent 100%)',
    textColor: 'white',
    pillBg: '#dcfce7',
    pillText: '#065f46',
    status: 'ACTIVE',
    statusColor: '#a7f3d0',
    colSpan: 7
  }
];

const TeacherCourseCard = ({ classroom, onClick, onSettings, onArchive, onUnarchive, onDelete, isArchived, index, initial, animate, transition }) => {
  const { isDark } = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = cardThemes[index % cardThemes.length];
  const imageUrl = classroom.theme?.customImageUrl || theme.image;
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const finalSpan = isMobile ? 12 : theme.colSpan;
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleDocClick = () => setMenuOpen(false);
    if (menuOpen) document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [menuOpen]);

  let bgStyle = {
    background: `${theme.gradient}, url(${imageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
  
  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition || { type: 'spring', stiffness: 300, damping: 22 }}
      whileHover={{ y: -4, scale: 1.01, boxShadow: '0 15px 30px rgba(0,0,0,0.15)' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(classroom)}
      style={{
        ...bgStyle,
        borderRadius: '20px',
        padding: '24px',
        height: '240px',
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
        opacity: isArchived ? 0.75 : 1
      }}
    >
      <div style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              backgroundColor: theme.pillBg, 
              color: theme.pillText,
              padding: '4px 10px', 
              borderRadius: '20px', 
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }}>
              {classroom.code || `C${classroom.id}`}
            </span>
            <span style={{ fontSize: '0.85rem', color: theme.textColor, fontWeight: '500', opacity: 0.9 }}>
              {classroom.studentsCount || 0} Students
            </span>
          </div>
          
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(p => !p); }}
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)'
              }}
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  backgroundColor: isDark ? '#333' : '#fff',
                  border: isDark ? '1px solid #444' : '1px solid #e5e7eb',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                  zIndex: 100,
                  width: '180px',
                  overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {!isArchived && onSettings && (
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onSettings(classroom); }} style={{ width: '100%', padding: '12px 16px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: isDark ? '1px solid #444' : '1px solid #e5e7eb', color: isDark ? '#eee' : '#333', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={16} /> Settings
                  </button>
                )}
                {!isArchived && onArchive && (
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onArchive(classroom); }} style={{ width: '100%', padding: '12px 16px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: isDark ? '1px solid #444' : '1px solid #e5e7eb', color: isDark ? '#eee' : '#333', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Archive size={16} /> Archive
                  </button>
                )}
                {isArchived && onUnarchive && (
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onUnarchive(classroom); }} style={{ width: '100%', padding: '12px 16px', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: isDark ? '1px solid #444' : '1px solid #e5e7eb', color: isDark ? '#eee' : '#333', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={16} /> Unarchive
                  </button>
                )}
                {onDelete && (
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(classroom); }} style={{ width: '100%', padding: '12px 16px', textAlign: 'left', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trash2 size={16} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <h3 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 'bold', lineHeight: 1.2, textShadow: theme.textColor === 'white' ? '0 2px 4px rgba(0,0,0,0.5)' : 'none' }}>
          {classroom.name}
        </h3>
      </div>
      
      <div style={{ position: 'relative', zIndex: 10 }}>
        <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.statusColor, marginBottom: '4px' }}>
          {isArchived ? 'ARCHIVED' : 'ACTIVE'}
        </p>
        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: theme.textColor }}>
          {classroom.section || 'General Section'}
        </p>
      </div>
    </motion.div>
  );
};

export default function TeacherDashboard({ currentUser, onLogout, onEnterClassroom }) {
  const { isDark } = useDarkMode();
  const [activeView, setActiveView] = useState(() => localStorage.getItem('verity_teacher_view') || 'classrooms');
  const [slideDirection, setSlideDirection] = useState(1);
  const { collapsed, toggleSidebar, sidebarProps, isPinned } = useSidebarNav();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const styles = {
    container: {
      height: '100vh',
      height: '100dvh',
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: isDark ? '#3C3C3C' : '#EEF0F3',
      fontFamily: 'Arial, Helvetica, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      transition: 'background-color 0.25s ease'
    },
    header: {
      height: isMobile ? '60px' : '72px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '0 16px' : '0 24px',
      backgroundColor: isDark ? '#3C3C3C' : '#EEF0F3',
      borderBottom: 'none',
      zIndex: 50,
      transition: 'background-color 0.25s ease'
    },
    sidebar: (collapsed) => ({
      width: collapsed ? '84px' : '240px',
      minWidth: collapsed ? '84px' : '240px',
      padding: '20px 14px 20px',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
      background: 'transparent',
      overflowY: 'auto',
      overflowX: 'hidden'
    }),
    sidebarBtn: (collapsed) => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: '16px',
      padding: '10px 18px',
      width: '100%',
      height: '42px',
      borderRadius: '14px',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      position: 'relative',
      zIndex: 1
    }),
    logoContainer: { fontSize: '2.5rem', fontWeight: '900', fontStyle: 'italic', textShadow: '2px 2px 4px rgba(0,0,0,0.1)' },
    logoV: { color: '#10b981' },
    logoText: { color: 'white' },
    badge: {
      fontSize: '0.7rem',
      backgroundColor: isDark ? '#4A4A4A' : '#EEF0F3',
      color: isDark ? '#E8EAED' : '#475569',
      padding: '3px 8px',
      borderRadius: '10px',
      marginLeft: '6px',
      fontStyle: 'normal',
      transform: 'translateY(-5px)',
      border: isDark ? '1px solid #5A5A5A' : '1px solid #cbd5e1'
    },
    navGroup: { display: 'flex', flexDirection: 'column', gap: '15px' },
    navItem: { position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', padding: '12px 20px', color: '#6b7280', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease', borderRadius: '14px', background: 'transparent', boxShadow: 'none', whiteSpace: 'nowrap' },
    activeNavItem: { color: '#10b981', fontWeight: '700' },
    settingsIcon: { color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    mainContent: { flex: 1, padding: isMobile ? '10px 16px 16px' : '20px 24px 24px', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' },
    topBar: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px', marginBottom: '20px' },
    logoutButton: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 15px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
    profileCircle: { width: '50px', height: '50px', backgroundColor: '#d1d5db', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '2px 2px 5px rgba(0,0,0,0.1)' },
    whiteCard: {
      backgroundColor: isDark ? '#323232' : 'white',
      flex: 1,
      borderRadius: '24px',
      padding: 0,
      boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.25)' : '0 10px 25px rgba(0,0,0,0.05)',
      overflow: 'hidden',
      border: isDark ? '1px solid #4A4A4A' : 'none',
      color: isDark ? '#E8EAED' : 'inherit',
      transition: 'background-color 0.25s ease, border-color 0.25s ease',
      display: 'flex',
      flexDirection: 'column',
    },

    // The Green Create Button
    createButton: { 
      display: 'flex', 
      alignItems: 'center', 
      padding: '10px 30px', 
      backgroundColor: '#10b981', 
      border: 'none', 
      borderRadius: '50px', 
      color: 'white', 
      fontWeight: 'bold', 
      fontSize: '1rem', 
      cursor: 'pointer', 
      boxShadow: isDark 
        ? '0 0 16px rgba(16, 185, 129, 0.35), 0 2px 6px rgba(0, 0, 0, 0.35)' 
        : '0 2px 6px rgba(16, 185, 129, 0.24), 0 1px 2px rgba(0, 0, 0, 0.05)',
      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease'
    },

    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' },

    // Modal Styles
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, backdropFilter: 'blur(5px)' },
    modalCard: {
      backgroundColor: isDark ? '#323232' : 'white',
      padding: '40px',
      borderRadius: '24px',
      width: '90%',
      maxWidth: '500px',
      boxShadow: isDark ? '0 0 24px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.6)' : '0 20px 40px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.05)',
      border: isDark ? '1px solid #4A4A4A' : 'none',
      color: isDark ? '#E8EAED' : 'inherit'
    },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
    closeModalBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: isDark ? '#a3a3a3' : '#9ca3af', padding: '6px', borderRadius: '50%' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    input: {
      width: '100%',
      padding: '15px',
      borderRadius: '12px',
      border: isDark ? '1px solid #4A4A4A' : '1px solid #e5e7eb',
      backgroundColor: isDark ? '#282828' : 'white',
      color: isDark ? '#E8EAED' : '#4b5563',
      fontSize: '1rem',
      boxSizing: 'border-box',
      boxShadow: isDark ? '0 0 8px rgba(0,0,0,0.2) inset' : 'inset 0 2px 4px rgba(0,0,0,0.02)'
    },
    submitModalBtn: { 
      padding: '10px 40px', 
      backgroundColor: '#10b981', 
      border: 'none', 
      borderRadius: '50px', 
      color: 'white', 
      fontWeight: 'bold', 
      fontSize: '1rem', 
      cursor: 'pointer',
      boxShadow: isDark 
        ? '0 0 16px rgba(16, 185, 129, 0.35), 0 2px 6px rgba(0, 0, 0, 0.35)' 
        : '0 2px 6px rgba(16, 185, 129, 0.24), 0 1px 2px rgba(0, 0, 0, 0.05)',
      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease'
    }
  };

  const navRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState(() => {
    try {
      const savedTop = sessionStorage.getItem('verity_teacher_nav_indicator_top');
      const savedHeight = sessionStorage.getItem('verity_teacher_nav_indicator_height');
      if (savedTop !== null && !isNaN(Number(savedTop))) {
        return {
          top: Number(savedTop),
          height: savedHeight ? Number(savedHeight) : 42,
          opacity: 1,
          transition: true
        };
      }
    } catch { /* ignore */ }
    return { top: 0, height: 42, opacity: 0, transition: false };
  });

// Load saved classrooms from localStorage so they survive a refresh.
  const [classrooms, setClassrooms] = useState(() => {
    try {
      const key = getStorageKey(currentUser);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(c => !isPhantomClassroom(c));
          const taken = new Set();
          return valid.map(c => {
            let code = (c.code || '').toString().trim().toLowerCase();
            if (!code || taken.has(code)) {
              code = generateClassCode(taken);
            }
            taken.add(code);
            return { ...c, code };
          });
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // Show skeleton only when there's no cached data yet.
  const [loadingClassrooms, setLoadingClassrooms] = useState(
    () => !localStorage.getItem(getStorageKey(currentUser))
  );

  const [allowDelete, setAllowDelete] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`)
      .then(res => res.json())
      .then(d => {
        if (!active) return;
        const config = d.settings?.global_config || d.settings || {};
        if (config.roles && typeof config.roles.allowDeleteCourses !== 'undefined') {
          setAllowDelete(config.roles.allowDeleteCourses);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Fetch real classrooms from backend server strictly for this teacher
  useEffect(() => {
    let active = true;
    const fetchClassrooms = async () => {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL}/classrooms`);
        if (res.ok && active) {
          const data = await res.json();
          const serverList = (Array.isArray(data) ? data : (data.classrooms || [])).filter(c => !isPhantomClassroom(c));
          // Filter strictly for this teacher
          const teacherClasses = serverList.filter(c => {
            const hasEmail = c.instructor_email || c.instructorEmail;
            if (hasEmail) {
              const emailStr = (c.instructor_email || c.instructorEmail).toLowerCase();
              return currentUser?.email && emailStr === currentUser.email.toLowerCase();
            }
            const nameStr = (c.instructor || '').toLowerCase();
            return (currentUser?.name && nameStr && nameStr === currentUser.name.toLowerCase()) || !nameStr;
          });
          setClassrooms(teacherClasses);
          try {
            localStorage.setItem(getStorageKey(currentUser), JSON.stringify(teacherClasses));
          } catch {}
        }
      } catch {} finally {
        if (active) setLoadingClassrooms(false);
      }
    };
    fetchClassrooms();
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
    return () => window.removeEventListener('verity:banner-updated', handleBannerUpdate);
  }, []);

  // Persist classrooms whenever they change — locally (survives refresh) and to
  // the backend (so the Admin dashboard can count them server-wide).
  useEffect(() => {
    const key = getStorageKey(currentUser);
    localStorage.setItem(key, JSON.stringify(classrooms));
    const withInstructor = classrooms.map(c => ({
      ...c,
      instructor: c.instructor || currentUser?.name || 'Instructor',
      instructorEmail: c.instructorEmail || c.instructor_email || currentUser?.email || ''
    }));
    apiFetch(`${import.meta.env.VITE_API_URL}/classrooms`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classrooms: withInstructor })
    }).catch(() => { /* offline — localStorage copy still holds */ });
  }, [classrooms, currentUser]);

  const [activeMenu, setActiveMenu] = useState(null);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [settingsClassroom, setSettingsClassroom] = useState(null);

  const VIEW_ORDER = { 'classrooms': 0, 'calendar': 1, 'archived': 2, 'settings': 3, 'classroomSettings': 3 };

  const handleSetView = (view) => {
    const currentIdx = VIEW_ORDER[activeView] ?? 0;
    const nextIdx = VIEW_ORDER[view] ?? 0;
    setSlideDirection(nextIdx >= currentIdx ? 1 : -1);
    setActiveView(view);
    localStorage.setItem('verity_teacher_view', view);
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

  const getViewTitle = (view) => {
    switch (view) {
      case 'calendar': return 'Calendar';
      case 'archived': return 'Archived';
      case 'settings': return 'Settings';
      case 'classroomSettings': return settingsClassroom ? `${settingsClassroom.name} Settings` : 'Classroom Settings';
      default: return 'Home';
    }
  };

  const navItems = [
    { id: 'classrooms', Icon: Home, label: 'Home' },
    { id: 'calendar', Icon: Calendar, label: 'Calendar' },
    { id: 'archived', Icon: Archive, label: 'Archived' },
  ];


  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState(null);
  const [newClass, setNewClass] = useState({ name: '', section: '', subject: '', code: '' });
  const [nameFocused, setNameFocused] = useState(false);
  const [sectionFocused, setSectionFocused] = useState(false);
  const [subjectFocused, setSubjectFocused] = useState(false);

  const handleOpenCreateModal = () => {
    setNewClass({
      name: '',
      section: '',
      subject: '',
      code: ''
    });
    setIsModalOpen(true);
  };

  const toggleMenu = (e, id) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === id ? null : id);
  };
  const handleArchiveClass = (e, id) => {
    if (e) e.stopPropagation();
    setClassrooms(classrooms.map(c => c.id === id ? { ...c, archived: true } : c));
    setActiveMenu(null);
  };
  const handleUnarchiveClass = (e, id) => {
    if (e) e.stopPropagation();
    setClassrooms(classrooms.map(c => c.id === id ? { ...c, archived: false } : c));
    setActiveMenu(null);
  };
  const handleDeleteClass = (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this classroom?")) {
      setClassrooms(classrooms.filter(c => c.id !== id));
      apiFetch(`${import.meta.env.VITE_API_URL}/classrooms/${id}`, {
        method: 'DELETE'
      }).catch(() => {});
    }
    setActiveMenu(null);
  };

  const handleCreateClass = (e) => {
    e.preventDefault();
    const finalCode = newClass.code || generateClassCode(classrooms);
    // Add the new class to the grid
    const newClassroom = {
      id: Date.now(),
      code: finalCode,
      section: newClass.section || "N/A",
      name: newClass.name,
      subject: newClass.subject,
      instructor: currentUser?.name || 'Instructor',
      instructorEmail: currentUser?.email || ''
    };

    setClassrooms([newClassroom, ...classrooms]);
    setIsModalOpen(false); // Close the modal
    setNewClass({ name: '', section: '', subject: '', code: '' }); // Reset form
  };



  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: isFadingOut ? 0 : 1 }} 
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        minHeight: '100vh',
        backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ═══ GLOBAL TOP HEADER (Copied from Student) ═══ */}
      <header 
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px clamp(20px, 3vw, 48px)',
        backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
        borderBottom: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: 0,
          right: 0,
          height: '30px',
          background: `linear-gradient(to bottom, ${isDark ? '#1a1a1a' : '#f8f9fa'}, transparent)`,
          pointerEvents: 'none'
        }} />

        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }} onClick={() => handleSetView('classrooms')}>
          <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
          <span style={{ color: isDark ? '#f5f5f5' : '#111827', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
          <span style={{ fontSize: '0.7rem', color: isDark ? '#a3a3a3' : '#6b7280', marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructor</span>
        </div>

        {/* Center: Navigation */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '8px',
          opacity: isHeaderHovered ? 1 : 0,
          pointerEvents: isHeaderHovered ? 'auto' : 'none',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          transform: isHeaderHovered ? 'translateY(0)' : 'translateY(-10px)',
          position: 'relative'
        }}>
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
                  color: active ? '#10b981' : (isDark ? '#a3a3a3' : '#6b7280'),
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
              color: isDark ? '#a3a3a3' : '#6b7280',
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
          <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
        padding: '32px clamp(20px, 3vw, 48px)',
        maxWidth: '100%',
        margin: 0,
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <AnimatePresence mode="wait" custom={slideDirection}>
          {activeView === 'calendar' && (
            <motion.div key="calendar" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <TeacherCalendar classrooms={classrooms} />
            </motion.div>
          )}

          {activeView === 'archived' && (
            <motion.div key="archived" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', padding: '0 10px' }}>
                <h2 style={{ color: isDark ? '#E8EAED' : '#4b5563', margin: 0 }}>Archived Classrooms</h2>
              </div>

              {classrooms.filter(c => c.archived).length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}>
                  <h3 style={{ margin: 0, color: isDark ? '#a3a3a3' : '#6b7280' }}>No Archived Classrooms</h3>
                  <p style={{ marginTop: '10px', color: isDark ? '#6b7280' : '#9ca3af' }}>Classrooms you archive will appear here.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)', gap: '24px' }}>
                  {classrooms.filter(c => c.archived).map((cls, idx) => (
                    <TeacherCourseCard
                      key={cls.id}
                      classroom={cls}
                      index={idx}
                      onClick={onEnterClassroom}
                      onUnarchive={handleUnarchiveClass}
                      onDelete={(allowDelete || currentUser?.role === 'Admin') ? handleDeleteClass : undefined}
                      isArchived={true}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div key="settings" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <SettingsPanel role="Instructor" />
            </motion.div>
          )}

          {activeView === 'classroomSettings' && settingsClassroom && (
            <motion.div key="classroomSettings" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <ClassroomSettings
                classroom={settingsClassroom}
                onClose={() => { setSettingsClassroom(null); handleSetView('classrooms'); }}
                onUpdate={(updated) => {
                  setClassrooms(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
                  setSettingsClassroom(updated);
                }}
              />
            </motion.div>
          )}

          {activeView === 'classrooms' && (
            <motion.div key="classrooms" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', padding: '0 10px' }}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleOpenCreateModal}
                  style={{
                    padding: '12px 24px', backgroundColor: '#10b981', color: '#ffffff',
                    border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold',
                    cursor: 'pointer', boxShadow: '0 8px 20px rgba(16,185,129,0.3)'
                  }}
                >
                  Create
                </motion.button>
              </div>

              {/* Classroom Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
                gap: '24px'
              }}>
                {loadingClassrooms
                  ? Array.from({ length: 4 }).map((_, i) => <Skeleton.Card key={i} />)
                  : classrooms.filter(c => !c.archived).length === 0 ? (
                    <div style={{
                      gridColumn: '1 / -1',
                      padding: '50px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                      borderRadius: '20px',
                      border: isDark ? '1.5px dashed #404040' : '1.5px dashed #cbd5e1'
                    }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        backgroundColor: isDark ? '#262626' : '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '14px'
                      }}>
                        <Home size={28} color="#10b981" />
                      </div>
                      <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: '700', color: isDark ? '#f5f5f5' : '#1e293b' }}>
                        No Classrooms Yet
                      </h3>
                      <p style={{ margin: '0 0 16px', maxWidth: '380px', fontSize: '0.88rem', color: isDark ? '#a3a3a3' : '#64748b' }}>
                        Click <strong>Create</strong> above to create your first classroom.
                      </p>
                    </div>
                  ) : classrooms.filter(c => !c.archived).map((cls, idx) => (
                    <TeacherCourseCard
                      key={cls.id}
                      classroom={cls}
                      index={idx}
                      onClick={onEnterClassroom}
                      onArchive={handleArchiveClass}
                      onSettings={(c) => {
                        setSettingsClassroom(c);
                        handleSetView('classroomSettings');
                      }}
                      onDelete={(allowDelete || currentUser?.role === 'Admin') ? handleDeleteClass : undefined}
                      isArchived={false}
                      initial={{ opacity: 0, y: 20, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.35, delay: idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
                    />
                ))}
              </div>
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
          zIndex: 60
        }}>
          {[...navItems, { id: 'settings', Icon: Settings, label: 'Settings' }].map(({ id, Icon, label }) => {
            const active = activeView === id || (id === 'settings' && activeView === 'classroomSettings');
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

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
          }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                backgroundColor: isDark ? '#1e1e1e' : '#fff',
                padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '400px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              }}
            >
              <h2 style={{ margin: '0 0 24px', color: isDark ? '#fff' : '#111827', fontSize: '1.5rem', fontWeight: 'bold' }}>Create Class</h2>
              <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#a3a3a3' : '#4b5563' }}>Class Name (Required)</label>
                  <input
                    type="text"
                    value={newClass.name}
                    onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                    required
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      border: `2px solid ${nameFocused ? '#10b981' : (isDark ? '#404040' : '#e5e7eb')}`,
                      backgroundColor: isDark ? '#262626' : '#f9fafb', color: isDark ? '#fff' : '#111827',
                      outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                    }}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    placeholder="e.g., AP Computer Science"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#a3a3a3' : '#4b5563' }}>Section (Optional)</label>
                  <input
                    type="text"
                    value={newClass.section}
                    onChange={(e) => setNewClass({ ...newClass, section: e.target.value })}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      border: `2px solid ${sectionFocused ? '#10b981' : (isDark ? '#404040' : '#e5e7eb')}`,
                      backgroundColor: isDark ? '#262626' : '#f9fafb', color: isDark ? '#fff' : '#111827',
                      outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                    }}
                    onFocus={() => setSectionFocused(true)}
                    onBlur={() => setSectionFocused(false)}
                    placeholder="e.g., Room 204"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#a3a3a3' : '#4b5563' }}>Subject (Optional)</label>
                  <input
                    type="text"
                    value={newClass.subject}
                    onChange={(e) => setNewClass({ ...newClass, subject: e.target.value })}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      border: `2px solid ${subjectFocused ? '#10b981' : (isDark ? '#404040' : '#e5e7eb')}`,
                      backgroundColor: isDark ? '#262626' : '#f9fafb', color: isDark ? '#fff' : '#111827',
                      outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                    }}
                    onFocus={() => setSubjectFocused(true)}
                    onBlur={() => setSubjectFocused(false)}
                    placeholder="e.g., Programming"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                  <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: 'transparent', color: isDark ? '#a3a3a3' : '#6b7280', fontWeight: '600', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}