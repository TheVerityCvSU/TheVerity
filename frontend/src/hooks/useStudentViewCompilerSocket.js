import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getCompilerSocketUrl, getLocalApiUrl, getCloudUrl, getConnectionStatus, LOCAL_DEV_API_URL, isElectronApp } from '../data/api';

function isStrictLocalPcCompiler() {
  if (typeof window === 'undefined') return false;
  if (isElectronApp() || Boolean(window.electronAPI)) return true;
  const host = window.location?.hostname || '';
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function useStudentViewCompilerSocket({ socket, currentUser }) {
  const [localSocket, setLocalSocket] = useState(null);
  const [secondarySocket, setSecondarySocket] = useState(null);
  const localSocketRef = useRef(null);
  const secondarySocketRef = useRef(null);

  useEffect(() => {
    let isSubscribed = true;
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    try {
      const strictLocal = isStrictLocalPcCompiler();
      // In The Verity desktop app (Electron) / local PC, ALWAYS pin compiler strictly to localhost:3001
      // so student C# code compiles on the student's own PC using their local .NET SDK (never Teacher LAN or Cloud).
      const socketEndpoint = strictLocal ? (LOCAL_DEV_API_URL || 'http://localhost:3001') : getCompilerSocketUrl();
      const local = io(socketEndpoint, {
        timeout: 4000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
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
      const primaryUri = String(socket?.io?.uri || '').replace(/\/+$/, '');

      let altTarget = null;
      if (primaryUri.includes('localhost') || primaryUri.includes('127.0.0.1') || primaryUri.includes('192.168.')) {
        if (conn.isOnline && cloudUrl && !cloudUrl.includes('localhost') && !cloudUrl.includes('127.0.0.1')) {
          altTarget = String(cloudUrl).replace(/\/+$/, '');
        }
      } else {
        if (!conn.isWebHosted && localUrl && !localUrl.includes('verity-2z4v')) {
          altTarget = String(localUrl).replace(/\/+$/, '');
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
    const normUri = (u) => String(u || '').replace(/\/+$/, '');
    const emittedUris = new Set();
    if (socket && typeof socket.emit === 'function') {
      socket.emit(event, data);
      const uri = normUri(socket.io?.uri);
      if (uri) emittedUris.add(uri);
    }
    if (secondarySocketRef.current && secondarySocketRef.current.connected && typeof secondarySocketRef.current.emit === 'function') {
      const secUri = normUri(secondarySocketRef.current.io?.uri);
      if (!secUri || !emittedUris.has(secUri)) {
        secondarySocketRef.current.emit(event, data);
        if (secUri) emittedUris.add(secUri);
      }
    }
    if (localSocketRef.current && localSocketRef.current.connected && typeof localSocketRef.current.emit === 'function') {
      const locUri = normUri(localSocketRef.current.io?.uri);
      if (!locUri || !emittedUris.has(locUri)) {
        localSocketRef.current.emit(event, data);
        if (locUri) emittedUris.add(locUri);
      }
    }
  }, [socket]);

  const getCompilerSocket = useCallback(() => {
    // On Verity desktop app / local PC, strictly require the student's own localhost compiler engine
    if (isStrictLocalPcCompiler()) {
      return localSocket && localSocket.connected ? localSocket : null;
    }
    return localSocket && localSocket.connected ? localSocket : socket;
  }, [localSocket, socket]);

  return {
    localSocket,
    secondarySocket,
    emitToSockets,
    getCompilerSocket
  };
}
