import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getCloudUrl, getLocalApiUrl } from '../data/api';

export function useGoogleAuthFlow({ onSuccess, onError }) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const socketRef = useRef(null);
  const authTimeoutRef = useRef(null);
  const authWindowRef = useRef(null);
  const messageHandlerRef = useRef(null);
  const focusResetTimerRef = useRef(null);

  const cleanupAuth = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }
    if (focusResetTimerRef.current) {
      clearTimeout(focusResetTimerRef.current);
      focusResetTimerRef.current = null;
    }
    if (messageHandlerRef.current && typeof window !== 'undefined') {
      window.removeEventListener('message', messageHandlerRef.current);
      messageHandlerRef.current = null;
    }
    authWindowRef.current = null;
    if (window.electronAPI?.closeGoogleAuth) {
      window.electronAPI.closeGoogleAuth();
    }
  }, []);

  // Listen for Google Auth Window closed event from Electron .exe
  useEffect(() => {
    if (window.electronAPI?.onGoogleAuthClosed) {
      const unsubscribe = window.electronAPI.onGoogleAuthClosed(() => {
        setIsGoogleLoading(false);
        cleanupAuth();
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [cleanupAuth]);

  // When mainWindow regains focus, check if auth window was closed (without touching cross-origin popup.closed)
  useEffect(() => {
    const handleFocus = async () => {
      if (!isGoogleLoading) return;
      if (window.electronAPI?.checkGoogleAuthStatus) {
        try {
          const isOpen = await window.electronAPI.checkGoogleAuthStatus();
          if (!isOpen) {
            setIsGoogleLoading(false);
            cleanupAuth();
          }
        } catch (_) { }
        return;
      }
      if (authWindowRef.current) {
        if (focusResetTimerRef.current) clearTimeout(focusResetTimerRef.current);
        focusResetTimerRef.current = setTimeout(() => {
          focusResetTimerRef.current = null;
          setIsGoogleLoading(false);
        }, 1200);
      }
    };

    const handleBlur = () => {
      if (focusResetTimerRef.current) {
        clearTimeout(focusResetTimerRef.current);
        focusResetTimerRef.current = null;
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      if (focusResetTimerRef.current) {
        clearTimeout(focusResetTimerRef.current);
        focusResetTimerRef.current = null;
      }
    };
  }, [isGoogleLoading, cleanupAuth]);

  // Clean up any pending socket or timer on unmount
  useEffect(() => {
    return () => {
      cleanupAuth();
    };
  }, [cleanupAuth]);

  const startExternalGoogleAuth = useCallback((extraParams = {}) => {
    setIsGoogleLoading(true);
    cleanupAuth();

    const randomBytes = new Uint8Array(16);
    let sessionId = '';
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(randomBytes);
      sessionId = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
    } else {
      sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    const activeCloud = getCloudUrl() || 'https://the-verity.onrender.com';
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const authOrigin = isOnline ? 'cloud' : 'lan';
    const backendUrl = isOnline ? activeCloud : getLocalApiUrl();
    let completed = false;

    const handleAuthSuccessData = (data) => {
      if (completed) return;
      completed = true;
      cleanupAuth();
      if (data && data.token && data.user) {
        try {
          localStorage.setItem('verity_token_origin', authOrigin);
          if (window.electronAPI?.localDB?.setLocal) {
            window.electronAPI.localDB.setLocal('verity_saved_session_token_origin', authOrigin).catch(() => { });
          }
        } catch (_) { }
        setIsGoogleLoading(false);
        onSuccess(data.user, data.token, data);
      } else {
        onError('Received invalid data from external login.');
        setIsGoogleLoading(false);
      }
    };

    const handleAuthErrorData = (data) => {
      if (completed) return;
      completed = true;
      cleanupAuth();
      onError(data?.message || 'External Google login failed.');
      setIsGoogleLoading(false);
    };

    let expectedBackendOrigin = '';
    try {
      expectedBackendOrigin = new URL(backendUrl).origin;
    } catch (_) { }

    const handlePopupMessage = (event) => {
      if (expectedBackendOrigin && event?.origin !== expectedBackendOrigin) return;
      const msg = event?.data;
      if (!msg || msg.sessionId !== sessionId) return;
      if (msg.type === 'verity-google-auth-success') {
        handleAuthSuccessData(msg);
      } else if (msg.type === 'verity-google-auth-error') {
        handleAuthErrorData(msg);
      }
    };

    messageHandlerRef.current = handlePopupMessage;
    window.addEventListener('message', handlePopupMessage);

    const socket = io(backendUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const joinSessionRoom = () => {
      socket.emit('join_google_auth_session', sessionId);
    };
    socket.on('connect', joinSessionRoom);
    if (socket.connected) joinSessionRoom();

    socket.on(`google-login-success-${sessionId}`, handleAuthSuccessData);
    socket.on(`google-login-error-${sessionId}`, handleAuthErrorData);

    const safeParams =
      extraParams &&
        typeof extraParams === 'object' &&
        !extraParams.nativeEvent &&
        !extraParams._reactName
        ? { ...extraParams }
        : {};
    if (typeof window !== 'undefined' && /^https?:\/\//i.test(window.location?.origin || '')) {
      safeParams.origin = window.location.origin;
    }
    const extraQuery = Object.entries(safeParams)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '' && typeof v !== 'object' && typeof v !== 'function')
      .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('');
    const url = `${backendUrl}/auth/google/external?sessionId=${sessionId}${extraQuery}`;
    if (window.electronAPI && window.electronAPI.openGoogleAuth) {
      window.electronAPI.openGoogleAuth(url);
    } else if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      const popup = window.open(url, '_blank', 'width=520,height=650');
      if (popup) {
        authWindowRef.current = popup;
      } else {
        cleanupAuth();
        setIsGoogleLoading(false);
        onError('Popup was blocked by your browser. Please allow popups for this site and try again.');
        return;
      }
    }

    authTimeoutRef.current = setTimeout(() => {
      if (!completed) {
        cleanupAuth();
        setIsGoogleLoading(false);
        onError('Login timed out. Please try again.');
      }
    }, 5 * 60 * 1000);
  }, [cleanupAuth, onSuccess, onError]);

  return {
    isGoogleLoading,
    setIsGoogleLoading,
    startExternalGoogleAuth,
  };
}

