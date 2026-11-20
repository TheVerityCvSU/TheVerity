import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { subscribeConnectionStatus, getActiveSocketUrl } from '../data/api';
import { saveClassroomTheme } from '../data/classroomTheme';

export const createVeritySocket = (targetUrl) => {
  const url = targetUrl || getActiveSocketUrl();
  const sock = io(url, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 6000,
    transports: ['websocket', 'polling'],
    auth: (cb) => {
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      cb({ token });
    }
  });

  sock.on('connect', () => {
    console.log(`[Socket.IO] Connected to ${url}`);
  });

  return sock;
};

export function useAppSocket({ currentUser, setCurrentUser, normalizeSavedUser, setActiveAssignment, setActiveClassroom }) {
  const [socket, setSocket] = useState(() => createVeritySocket(getActiveSocketUrl()));
  const currentSocketUrlRef = useRef(getActiveSocketUrl());

  useEffect(() => {
    const unsubscribe = subscribeConnectionStatus(() => {
      const desiredUrl = getActiveSocketUrl();
      if (desiredUrl && desiredUrl !== currentSocketUrlRef.current) {
        console.log(`[Socket.IO] Active network target shifted from ${currentSocketUrlRef.current} to ${desiredUrl}. Reconstructing socket...`);
        currentSocketUrlRef.current = desiredUrl;
        setSocket((prev) => {
          if (prev) {
            try { prev.disconnect(); } catch (_) { }
          }
          return createVeritySocket(desiredUrl);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleConnect = () => {
      const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
      if (token || currentUser) {
        socket.emit('authenticate', { token, user: currentUser });
      }
    };
    socket.on('connect', handleConnect);
    if (socket.connected) handleConnect();
    return () => socket.off('connect', handleConnect);
  }, [socket, currentUser]);

  useEffect(() => {
    const handleAvatarBroadcast = (data) => {
      if (!data || !currentUser) return;
      const emailMatch = data.email && currentUser.email
        ? data.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
        : String(data.userId) === String(currentUser.id);
      if (emailMatch) {
        setCurrentUser(prev => {
          const updated = normalizeSavedUser({ ...prev, avatar: data.avatar, name: data.name });
          localStorage.setItem('currentUser', JSON.stringify(updated));
          localStorage.setItem('verity_user', JSON.stringify(updated));
          return updated;
        });
      }
    };
    socket.on('user_avatar_updated', handleAvatarBroadcast);
    return () => socket.off('user_avatar_updated', handleAvatarBroadcast);
  }, [socket, currentUser, normalizeSavedUser, setCurrentUser]);

  useEffect(() => {
    if (!socket) return;
    const handleClassworkChanged = (payload) => {
      if (Array.isArray(payload?.classwork)) {
        setActiveAssignment(prev => {
          if (!prev) return prev;
          const match = payload.classwork.find(cw => String(cw.id) === String(prev.id));
          return match ? { ...prev, ...match } : prev;
        });
      }
    };
    socket.on('classwork_changed', handleClassworkChanged);
    return () => socket.off('classwork_changed', handleClassworkChanged);
  }, [socket, setActiveAssignment]);

  useEffect(() => {
    if (!socket) return;
    const handleThemeChanged = (data) => {
      if (!data || !data.theme) return;

      const targetClassroom = {
        id: data.classroomId,
        code: data.code,
        name: data.name,
        section: data.code || data.section
      };

      saveClassroomTheme(targetClassroom, data.theme, null);

      setActiveClassroom(prev => {
        if (!prev) return prev;
        const matches =
          (data.classroomId != null && String(prev.id) === String(data.classroomId)) ||
          (data.code && prev.code && String(prev.code).toLowerCase() === String(data.code).toLowerCase()) ||
          (data.code && prev.section && String(prev.section).toLowerCase() === String(data.code).toLowerCase()) ||
          (data.name && prev.name && String(prev.name).toLowerCase() === String(data.name).toLowerCase());

        if (matches) {
          const updated = { ...prev, theme: data.theme };
          localStorage.setItem('activeClassroom', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    };

    const handleClassroomArchived = (data) => {
      if (!data) return;
      const isArchived = Boolean(data.archived);
      setActiveClassroom(prev => {
        if (!prev) return prev;
        const matches =
          (data.classroomId != null && String(prev.id) === String(data.classroomId)) ||
          (data.id != null && String(prev.id) === String(data.id)) ||
          (data.code && prev.code && String(prev.code).toLowerCase() === String(data.code).toLowerCase()) ||
          (data.name && prev.name && String(prev.name).toLowerCase() === String(data.name).toLowerCase());

        if (matches) {
          const updated = { ...prev, archived: isArchived, archivedByTeacher: isArchived };
          try { localStorage.setItem('activeClassroom', JSON.stringify(updated)); } catch (_) {}
          return updated;
        }
        return prev;
      });
      window.dispatchEvent(new CustomEvent('verity:classroom-archived', { detail: { ...data, archived: isArchived } }));
      window.dispatchEvent(new CustomEvent('verity:classrooms-changed'));
    };

    const handleClassroomsChanged = (payload) => {
      if (payload?.classrooms && Array.isArray(payload.classrooms)) {
        setActiveClassroom(prev => {
          if (!prev) return prev;
          const match = payload.classrooms.find(c => String(c.id) === String(prev.id));
          if (!match) return prev;
          const updated = { ...prev, ...match, archived: Boolean(match.archived || prev.localStudentArchived), archivedByTeacher: Boolean(match.archived) };
          try { localStorage.setItem('activeClassroom', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });
      } else if (payload?.classroom) {
        setActiveClassroom(prev => {
          if (!prev || String(prev.id) !== String(payload.classroom.id)) return prev;
          const updated = { ...prev, ...payload.classroom, archived: Boolean(payload.classroom.archived || prev.localStudentArchived), archivedByTeacher: Boolean(payload.classroom.archived) };
          try { localStorage.setItem('activeClassroom', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });
      }
      window.dispatchEvent(new CustomEvent('verity:classrooms-changed', { detail: payload }));
    };

    const handleClassroomSettingsChanged = (data) => {
      if (!data?.classroom) return;
      const incoming = data.classroom;
      setActiveClassroom(prev => {
        if (!prev || String(prev.id) !== String(incoming.id)) return prev;
        const updated = { ...prev, ...incoming };
        try { localStorage.setItem('activeClassroom', JSON.stringify(updated)); } catch (_) {}
        return updated;
      });
      window.dispatchEvent(new CustomEvent('verity:classroom-updated', { detail: { classroom: incoming } }));
    };

    socket.on('classroom_theme_changed', handleThemeChanged);
    socket.on('classroom_archived', handleClassroomArchived);
    socket.on('classrooms_changed', handleClassroomsChanged);
    socket.on('classroom_settings_changed', handleClassroomSettingsChanged);
    return () => {
      socket.off('classroom_theme_changed', handleThemeChanged);
      socket.off('classroom_archived', handleClassroomArchived);
      socket.off('classrooms_changed', handleClassroomsChanged);
      socket.off('classroom_settings_changed', handleClassroomSettingsChanged);
    };
  }, [socket, setActiveClassroom]);

  useEffect(() => {
    const handleLocalArchiveEvent = (e) => {
      const detail = e?.detail;
      if (!detail) return;
      const targetId = detail.classroomId ?? detail.id;
      if (targetId == null) return;
      setActiveClassroom(prev => {
        if (!prev || String(prev.id) !== String(targetId)) return prev;
        const isArchived = Boolean(detail.archived);
        const updated = { ...prev, archived: isArchived, archivedByTeacher: isArchived };
        try { localStorage.setItem('activeClassroom', JSON.stringify(updated)); } catch (_) {}
        return updated;
      });
    };
    const handleLocalUpdatedEvent = (e) => {
      const incoming = e?.detail?.classroom;
      if (!incoming || incoming.id == null) return;
      setActiveClassroom(prev => {
        if (!prev || String(prev.id) !== String(incoming.id)) return prev;
        const updated = { ...prev, ...incoming };
        try { localStorage.setItem('activeClassroom', JSON.stringify(updated)); } catch (_) {}
        return updated;
      });
    };
    window.addEventListener('verity:classroom-archived', handleLocalArchiveEvent);
    window.addEventListener('verity:classroom-updated', handleLocalUpdatedEvent);
    return () => {
      window.removeEventListener('verity:classroom-archived', handleLocalArchiveEvent);
      window.removeEventListener('verity:classroom-updated', handleLocalUpdatedEvent);
    };
  }, [setActiveClassroom]);

  useEffect(() => {
    if (!socket) return;
    const handleDataSynced = () => {
      window.dispatchEvent(new CustomEvent('verity:classrooms-changed'));
      window.dispatchEvent(new CustomEvent('verity:users-changed'));
      window.dispatchEvent(new CustomEvent('verity:sync-completed'));
    };
    socket.on('classrooms_updated', handleDataSynced);
    socket.on('users_updated', handleDataSynced);
    socket.on('verity_data_synced', handleDataSynced);
    return () => {
      socket.off('classrooms_updated', handleDataSynced);
      socket.off('users_updated', handleDataSynced);
      socket.off('verity_data_synced', handleDataSynced);
    };
  }, [socket]);

  return { socket };
}
