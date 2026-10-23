import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, CheckCircle2, AlertCircle, X, 
  ExternalLink, Loader2, Cpu, Sparkles, RefreshCw, ShieldAlert
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { fetchDotnetStatus, triggerInstallDotnet, cancelInstallDotnet } from '../utils/dotnetHelper';
import { io } from 'socket.io-client';
import { LOCAL_DEV_API_URL } from '../utils/api';

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
            {/* STAGE: IDLE / NOT INSTALLED PROMPT */}
            {status.stage === 'idle' && (
              <div>
                <p style={{ 
                  margin: '0 0 16px', 
                  fontSize: '0.92rem', 
                  lineHeight: '1.55',
                  color: isDarkTheme ? '#cbd5e1' : '#334155' 
                }}>
                  Verity compiles and tests C# submissions locally on your computer. An official <strong>Microsoft .NET 8 SDK</strong> is required to enable offline compilation and test runner execution.
                </p>

                {/* Specs Box */}
                <div style={{
                  backgroundColor: isDarkTheme ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.7)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  border: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.04)',
                  fontSize: '0.82rem',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Target Component:</span>
                    <strong style={{ color: isDarkTheme ? '#f8fafc' : '#0f172a' }}>Microsoft .NET 8.0 SDK (LTS)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Platform / Arch:</span>
                    <span style={{ color: isDarkTheme ? '#e2e8f0' : '#1e293b' }}>Windows x64</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Download Size:</span>
                    <span style={{ color: isDarkTheme ? '#e2e8f0' : '#1e293b' }}>~213 MB (one-time setup)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Distribution:</span>
                    <span style={{ color: isDarkTheme ? '#818cf8' : '#4f46e5' }}>Official Microsoft CDN</span>
                  </div>
                </div>

                {status.error && (
                  <div style={{
                    marginBottom: '16px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: isDarkTheme ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
                    color: '#ef4444',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={16} flexShrink={0} />
                    <span>{status.error}</span>
                  </div>
                )}
              </div>
            )}

            {/* STAGE: DOWNLOADING */}
            {status.stage === 'downloading' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: '600', color: isDarkTheme ? '#f1f5f9' : '#0f172a' }}>
                    Downloading .NET SDK...
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '800', color: isDarkTheme ? '#818cf8' : '#4f46e5' }}>
                    {status.percent}%
                  </span>
                </div>

                {/* Progress Track */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  marginBottom: '12px'
                }}>
                  <motion.div
                    style={{
                      height: '100%',
                      borderRadius: '9999px',
                      background: 'linear-gradient(90deg, #4f46e5, #06b6d4)'
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(3, status.percent)}%` }}
                    transition={{ ease: 'easeOut', duration: 0.2 }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem',
                  color: isDarkTheme ? '#94a3b8' : '#64748b'
                }}>
                  <span>{status.downloadedMB} MB / {status.totalMB} MB</span>
                  <span>{status.speed}</span>
                </div>

                <p style={{
                  margin: '18px 0 0',
                  fontSize: '0.8rem',
                  color: isDarkTheme ? '#64748b' : '#94a3b8',
                  lineHeight: '1.4'
                }}>
                  Verity is retrieving the verified Microsoft .NET binary directly from official Microsoft servers.
                </p>
              </div>
            )}

            {/* STAGE: INSTALLING */}
            {status.stage === 'installing' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: isDarkTheme ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.1)',
                  color: isDarkTheme ? '#818cf8' : '#4f46e5',
                  marginBottom: '16px'
                }}>
                  <Loader2 size={28} className="animate-spin" />
                </div>

                <h4 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: '700' }}>
                  Executing Silent Setup...
                </h4>
                <p style={{
                  margin: '0 auto',
                  maxWidth: '380px',
                  fontSize: '0.85rem',
                  color: isDarkTheme ? '#cbd5e1' : '#475569',
                  lineHeight: '1.5'
                }}>
                  The installer is registering system binaries. <strong>Please click &quot;Yes&quot;</strong> on the Windows Security (UAC) prompt if requested.
                </p>
              </div>
            )}

            {/* STAGE: COMPLETED */}
            {status.stage === 'completed' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: isDarkTheme ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  marginBottom: '16px'
                }}>
                  <CheckCircle2 size={32} />
                </div>

                <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: '700' }}>
                  Installation Complete!
                </h4>
                <p style={{
                  margin: '0 0 16px',
                  fontSize: '0.86rem',
                  color: isDarkTheme ? '#94a3b8' : '#64748b'
                }}>
                  Detected version: <strong style={{ color: isDarkTheme ? '#f8fafc' : '#0f172a' }}>{status.version || '8.0'}</strong> ({status.targetFramework || 'net8.0'})
                </p>

                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: isDarkTheme ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.08)',
                  color: '#10b981',
                  fontSize: '0.82rem',
                  fontWeight: '600'
                }}>
                  ⚡ Offline C# Compiler and Roslyn engine are active and ready.
                </div>
              </div>
            )}

            {/* STAGE: ERROR */}
            {status.stage === 'error' && (
              <div>
                <div style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: isDarkTheme ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h5 style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: '700', color: '#ef4444' }}>
                      Setup Encountered an Issue
                    </h5>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: isDarkTheme ? '#fca5a5' : '#b91c1c', lineHeight: '1.45' }}>
                      {status.error || 'Failed to download or execute the .NET SDK installer.'}
                    </p>
                  </div>
                </div>

                <p style={{ fontSize: '0.82rem', color: isDarkTheme ? '#94a3b8' : '#64748b', margin: 0 }}>
                  You can try installing again, or download the installer directly from Microsoft if network restrictions apply.
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div style={{
            padding: '16px 28px 20px',
            backgroundColor: isDarkTheme ? 'rgba(15, 23, 42, 0.6)' : 'rgba(248, 250, 252, 0.6)',
            borderTop: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            {/* Left helper link */}
            <div>
              <button
                onClick={handleOpenManualDownload}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDarkTheme ? '#94a3b8' : '#64748b',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px'
                }}
              >
                <span>Manual Download</span>
                <ExternalLink size={12} />
              </button>
            </div>

            {/* Right action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {status.stage === 'idle' && (
                <>
                  <button
                    onClick={handleDismiss}
                    style={{
                      background: 'transparent',
                      border: isDarkTheme ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
                      color: isDarkTheme ? '#cbd5e1' : '#475569',
                      padding: '9px 16px',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Later
                  </button>

                  <button
                    onClick={handleStartInstall}
                    disabled={isStarting}
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      border: 'none',
                      color: '#ffffff',
                      padding: '9px 20px',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
                    }}
                  >
                    {isStarting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Starting...</span>
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        <span>Install .NET 8 SDK</span>
                      </>
                    )}
                  </button>
                </>
              )}

              {status.stage === 'downloading' && (
                <button
                  onClick={handleCancel}
                  style={{
                    background: 'transparent',
                    border: isDarkTheme ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
                    color: isDarkTheme ? '#cbd5e1' : '#475569',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              )}

              {status.stage === 'installing' && (
                <span style={{ fontSize: '0.8rem', color: isDarkTheme ? '#94a3b8' : '#64748b' }}>
                  Please wait...
                </span>
              )}

              {status.stage === 'completed' && (
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    padding: '9px 24px',
                    borderRadius: '10px',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                  }}
                >
                  Done
                </button>
              )}

              {status.stage === 'error' && (
                <>
                  <button
                    onClick={handleDismiss}
                    style={{
                      background: 'transparent',
                      border: isDarkTheme ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
                      color: isDarkTheme ? '#cbd5e1' : '#475569',
                      padding: '9px 16px',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>

                  <button
                    onClick={handleStartInstall}
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      border: 'none',
                      color: '#ffffff',
                      padding: '9px 20px',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <RefreshCw size={15} />
                    <span>Retry Install</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
