import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '../data/api';
import {
  isPhantomClassroom,
  generateClassCode,
  sortClassroomsAlphabetically
} from '../utils/classroomList';
import {
  getCachedClassrooms,
  saveCachedClassrooms
} from '../data/classroomCache';

export function useTeacherClassrooms({ currentUser, socket }) {
  const [classrooms, setClassrooms] = useState(() => {
    try {
      const parsed = getCachedClassrooms(currentUser, 'teacher');
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(c => !isPhantomClassroom(c));
        const taken = new Set();
        const mapped = valid.map(c => {
          let code = (c.code || '').toString().trim().toLowerCase();
          if (!code || taken.has(code)) {
            code = generateClassCode(taken);
          }
          taken.add(code);
          return { ...c, code };
        });
        return sortClassroomsAlphabetically(mapped);
      }
      return [];
    } catch {
      return [];
    }
  });

  const [loadingClassrooms, setLoadingClassrooms] = useState(
    () => getCachedClassrooms(currentUser, 'teacher').length === 0
  );
  const [activeClassroomCounts, setActiveClassroomCounts] = useState({});
  const [allowDelete, setAllowDelete] = useState(false);
  const [deleteClassConfirm, setDeleteClassConfirm] = useState(null);

  // Real-time active activities tracking per classroom
  useEffect(() => {
    const handleActiveUpdate = (data) => {
      if (data && data.classroomCounts) {
        setActiveClassroomCounts(data.classroomCounts);
      }
    };

    if (socket) {
      socket.on('active_activities_update', handleActiveUpdate);
      socket.emit('get_active_activities');
    }

    const fetchActive = () => {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/active-activities`;
      apiFetch(url)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.classroomCounts) {
            setActiveClassroomCounts(data.classroomCounts);
          }
        })
        .catch(() => {});
    };

    fetchActive();
    const activeInterval = setInterval(fetchActive, 4000);

    return () => {
      if (socket) {
        socket.off('active_activities_update', handleActiveUpdate);
      }
      clearInterval(activeInterval);
    };
  }, [socket]);

  // Check system setting for course deletion permissions
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
          if (serverList.length === 0) {
            const cached = getCachedClassrooms(currentUser, 'teacher').filter(c => !isPhantomClassroom(c));
            if (cached.length > 0) return;
          }
          const userEmail = (currentUser?.email || '').trim().toLowerCase();
          const curName = (currentUser?.name || '').trim().toLowerCase();
          const isUserAdmin = String(currentUser?.role || '').toLowerCase() === 'admin';

          const teacherClasses = serverList.filter(c => {
            if (isUserAdmin) return true;
            const emailStr = (c.instructor_email || c.instructorEmail || '').toLowerCase();
            const emailList = emailStr.split(/[\s,]+/).filter(Boolean);
            const matchesEmail = Boolean(userEmail && (emailStr === userEmail || emailList.includes(userEmail) || emailStr.includes(userEmail)));
            const nameStr = (c.instructor || '').trim().toLowerCase();
            const matchesName = Boolean(curName && (nameStr === curName || nameStr.includes(curName)));
            return matchesEmail || matchesName || (!emailStr && !nameStr);
          });
          const sortedTeacherClasses = sortClassroomsAlphabetically(teacherClasses);
          setClassrooms(prev => {
            const serverIds = new Set(sortedTeacherClasses.map(c => String(c.id)));
            const offlineClasses = (prev || []).filter(c => c && c.id && !serverIds.has(String(c.id)) && !isPhantomClassroom(c));
            const archivedMap = new Map((prev || []).map(p => [String(p.id), !!p.archived]));

            const merged = sortClassroomsAlphabetically([...sortedTeacherClasses, ...offlineClasses]).map(c => ({
              ...c,
              archived: archivedMap.has(String(c.id)) ? archivedMap.get(String(c.id)) : !!c.archived
            }));

            if (offlineClasses.length > 0) {
              const withInstructor = merged.map(c => ({
                ...c,
                instructor: c.instructor || currentUser?.name || 'Instructor',
                instructorEmail: c.instructorEmail || c.instructor_email || currentUser?.email || ''
              }));
              apiFetch(`${import.meta.env.VITE_API_URL}/classrooms`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classrooms: withInstructor })
              }).catch(() => {});
            }

            saveCachedClassrooms(merged, currentUser, 'teacher');
            return merged;
          });
        }
      } catch (_) {
      } finally {
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

  // Persist classrooms to cache and server
  useEffect(() => {
    saveCachedClassrooms(classrooms, currentUser, 'teacher');
    if (!classrooms || classrooms.length === 0) return;
    const withInstructor = classrooms.map(c => ({
      ...c,
      instructor: c.instructor || currentUser?.name || 'Instructor',
      instructorEmail: c.instructorEmail || c.instructor_email || currentUser?.email || ''
    }));
    apiFetch(`${import.meta.env.VITE_API_URL}/classrooms`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classrooms: withInstructor })
    }).catch(() => {});
  }, [classrooms, currentUser]);

  const handleArchiveClass = useCallback((e, id) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const targetId = id != null ? id : (e && typeof e === 'object' && e.id != null ? e.id : e);
    setClassrooms(prev => {
      const updated = prev.map(c => String(c.id) === String(targetId) ? { ...c, archived: true } : c);
      saveCachedClassrooms(updated, currentUser, 'teacher');
      return updated;
    });
  }, [currentUser]);

  const handleUnarchiveClass = useCallback((e, id) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const targetId = id != null ? id : (e && typeof e === 'object' && e.id != null ? e.id : e);
    setClassrooms(prev => {
      const updated = prev.map(c => String(c.id) === String(targetId) ? { ...c, archived: false } : c);
      saveCachedClassrooms(updated, currentUser, 'teacher');
      return updated;
    });
  }, [currentUser]);

  const handleDeleteClass = useCallback((e, id) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const targetId = id != null ? id : (e && typeof e === 'object' && e.id != null ? e.id : e);
    if (!targetId) return;
    const target = classrooms.find(c => String(c.id) === String(targetId));
    setDeleteClassConfirm({
      id: targetId,
      name: target?.name || 'this classroom'
    });
  }, [classrooms]);

  const handleExecuteDeleteClass = useCallback(() => {
    if (!deleteClassConfirm) return;
    const targetId = deleteClassConfirm.id;
    setClassrooms(prev => prev.filter(c => String(c.id) !== String(targetId)));
    apiFetch(`${import.meta.env.VITE_API_URL}/classrooms/${targetId}`, {
      method: 'DELETE'
    }).catch(() => {});
    setDeleteClassConfirm(null);
  }, [deleteClassConfirm]);

  const handleCreateClass = useCallback((newClass) => {
    const finalCode = newClass.code || generateClassCode(classrooms);
    const newClassroom = {
      id: Date.now(),
      code: finalCode,
      section: newClass.section || "N/A",
      name: newClass.name,
      subject: newClass.subject,
      instructor: currentUser?.name || 'Instructor',
      instructorEmail: currentUser?.email || ''
    };
    setClassrooms(prev => sortClassroomsAlphabetically([newClassroom, ...prev]));
  }, [classrooms, currentUser]);

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
    activeClassroomCounts,
    allowDelete,
    deleteClassConfirm,
    setDeleteClassConfirm,
    handleArchiveClass,
    handleUnarchiveClass,
    handleDeleteClass,
    handleExecuteDeleteClass,
    handleCreateClass,
    activeClassrooms,
    archivedClassrooms,
  };
}

