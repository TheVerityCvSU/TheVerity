import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getCompilerSocketUrl, getLocalApiUrl, getCloudUrl, getConnectionStatus } from '../data/api';

export function useStudentViewCompilerSocket({ socket, currentUser }) {
  const [localSocket, setLocalSocket] = useState(null);
  const [secondarySocket, setSecondarySocket] = useState(null);
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
        secSocket.on('connect', () => {
          const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
          secSocket.emit('authenticate', { token, user: currentUser });
          setSecondarySocket(secSocket);
        });
        secSocket.on('disconnect', () => {
          setSecondarySocket(null);
        });
        secondarySocketRef.current = secSocket;
        setSecondarySocket(secSocket);
      }
    } catch (_) {}

    return () => {
      setSecondarySocket(null);
      if (secondarySocketRef.current) {
        try { secondarySocketRef.current.disconnect(); } catch (_) {}
        secondarySocketRef.current = null;
      }
    };
  }, [socket, currentUser]);

  const emitToSockets = useCallback((event, data) => {
    const emittedUris = new Set();
    if (socket && typeof socket.emit === 'function') {
      socket.emit(event, data);
      if (socket.io?.uri) emittedUris.add(socket.io.uri);
    }
    if (secondarySocketRef.current && typeof secondarySocketRef.current.emit === 'function') {
      const secUri = secondarySocketRef.current.io?.uri;
      if (!secUri || !emittedUris.has(secUri)) {
        secondarySocketRef.current.emit(event, data);
        if (secUri) emittedUris.add(secUri);
      }
    }
    if (localSocketRef.current && localSocketRef.current.connected && typeof localSocketRef.current.emit === 'function') {
      const locUri = localSocketRef.current.io?.uri;
      if (!locUri || !emittedUris.has(locUri)) {
        localSocketRef.current.emit(event, data);
        if (locUri) emittedUris.add(locUri);
      }
    }
  }, [socket]);

  const getCompilerSocket = useCallback(() => {
    return localSocket && localSocket.connected ? localSocket : socket;
  }, [localSocket, socket]);

  return {
    localSocket,
    secondarySocket,
    emitToSockets,
    getCompilerSocket
  };
}
