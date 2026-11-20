import { useState, useEffect, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { apiFetch, getLocalApiUrl, getCloudUrl, getConnectionStatus } from '../data/api';
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

  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [activeClassroomCounts, setActiveClassroomCounts] = useState({});
  const [allowDelete, setAllowDelete] = useState(false);
  const [deleteClassConfirm, setDeleteClassConfirm] = useState(null);
  const [archiveClassConfirm, setArchiveClassConfirm] = useState(null);

  // Real-time active activities tracking per classroom
  useEffect(() => {
    let isSubscribed = true;
    let secSocket = null;
    const sourceRef = { primary: {}, secondary: {}, liveStudents: {} };

    const recompute = () => {
      if (!isSubscribed) return;
      const merged = {};
      const keys = new Set([
        ...Object.keys(sourceRef.primary || {}),
        ...Object.keys(sourceRef.secondary || {})
      ]);
      for (const k of keys) {
        const val = Math.max(
          Number(sourceRef.primary?.[k] || 0),
          Number(sourceRef.secondary?.[k] || 0)
        );
        if (val > 0) merged[k] = val;
      }

      const now = Date.now();
      const liveByClass = {};
      for (const [sKey, info] of Object.entries(sourceRef.liveStudents)) {
        if (!info || now - info.ts > 20000) {
          delete sourceRef.liveStudents[sKey];
          continue;
        }
        if (info.classroomId && info.classroomId !== 'none') {
          const cId = String(info.classroomId);
          liveByClass[cId] = (liveByClass[cId] || 0) + 1;
          liveByClass[cId.toLowerCase()] = (liveByClass[cId.toLowerCase()] || 0) + 1;
        }
        if (info.classCode) {
          const code = String(info.classCode);
          liveByClass[code] = (liveByClass[code] || 0) + 1;
          liveByClass[code.toLowerCase()] = (liveByClass[code.toLowerCase()] || 0) + 1;
        }
      }
      for (const [cId, count] of Object.entries(liveByClass)) {
        merged[cId] = Math.max(Number(merged[cId] || 0), count);
      }

      setActiveClassroomCounts(merged);
    };

    const handlePrimaryUpdate = (data) => {
      if (data && data.classroomCounts) {
        sourceRef.primary = data.classroomCounts;
        recompute();
      }
    };

    const handleSecondaryUpdate = (data) => {
      if (data && data.classroomCounts) {
        sourceRef.secondary = data.classroomCounts;
        recompute();
      }
    };

    const handleStudentUpdate = (data) => {
      if (!data || !data.assignmentId || data.assignmentId === 'none' || data.assignmentId === 'unassigned') return;
      if (data.isLive === false || data.status === 'Offline' || data.status === 'Submitted') return;
      const sId = String(data.studentId || data.id || data.name || data.studentName || '');
      if (!sId) return;
      sourceRef.liveStudents[`${sId}_${data.assignmentId}`] = {
        classroomId: String(data.classroomId || ''),
        classCode: String(data.classCode || ''),
        ts: Date.now()
      };
      recompute();
    };

    const handleStudentLeft = (data) => {
      if (!data) return;
      const sId = String(data.studentId || data.id || data.name || data.studentName || '');
      if (sId) {
        for (const key of Object.keys(sourceRef.liveStudents)) {
          if (key.startsWith(`${sId}_`)) delete sourceRef.liveStudents[key];
        }
      }
      if (socket) socket.emit('get_active_activities');
      if (secSocket && secSocket.connected) secSocket.emit('get_active_activities');
      recompute();
    };

    if (socket) {
      socket.on('active_activities_update', handlePrimaryUpdate);
      socket.on('teacher_student_update', handleStudentUpdate);
      socket.on('teacher_student_left', handleStudentLeft);
      socket.on('teacher_student_submitted', handleStudentLeft);
      socket.emit('get_active_activities');
    }

    try {
      const conn = getConnectionStatus();
      const localUrl = getLocalApiUrl();
      const cloudUrl = getCloudUrl();
      const primaryUri = socket?.io?.uri || '';

      let altTarget = null;
      if (primaryUri.includes('localhost') || primaryUri.includes('127.0.0.1') || primaryUri.includes('192.168.')) {
        if (conn.isOnline && cloudUrl && !cloudUrl.includes('localhost') && !cloudUrl.includes('127.0.0.1')) {
          altTarget = cloudUrl;
        }
      } else {
        if (!conn.isWebHosted && localUrl && !localUrl.includes('verity-2z4v')) {
          altTarget = localUrl;
        }
      }

      if (altTarget && altTarget !== primaryUri) {
        secSocket = io(altTarget, {
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          timeout: 5000,
          transports: ['websocket', 'polling'],
          auth: (cb) => {
            const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
            cb({ token });
          }
        });
        secSocket.on('connect', () => {
          const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
          secSocket.emit('authenticate', { token });
          secSocket.emit('get_active_activities');
        });
        secSocket.on('active_activities_update', handleSecondaryUpdate);
        secSocket.on('teacher_student_update', handleStudentUpdate);
        secSocket.on('teacher_student_left', handleStudentLeft);
        secSocket.on('teacher_student_submitted', handleStudentLeft);
      }
    } catch (_) {}

    const fetchActive = () => {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/active-activities`;
      apiFetch(url)
        .then(res => (res && res.ok ? res.json() : null))
        .then(data => {
          if (data && data.classroomCounts) {
            sourceRef.primary = data.classroomCounts;
            recompute();
          }
        })
        .catch(() => {});

      try {
        const conn = getConnectionStatus();
        const localUrl = getLocalApiUrl();
        if (!conn.isWebHosted && localUrl && !localUrl.includes('verity-2z4v')) {
          const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
          fetch(`${localUrl}/active-activities`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          })
            .then(r => (r && r.ok ? r.json() : null))
            .then(data => {
              if (data && data.classroomCounts) {
                sourceRef.secondary = data.classroomCounts;
                recompute();
              }
            })
            .catch(() => {});
        }
      } catch (_) {}
    };

    fetchActive();
    const activeInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchActive();
    }, 20000);

    return () => {
      isSubscribed = false;
      if (socket) {
        socket.off('active_activities_update', handlePrimaryUpdate);
        socket.off('teacher_student_update', handleStudentUpdate);
        socket.off('teacher_student_left', handleStudentLeft);
        socket.off('teacher_student_submitted', handleStudentLeft);
      }
      if (secSocket) {
        try {
          secSocket.off('active_activities_update', handleSecondaryUpdate);
          secSocket.off('teacher_student_update', handleStudentUpdate);
          secSocket.off('teacher_student_left', handleStudentLeft);
          secSocket.off('teacher_student_submitted', handleStudentLeft);
          secSocket.disconnect();
        } catch (_) {}
      }
      clearInterval(activeInterval);
    };
  }, [socket]);

  // Check system setting for course deletion permissions (initial + real-time socket + focus/server-change)
  useEffect(() => {
    let active = true;
    const applySettings = (settingsObj) => {
      if (!active || !settingsObj) return;
      const config = settingsObj.global_config || settingsObj;
      if (config?.roles && typeof config.roles.allowDeleteCourses === 'boolean') {
        const nextAllowed = config.roles.allowDeleteCourses;
        setAllowDelete(nextAllowed);
        if (!nextAllowed) {
          setDeleteClassConfirm(null);
        }
      }
    };

    const fetchPermission = () => {
      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`)
        .then(res => (res.ok ? res.json() : null))
        .then(d => {
          if (d?.settings) applySettings(d.settings);
        })
        .catch(() => {});
    };

    fetchPermission();

    const handleSocketSettings = (payload) => {
      if (payload?.settings) applySettings(payload.settings);
      else fetchPermission();
    };
    const handleFocusOrServer = () => fetchPermission();

    if (socket) socket.on('system_settings_updated', handleSocketSettings);
    window.addEventListener('focus', handleFocusOrServer);
    window.addEventListener('verity:server-changed', handleFocusOrServer);
    window.addEventListener('verity:sync-completed', handleFocusOrServer);

    return () => {
      active = false;
      if (socket) socket.off('system_settings_updated', handleSocketSettings);
      window.removeEventListener('focus', handleFocusOrServer);
      window.removeEventListener('verity:server-changed', handleFocusOrServer);
      window.removeEventListener('verity:sync-completed', handleFocusOrServer);
    };
  }, [socket]);

  const skipNextPutRef = useRef(false);

  // Fetch real classrooms from backend server strictly for this teacher
  const fetchClassrooms = useCallback(async () => {
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL}/classrooms`);
      if (!res.ok) return;
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

        const normalizedServer = sortedTeacherClasses.map(c => ({
          ...c,
          archived: c.archived === true || Number(c.archived) === 1 || String(c.archived || '').toLowerCase() === 'true'
        }));
        const merged = sortClassroomsAlphabetically([...normalizedServer, ...offlineClasses]);

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

        skipNextPutRef.current = true;
        saveCachedClassrooms(merged, currentUser, 'teacher');
        return merged;
      });
    } catch (_) {}
  }, [currentUser]);

  useEffect(() => {
    let active = true;
    fetchClassrooms().finally(() => {
      setTimeout(() => {
        if (active) setLoadingClassrooms(false);
      }, 350);
    });
    return () => { active = false; };
  }, [fetchClassrooms]);

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

    const handleClassroomArchived = (e) => {
      const detail = e?.detail;
      if (!detail) return;
      const targetId = detail.classroomId ?? detail.id;
      if (targetId == null) return;
      const nextArchived = Boolean(detail.archived);
      skipNextPutRef.current = true;
      setClassrooms(prev => {
        const updated = prev.map(c => (String(c.id) === String(targetId) ? { ...c, archived: nextArchived } : c));
        saveCachedClassrooms(updated, currentUser, 'teacher');
        return updated;
      });
    };

    const handleClassroomUpdated = (e) => {
      const incoming = e?.detail?.classroom;
      if (!incoming || incoming.id == null) return;
      if (e?.detail?.persisted !== false) {
        skipNextPutRef.current = true;
      }
      setClassrooms(prev => {
        const updated = sortClassroomsAlphabetically(
          prev.map(c => (String(c.id) === String(incoming.id) ? { ...c, ...incoming } : c))
        );
        saveCachedClassrooms(updated, currentUser, 'teacher');
        return updated;
      });
    };

    const handleClassroomsChanged = () => {
      fetchClassrooms();
    };

    window.addEventListener('verity:banner-updated', handleBannerUpdate);
    window.addEventListener('verity:classroom-archived', handleClassroomArchived);
    window.addEventListener('verity:classroom-updated', handleClassroomUpdated);
    window.addEventListener('verity:classrooms-changed', handleClassroomsChanged);
    window.addEventListener('verity:sync-completed', handleClassroomsChanged);
    return () => {
      window.removeEventListener('verity:banner-updated', handleBannerUpdate);
      window.removeEventListener('verity:classroom-archived', handleClassroomArchived);
      window.removeEventListener('verity:classroom-updated', handleClassroomUpdated);
      window.removeEventListener('verity:classrooms-changed', handleClassroomsChanged);
      window.removeEventListener('verity:sync-completed', handleClassroomsChanged);
    };
  }, [currentUser, fetchClassrooms]);

  // Persist classrooms to cache and server
  useEffect(() => {
    saveCachedClassrooms(classrooms, currentUser, 'teacher');
    if (!classrooms || classrooms.length === 0) return;
    if (skipNextPutRef.current) {
      skipNextPutRef.current = false;
      return;
    }
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

  const updateArchiveState = useCallback((e, id, nextArchived) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const targetId = id != null ? id : (e && typeof e === 'object' && e.id != null ? e.id : e);
    if (!targetId) return;

    skipNextPutRef.current = true;
    setClassrooms(prev => {
      const updated = prev.map(c => String(c.id) === String(targetId) ? { ...c, archived: nextArchived } : c);
      saveCachedClassrooms(updated, currentUser, 'teacher');
      return updated;
    });

    window.dispatchEvent(new CustomEvent('verity:classroom-archived', {
      detail: { classroomId: targetId, archived: nextArchived }
    }));

    apiFetch(`${import.meta.env.VITE_API_URL}/classrooms/${targetId}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: nextArchived })
    }).catch(() => {});
  }, [currentUser]);

  const handleArchiveClass = useCallback((e, id) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const targetId = id != null ? id : (e && typeof e === 'object' && e.id != null ? e.id : e);
    if (!targetId) return;
    const target = classrooms.find(c => String(c.id) === String(targetId));
    setArchiveClassConfirm({
      id: targetId,
      name: target?.name || 'this classroom'
    });
  }, [classrooms]);

  const handleExecuteArchiveClass = useCallback(() => {
    if (!archiveClassConfirm) return;
    updateArchiveState(null, archiveClassConfirm.id, true);
    setArchiveClassConfirm(null);
  }, [archiveClassConfirm, updateArchiveState]);

  const handleUnarchiveClass = useCallback((e, id) => {
    updateArchiveState(e, id, false);
  }, [updateArchiveState]);

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

  const handleExecuteDeleteClass = useCallback(async () => {
    if (!deleteClassConfirm) return;
    const targetId = deleteClassConfirm.id;
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL}/classrooms/${targetId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setAllowDelete(false);
        }
        alert(data?.message || 'Unable to delete classroom. Permission denied by Admin settings.');
        setDeleteClassConfirm(null);
        return;
      }
      setClassrooms(prev => prev.filter(c => String(c.id) !== String(targetId)));
    } catch (err) {
      alert(err?.message || 'Failed to delete classroom. Please check your connection.');
    } finally {
      setDeleteClassConfirm(null);
    }
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
    archiveClassConfirm,
    setArchiveClassConfirm,
    handleArchiveClass,
    handleExecuteArchiveClass,
    handleUnarchiveClass,
    handleDeleteClass,
    handleExecuteDeleteClass,
    handleCreateClass,
    activeClassrooms,
    archivedClassrooms,
  };
}

