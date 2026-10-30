import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, X, Check } from 'lucide-react';
import { 
  getConnectionStatus, 
  subscribeConnectionStatus, 
  setCustomLanServer, 
  switchToCloudMode,
  switchToLanMode,
  getLocalApiUrl,
  getCloudUrl,
  apiFetch
} from '../utils/api';
import { useDarkMode } from '../hooks/useDarkMode';
import { useCurrentUser } from '../hooks/useCurrentUser';

export default function NetworkStatusIndicator({ hidden = false, position = 'right' }) {
  if (hidden) return null;
  const { isDark } = useDarkMode();
  const isLeft = position === 'left';
  const [status, setStatus] = useState(() => getConnectionStatus());
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [customIp, setCustomIp] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCompleted, setSyncCompleted] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const popoverRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeConnectionStatus((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsub();
  }, []);

  // Pre-fill input with discovered or cached LAN server
  useEffect(() => {
    let currentLan = getLocalApiUrl();
    if (!currentLan || currentLan.includes('localhost') || currentLan.includes('127.0.0.1')) {
      try {
        currentLan = localStorage.getItem('verity_lan_server') || '';
      } catch (_) {}
    }
    if (currentLan && !currentLan.includes('localhost') && !currentLan.includes('127.0.0.1')) {
      setCustomIp(currentLan);
    }
  }, [status.localUrl, isOpen]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
        setFeedback(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setFeedback(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const mode = status.activeMode; // 'cloud' | 'lan' | 'offline'

  // Colors based on user requirements:
  // Yellow: offline, Green: online server (cloud), Blue: lan server
  const dotColor = mode === 'offline' 
    ? '#f59e0b' 
    : (mode === 'lan' ? '#38bdf8' : '#22c55e');

  const modeLabel = mode === 'offline' 
    ? 'Offline Mode' 
    : (mode === 'lan' ? 'Local ComLab Server' : 'Online Cloud Server');

  const tooltipText = mode === 'offline'
    ? 'Network Configuration: Offline Mode — Click to configure'
    : (mode === 'lan'
        ? `Network Configuration: Connected to Local ComLab Server (${status.lanHostDisplay || status.localUrl}) — Click to configure`
        : `Network Configuration: Online Cloud Server (${status.cloudUrl || getCloudUrl()}) — Click to configure`);

  const handleConnect = async (e) => {
    if (e) e.preventDefault();
    if (!customIp || !customIp.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a valid IP address or URL.' });
      return;
    }
    setIsConnecting(true);
    setFeedback(null);

    try {
      const result = await setCustomLanServer(customIp.trim());
      if (result && result.success) {
        setFeedback({ type: 'success', message: `Connected to ${result.url || customIp}` });
        setTimeout(() => {
          setIsOpen(false);
          setFeedback(null);
        }, 1500);
      } else {
        setFeedback({ type: 'error', message: result?.error || 'Could not connect to server.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Connection failed.' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleScanLan = async () => {
    setIsScanning(true);
    setFeedback(null);
    try {
      if (window.electronAPI?.scanLanServers) {
        const found = await window.electronAPI.scanLanServers();
        if (found) {
          setCustomIp(found);
          await setCustomLanServer(found);
          setFeedback({ type: 'success', message: `Found and connected: ${found}` });
        } else {
          setFeedback({ type: 'error', message: 'No Verity host found. Try entering the IP manually.' });
        }
      } else {
        setFeedback({ type: 'error', message: 'Auto-scan is only available in the desktop app. Enter IP manually.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Scan failed. Please enter host IP manually.' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSwitchToCloud = () => {
    switchToCloudMode();
    setFeedback({ type: 'success', message: 'Switched to Online Cloud Server.' });
    setTimeout(() => {
      setIsOpen(false);
      setFeedback(null);
    }, 1200);
  };

  const handleSwitchToLan = async () => {
    setIsConnecting(true);
    setFeedback(null);
    try {
      const res = await switchToLanMode();
      if (res && res.success) {
        setFeedback({ type: 'success', message: 'Switched to Local ComLab Server.' });
        setTimeout(() => {
          setIsOpen(false);
          setFeedback(null);
        }, 1200);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Could not connect to Local ComLab Server.' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncCompleted(false);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        setSyncCompleted(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('verity:sync-completed'));
          window.dispatchEvent(new CustomEvent('verity:classrooms-changed'));
          window.dispatchEvent(new CustomEvent('verity:users-changed'));
        }
        setTimeout(() => {
          setSyncCompleted(false);
        }, 2500);
      } else {
        setFeedback({ type: 'error', message: 'Sync completed with warnings or offline status.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Sync failed: Server unreachable.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const containerStyle = {
    position: 'fixed',
    top: isLeft ? '14px' : '16px',
    left: isLeft ? '14px' : undefined,
    right: isLeft ? undefined : '16px',
    zIndex: 999999
  };

  const popoverStyle = {
    position: 'absolute',
    top: '34px',
    left: isLeft ? '0px' : undefined,
    right: isLeft ? undefined : '0px',
    width: '320px',
    backgroundColor: isDark ? 'rgba(24, 24, 27, 0.94)' : 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: '16px',
    padding: '16px',
    color: isDark ? '#f4f4f5' : '#18181b',
    boxShadow: isDark 
      ? '0 12px 32px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.2)' 
      : '0 12px 32px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.06)',
    fontSize: '0.82rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    zIndex: 1000000,
    animation: 'fadeInPop 0.18s ease-out'
  };

  return (
    <div style={containerStyle}>
      {/* Top Right Indicator Dot Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setFeedback(null);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={tooltipText}
        aria-label={tooltipText}
        style={{
          width: '24px',
          height: '24px',
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          boxShadow: 'none',
          transform: isHovered ? 'scale(1.2)' : 'scale(1)',
          transition: 'transform 0.2s ease'
        }}
      >
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: dotColor,
            boxShadow: `0 0 8px ${dotColor}, 0 0 14px ${dotColor}88`,
            display: 'inline-block',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease'
          }}
        />
      </button>

      {/* Flyout Connection Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          style={popoverStyle}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: '700', fontSize: '0.88rem', color: isDark ? '#f4f4f5' : '#18181b' }}>
              Network Configuration
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isDark ? '#a1a1aa' : '#71717a',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '6px'
              }}
              title="Close"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Current Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isDark ? 'rgba(39, 39, 42, 0.7)' : 'rgba(244, 244, 245, 0.9)',
              borderRadius: '10px',
              padding: '8px 12px',
              marginBottom: '10px',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: dotColor,
                  boxShadow: `0 0 6px ${dotColor}`
                }}
              />
              <span style={{ fontWeight: '600', fontSize: '0.8rem', color: isDark ? '#f4f4f5' : '#18181b' }}>
                {modeLabel}
              </span>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: dotColor
              }}
            >
              {mode === 'cloud' ? 'Online' : (mode === 'lan' ? 'Local LAN' : 'Offline')}
            </span>
          </div>

          {/* Active target details */}
          <div
            style={{
              backgroundColor: isDark ? 'rgba(39, 39, 42, 0.7)' : 'rgba(244, 244, 245, 0.9)',
              borderRadius: '10px',
              padding: '8px 12px',
              marginBottom: '14px',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: isDark ? '#a1a1aa' : '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Server Endpoint
            </div>
            <div style={{ fontWeight: '600', color: isDark ? '#e4e4e7' : '#27272a', wordBreak: 'break-all', marginTop: '2px', fontSize: '0.8rem' }}>
              {mode === 'cloud' ? (status.cloudUrl || getCloudUrl()) : (mode === 'lan' ? (status.localUrl || 'http://localhost:3001') : 'Offline Engine (localhost:3001)')}
            </div>
          </div>

          {/* Connect to LAN Host Form */}
          <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: isDark ? '#d4d4d8' : '#3f3f46' }}>
              LAN Server Address
            </label>
            <input
              type="text"
              value={customIp}
              onChange={(e) => setCustomIp(e.target.value)}
              placeholder="http://192.168.254.101:3001"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid #d4d4d8',
                backgroundColor: isDark ? 'rgba(9, 9, 11, 0.8)' : '#ffffff',
                color: isDark ? '#f4f4f5' : '#18181b',
                fontSize: '0.82rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <button
                type="submit"
                disabled={isConnecting}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '0.8rem',
                  cursor: isConnecting ? 'not-allowed' : 'pointer',
                  opacity: isConnecting ? 0.7 : 1,
                  transition: 'background-color 0.2s ease'
                }}
              >
                {isConnecting ? 'Connecting...' : 'Connect to LAN'}
              </button>

              <button
                type="button"
                onClick={handleScanLan}
                disabled={isScanning}
                title="Scan local router for Verity Server"
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid #d4d4d8',
                  backgroundColor: isDark ? 'rgba(63, 63, 70, 0.5)' : '#f4f4f5',
                  color: isDark ? '#e4e4e7' : '#27272a',
                  fontWeight: '600',
                  fontSize: '0.8rem',
                  cursor: isScanning ? 'not-allowed' : 'pointer',
                  opacity: isScanning ? 0.7 : 1
                }}
              >
                {isScanning ? 'Scanning...' : 'Scan'}
              </button>
            </div>
          </form>

          {/* Feedback message */}
          {feedback && (
            <div
              style={{
                marginTop: '10px',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '500',
                backgroundColor: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: feedback.type === 'success' ? '#16a34a' : '#dc2626',
                border: `1px solid ${feedback.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}
            >
              {feedback.message}
            </div>
          )}

          {/* Synchronize LAN & Cloud Database */}
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)' }}>
            <button
              type="button"
              onClick={handleTriggerSync}
              disabled={isSyncing || syncCompleted}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                border: syncCompleted
                  ? (isDark ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid #86efac')
                  : (isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid #cbd5e1'),
                backgroundColor: syncCompleted
                  ? (isDark ? 'rgba(34, 197, 94, 0.16)' : '#f0fdf4')
                  : (isDark ? 'rgba(39, 39, 42, 0.7)' : '#f8fafc'),
                color: syncCompleted
                  ? '#16a34a'
                  : (isDark ? '#93c5fd' : '#0284c7'),
                fontWeight: '600',
                fontSize: '0.8rem',
                cursor: (isSyncing || syncCompleted) ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.25s ease'
              }}
            >
              {syncCompleted ? (
                <>
                  <Check size={14} color="#16a34a" />
                  <span>Synchronized Complete</span>
                </>
              ) : (
                <>
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  <span>{isSyncing ? 'Syncing Databases...' : 'Sync LAN & Cloud Database'}</span>
                </>
              )}
            </button>
          </div>

          {/* Switch back to Cloud if currently on LAN */}
          {mode === 'lan' && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)' }}>
              <button
                type="button"
                onClick={handleSwitchToCloud}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#10b981',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  padding: '4px',
                  textAlign: 'center'
                }}
              >
                Switch to Online Cloud Server
              </button>
            </div>
          )}

          {/* Switch to LAN if currently on Cloud */}
          {mode === 'cloud' && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)' }}>
              <button
                type="button"
                onClick={handleSwitchToLan}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  padding: '4px',
                  textAlign: 'center'
                }}
              >
                Switch to Local ComLab Server
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
