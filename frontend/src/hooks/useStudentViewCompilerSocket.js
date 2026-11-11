import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getCompilerSocketUrl, getLocalApiUrl, getCloudUrl, getConnectionStatus } from '../data/api';

export function useStudentViewCompilerSocket({ socket, currentUser }) {
  const [localSocket, setLocalSocket] = useState(null);
  const localSocketRef = useRef(null);
  const secondarySocketRef = useRef(null);

  useEffect(() => {
    let isSubscribed = true;
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    try {
      const socketEndpoint = getCompilerSocketUrl();
      const localFallback = getLocalApiUrl();
      const local = io(socketEndpoint, {
        timeout: 3000,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        auth: { token }
      });

      local.on('connect', () => {
        if (isSubscribed) {
          setLocalSocket(local);
          local.emit('authenticate', { token, user: currentUser });
        }
      });
      local.on('disconnect', () => {
        if (isSubscribed) setLocalSocket(null);
      });
      local.on('connect_error', () => {
        if (local.io && local.io.uri !== localFallback) {
          local.io.uri = localFallback;
          local.connect();
          return;
        }
        if (isSubscribed) setLocalSocket(null);
      });
      localSocketRef.current = local;
    } catch (_) {}

    return () => {
      isSubscribed = false;
      setLocalSocket(null);
      if (localSocketRef.current) {
        try { localSocketRef.current.disconnect(); } catch (_) {}
        localSocketRef.current = null;
      }
    };
  }, [currentUser]);

  useEffect(() => {
    let secSocket = null;
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
        secondarySocketRef.current = secSocket;
      }
    } catch (_) {}

    return () => {
      if (secondarySocketRef.current) {
        try { secondarySocketRef.current.disconnect(); } catch (_) {}
        secondarySocketRef.current = null;
      }
    };
  }, [socket]);

  const emitToSockets = useCallback((event, data) => {
    if (socket && typeof socket.emit === 'function') socket.emit(event, data);
    if (secondarySocketRef.current && typeof secondarySocketRef.current.emit === 'function') {
      secondarySocketRef.current.emit(event, data);
    }
  }, [socket]);

  const getCompilerSocket = useCallback(() => {
    return localSocket && localSocket.connected ? localSocket : socket;
  }, [localSocket, socket]);

  return {
    localSocket,
    emitToSockets,
    getCompilerSocket
  };
}
