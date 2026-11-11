import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '../data/api';
import {
  isPhantomClassroom,
  sortClassroomsAlphabetically
} from '../utils/classroomList';
import {
  getCachedClassrooms,
  saveCachedClassrooms
} from '../data/classroomCache';
import { getThemeStorageKeys } from '../data/classroomTheme';

export function useStudentClassrooms({ currentUser, socket }) {
  const [classrooms, setClassrooms] = useState(() => {
    return sortClassroomsAlphabetically(
      getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c))
    );
  });

  const [loadingClassrooms, setLoadingClassrooms] = useState(
    () => getCachedClassrooms(currentUser, 'student').length === 0
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Sync cache on user change
  useEffect(() => {
    const cached = sortClassroomsAlphabetically(
      getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c))
    );
    setClassrooms(cached);
  }, [currentUser]);

  useEffect(() => {
    saveCachedClassrooms(classrooms, currentUser, 'student');
  }, [classrooms, currentUser]);

  // Fetch enrolled classrooms from server
  useEffect(() => {
    let active = true;
    const fetchEnrolledClassrooms = async () => {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/classrooms`);
        if (res.ok && active) {
          const data = await res.json();
          const serverList = (Array.isArray(data) ? data : (data.classrooms || [])).filter(c => c && c.name && !isPhantomClassroom(c));

          if (serverList.length === 0) {
            const cached = getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c));
            if (cached.length > 0) return;
          }

          const sortedList = sortClassroomsAlphabetically(serverList);
          setClassrooms(prev => {
            const serverIds = new Set(sortedList.map(c => String(c.id)));
            const preserved = (prev || []).filter(c => c && c.id && !serverIds.has(String(c.id)) && !isPhantomClassroom(c));
            const archivedMap = new Map((prev || []).map(p => [String(p.id), !!p.archived]));
            const combined = sortClassroomsAlphabetically([...sortedList, ...preserved]);
            const merged = combined.map(c => ({
              ...c,
              archived: archivedMap.has(String(c.id)) ? archivedMap.get(String(c.id)) : !!c.archived
            }));
            saveCachedClassrooms(merged, currentUser, 'student');
            return merged;
          });
        }
      } catch (_) {
      } finally {
        if (active) setLoadingClassrooms(false);
      }
    };
    fetchEnrolledClassrooms();
    return () => { active = false; };
  }, [currentUser]);

  // Real-time banner updates
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

  const handleArchiveClass = useCallback((targetClassroom) => {
    const targetId = typeof targetClassroom === 'object' ? targetClassroom.id : targetClassroom;
    setClassrooms(prev => {
      const updated = prev.map(c => (String(c.id) === String(targetId) ? { ...c, archived: true } : c));
      saveCachedClassrooms(updated, currentUser, 'student');
      return updated;
    });
  }, [currentUser]);

  const handleUnarchiveClass = useCallback((targetClassroom) => {
    const targetId = typeof targetClassroom === 'object' ? targetClassroom.id : targetClassroom;
    setClassrooms(prev => {
      const updated = prev.map(c => (String(c.id) === String(targetId) ? { ...c, archived: false } : c));
      saveCachedClassrooms(updated, currentUser, 'student');
      return updated;
    });
  }, [currentUser]);

  const handleJoinClass = useCallback(async (e) => {
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
  }, [classCode, classrooms, currentUser]);

  const activeClassrooms = useMemo(() => {
    return sortClassroomsAlphabetically(classrooms.filter(c => !c.archived));
  }, [classrooms]);

  const archivedClassrooms = useMemo(() => {
    return sortClassroomsAlphabetically(classrooms.filter(c => c.archived));
  }, [classrooms]);

  return {
    classrooms,
    setClassrooms,
    loadingClassrooms,
    activeClassrooms,
    archivedClassrooms,
    handleArchiveClass,
    handleUnarchiveClass,
    isModalOpen,
    setIsModalOpen,
    classCode,
    setClassCode,
    joinError,
    setJoinError,
    isJoining,
    handleJoinClass,
  };
}

