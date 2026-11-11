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

    socket.on('classroom_theme_changed', handleThemeChanged);
    return () => socket.off('classroom_theme_changed', handleThemeChanged);
  }, [socket, setActiveClassroom]);

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
