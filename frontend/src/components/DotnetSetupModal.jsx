import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X, Cpu } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { fetchDotnetStatus, triggerInstallDotnet, cancelInstallDotnet } from '../data/dotnetInstaller';
import { io } from 'socket.io-client';
import { LOCAL_DEV_API_URL } from '../data/api';
import DotnetIdleStage from './dotnetSetup/DotnetIdleStage';
import DotnetDownloadingStage from './dotnetSetup/DotnetDownloadingStage';
import DotnetInstallingStage from './dotnetSetup/DotnetInstallingStage';
import DotnetCompletedStage from './dotnetSetup/DotnetCompletedStage';
import DotnetErrorStage from './dotnetSetup/DotnetErrorStage';
import DotnetFooterActions from './dotnetSetup/DotnetFooterActions';

const LOCAL_SOCKET_URL = LOCAL_DEV_API_URL || 'http://localhost:3001';

export default function DotnetSetupModal() {
  const { isDark } = useDarkMode();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState({
    installed: true,
    version: null,
    targetFramework: null,
    stage: 'idle', // 'idle' | 'downloading' | 'installing' | 'completed' | 'error'
    percent: 0,
    downloadedMB: '0.0',
    totalMB: '0.0',
    speed: '',
    error: null,
    message: ''
  });
  const [isStarting, setIsStarting] = useState(false);
  const socketRef = useRef(null);

  // Check status on mount (silent check)
  useEffect(() => {
    let isMounted = true;
    const checkInitial = async () => {
      const data = await fetchDotnetStatus();
      if (!isMounted) return;
      setStatus(prev => ({ ...prev, ...data }));
    };
    checkInitial();

    // Listen for global custom events to open the modal from anywhere
    const handleOpen = () => {
      setIsOpen(true);
      fetchDotnetStatus().then(res => {
        if (isMounted) setStatus(prev => ({ ...prev, ...res }));
      });
    };

    window.addEventListener('verity:open-dotnet-setup', handleOpen);
    return () => {
      isMounted = false;
      window.removeEventListener('verity:open-dotnet-setup', handleOpen);
    };
  }, []);

  // Socket listener for live progress
  useEffect(() => {
    if (!isOpen && status.stage !== 'downloading' && status.stage !== 'installing') {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (!socketRef.current) {
      const s = io(LOCAL_SOCKET_URL, {
        reconnectionAttempts: 5,
        timeout: 4000
      });
      socketRef.current = s;

      s.on('dotnet_setup_progress', (progressData) => {
        setStatus(prev => ({ ...prev, ...progressData }));
        if (progressData.stage === 'completed') {
          setIsStarting(false);
          // Notify any listening components (like CompilerView)
          window.dispatchEvent(new CustomEvent('verity:dotnet-installed', { detail: progressData }));
        } else if (progressData.stage === 'error') {
          setIsStarting(false);
        }
      });
    }

    return () => {
      // Don't disconnect if still downloading in background
      if (status.stage !== 'downloading' && status.stage !== 'installing') {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      }
    };
  }, [isOpen, status.stage]);

  const handleStartInstall = async () => {
    setIsStarting(true);
    setStatus(prev => ({
      ...prev,
      stage: 'downloading',
      percent: 0,
      downloadedMB: '0.0',
      totalMB: '213.4',
      speed: 'Connecting...',
      error: null,
      message: 'Connecting to Microsoft CDN for official .NET 8 SDK...'
    }));

    try {
      await triggerInstallDotnet();
    } catch (err) {
      setIsStarting(false);
      setStatus(prev => ({
        ...prev,
        stage: 'error',
        error: err.message,
        message: err.message
      }));
    }
  };

  const handleCancel = async () => {
    await cancelInstallDotnet();
    setIsStarting(false);
    setStatus(prev => ({
      ...prev,
      stage: 'idle',
      percent: 0,
      error: 'Download cancelled.'
    }));
  };

  const handleDismiss = () => {
    sessionStorage.setItem('verity_dotnet_dismissed', 'true');
    setIsOpen(false);
  };

  const handleOpenManualDownload = () => {
    const url = 'https://dotnet.microsoft.com/download/dotnet/8.0';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isOpen) return null;

  const isDarkTheme = isDark;
  const isBusy = status.stage === 'downloading' || status.stage === 'installing' || isStarting;

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: isDarkTheme ? '#0f172a' : '#ffffff',
            color: isDarkTheme ? '#f8fafc' : '#0f172a',
            borderRadius: '18px',
            border: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: isDarkTheme 
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '24px 28px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: status.stage === 'completed'
                  ? (isDarkTheme ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)')
                  : (isDarkTheme ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.1)'),
                color: status.stage === 'completed' ? '#10b981' : (isDarkTheme ? '#818cf8' : '#4f46e5'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {status.stage === 'completed' ? (
                  <CheckCircle2 size={24} />
                ) : status.stage === 'error' ? (
                  <AlertCircle size={24} color="#ef4444" />
                ) : (
                  <Cpu size={24} />
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', letterSpacing: '-0.01em' }}>
                  {status.stage === 'completed' 
                    ? '.NET SDK Ready' 
                    : status.stage === 'downloading'
                    ? 'Downloading .NET SDK'
                    : status.stage === 'installing'
                    ? 'Installing .NET SDK'
                    : 'Microsoft .NET SDK Setup'}
                </h3>
                <p style={{
                  margin: '3px 0 0',
                  fontSize: '0.82rem',
                  color: isDarkTheme ? '#94a3b8' : '#64748b'
                }}>
                  Local C# Execution & Compiler Engine
                </p>
              </div>
            </div>

            {!isBusy && (
              <button
                onClick={handleDismiss}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isDarkTheme ? '#94a3b8' : '#64748b',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Dismiss"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Body Content */}
          <div style={{ padding: '24px 28px' }}>
            {status.stage === 'idle' && <DotnetIdleStage isDarkTheme={isDarkTheme} status={status} />}
            {status.stage === 'downloading' && <DotnetDownloadingStage isDarkTheme={isDarkTheme} status={status} />}
            {status.stage === 'installing' && <DotnetInstallingStage isDarkTheme={isDarkTheme} />}
            {status.stage === 'completed' && <DotnetCompletedStage isDarkTheme={isDarkTheme} status={status} />}
            {status.stage === 'error' && <DotnetErrorStage isDarkTheme={isDarkTheme} status={status} />}
          </div>

          {/* Footer Actions */}
          <DotnetFooterActions
            status={status}
            isDarkTheme={isDarkTheme}
            isStarting={isStarting}
            handleOpenManualDownload={handleOpenManualDownload}
            handleDismiss={handleDismiss}
            handleStartInstall={handleStartInstall}
            handleCancel={handleCancel}
            setIsOpen={setIsOpen}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
