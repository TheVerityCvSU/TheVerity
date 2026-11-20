import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '../data/api';
import {
  isPhantomClassroom,
  sortClassroomsAlphabetically,
  isClassroomArchived
} from '../utils/classroomList';
import {
  getCachedClassrooms,
  saveCachedClassrooms
} from '../data/classroomCache';
import { getThemeStorageKeys } from '../data/classroomTheme';

const getStudentLocalArchivedKey = (user) => `verity_student_local_archived_${user?.id || user?.email || 'anon'}`;

const readStudentLocalArchivedSet = (user) => {
  try {
    const raw = localStorage.getItem(getStudentLocalArchivedKey(user));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
};

const writeStudentLocalArchivedSet = (user, idSet) => {
  try {
    localStorage.setItem(getStudentLocalArchivedKey(user), JSON.stringify(Array.from(idSet)));
  } catch {}
};

export function useStudentClassrooms({ currentUser, socket }) {
  const [classrooms, setClassrooms] = useState(() => {
    return sortClassroomsAlphabetically(
      getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c))
    );
  });

  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [archiveClassConfirm, setArchiveClassConfirm] = useState(null);

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
  const fetchEnrolledClassrooms = useCallback(async () => {
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/classrooms`);
      if (!res.ok) return;
      const data = await res.json();
      const serverList = (Array.isArray(data) ? data : (data.classrooms || [])).filter(c => c && c.name && !isPhantomClassroom(c));

      if (serverList.length === 0) {
        const cached = getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c));
        if (cached.length > 0) return;
      }

      const sortedList = sortClassroomsAlphabetically(serverList);
      const localArchivedSet = readStudentLocalArchivedSet(currentUser);

      setClassrooms(prev => {
        const serverIds = new Set(sortedList.map(c => String(c.id)));
        const preserved = (prev || []).filter(c => c && c.id && !serverIds.has(String(c.id)) && !isPhantomClassroom(c));
        const combined = sortClassroomsAlphabetically([...sortedList, ...preserved]);
        const merged = combined.map(c => {
          const isFromServer = serverIds.has(String(c.id));
          const archivedByTeacher = isFromServer ? isClassroomArchived(c) : Boolean(c.archivedByTeacher);
          const localStudentArchived = localArchivedSet.has(String(c.id));
          return {
            ...c,
            archivedByTeacher,
            localStudentArchived,
            archived: archivedByTeacher || localStudentArchived
          };
        });
        saveCachedClassrooms(merged, currentUser, 'student');
        if (window.electronAPI?.localDB?.cacheClassrooms) {
          window.electronAPI.localDB.cacheClassrooms(merged).catch(() => {});
        }
        return merged;
      });
    } catch (_) {}
  }, [currentUser]);

  useEffect(() => {
    let active = true;
    fetchEnrolledClassrooms().finally(() => {
      setTimeout(() => {
        if (active) setLoadingClassrooms(false);
      }, 350);
    });
    return () => { active = false; };
  }, [fetchEnrolledClassrooms]);

  // Real-time banner and archive updates
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

    const handleClassroomArchived = (e) => {
      const detail = e?.detail;
      if (!detail) return;
      const targetId = detail.classroomId ?? detail.id;
      if (targetId == null) return;
      const archivedByTeacher = Boolean(detail.archived);
      setClassrooms(prev => {
        const updated = prev.map(c => {
          if (String(c.id) !== String(targetId)) return c;
          const localArchived = Boolean(c.localStudentArchived);
          return { ...c, archivedByTeacher, archived: archivedByTeacher || localArchived };
        });
        saveCachedClassrooms(updated, currentUser, 'student');
        return updated;
      });
    };

    const handleClassroomUpdated = (e) => {
      const incoming = e?.detail?.classroom;
      if (!incoming || incoming.id == null) return;
      setClassrooms(prev => {
        const updated = sortClassroomsAlphabetically(
          prev.map(c => (String(c.id) === String(incoming.id) ? { ...c, ...incoming } : c))
        );
        saveCachedClassrooms(updated, currentUser, 'student');
        return updated;
      });
    };

    const handleClassroomsChanged = () => {
      fetchEnrolledClassrooms();
    };

    window.addEventListener('verity:banner-updated', handleBannerUpdate);
    window.addEventListener('verity:classroom-archived', handleClassroomArchived);
    window.addEventListener('verity:classroom-updated', handleClassroomUpdated);
    window.addEventListener('verity:classrooms-changed', handleClassroomsChanged);
    window.addEventListener('verity:sync-completed', handleClassroomsChanged);
    if (socket) {
      socket.on('classroom_theme_changed', (data) => handleBannerUpdate({ detail: data }));
    }
    return () => {
      window.removeEventListener('verity:banner-updated', handleBannerUpdate);
      window.removeEventListener('verity:classroom-archived', handleClassroomArchived);
      window.removeEventListener('verity:classroom-updated', handleClassroomUpdated);
      window.removeEventListener('verity:classrooms-changed', handleClassroomsChanged);
      window.removeEventListener('verity:sync-completed', handleClassroomsChanged);
      if (socket) {
        socket.off('classroom_theme_changed');
      }
    };
  }, [socket, currentUser, fetchEnrolledClassrooms]);

  const handleArchiveClass = useCallback((targetClassroom) => {
    const targetId = typeof targetClassroom === 'object' ? targetClassroom?.id : targetClassroom;
    if (!targetId) return;
    const match = typeof targetClassroom === 'object' && targetClassroom?.name
      ? targetClassroom
      : classrooms.find(c => String(c.id) === String(targetId));
    setArchiveClassConfirm({
      id: targetId,
      name: match?.name || 'this course'
    });
  }, [classrooms]);

  const handleExecuteArchiveClass = useCallback(() => {
    if (!archiveClassConfirm) return;
    const targetId = archiveClassConfirm.id;
    const localSet = readStudentLocalArchivedSet(currentUser);
    localSet.add(String(targetId));
    writeStudentLocalArchivedSet(currentUser, localSet);

    setClassrooms(prev => {
      const updated = prev.map(c => (String(c.id) === String(targetId)
        ? { ...c, localStudentArchived: true, archived: true }
        : c));
      saveCachedClassrooms(updated, currentUser, 'student');
      return updated;
    });
    setArchiveClassConfirm(null);
  }, [archiveClassConfirm, currentUser]);

  const handleUnarchiveClass = useCallback((targetClassroom) => {
    const targetId = typeof targetClassroom === 'object' ? targetClassroom.id : targetClassroom;
    if (!targetId) return;
    const localSet = readStudentLocalArchivedSet(currentUser);
    localSet.delete(String(targetId));
    writeStudentLocalArchivedSet(currentUser, localSet);

    setClassrooms(prev => {
      const updated = prev.map(c => {
        if (String(c.id) !== String(targetId)) return c;
        const archivedByTeacher = Boolean(c.archivedByTeacher);
        return { ...c, localStudentArchived: false, archived: archivedByTeacher };
      });
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
    archiveClassConfirm,
    setArchiveClassConfirm,
    handleArchiveClass,
    handleExecuteArchiveClass,
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

