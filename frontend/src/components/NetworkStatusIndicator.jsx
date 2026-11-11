import React, { useState, useEffect, useRef } from 'react';
import { 
  getConnectionStatus, 
  subscribeConnectionStatus, 
  setCustomLanServer, 
  switchToCloudMode,
  switchToLanMode,
  getLocalApiUrl,
  getCloudUrl,
  apiFetch
} from '../data/api';
import { useDarkMode } from '../hooks/useDarkMode';
import NetworkStatusDot from './networkStatus/NetworkStatusDot';
import NetworkConfigPopover from './networkStatus/NetworkConfigPopover';

export default function NetworkStatusIndicator({ hidden = false, position = 'right' }) {
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
    if (!currentLan) {
      try {
        currentLan = localStorage.getItem('verity_lan_server') || '';
      } catch (_) {}
    }
    if (currentLan) {
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
    const targetAddress = (customIp && customIp.trim()) ? customIp.trim() : getCloudUrl();
    if (!targetAddress) {
      setFeedback({ type: 'error', message: 'Please enter a valid IP address or URL.' });
      return;
    }
    setIsConnecting(true);
    setFeedback(null);

    try {
      const result = await setCustomLanServer(targetAddress);
      if (result && result.success) {
        const label = result.mode === 'cloud' ? 'Online Cloud Server' : 'LAN Server';
        setFeedback({ type: 'success', message: `Connected to ${label} (${result.url || targetAddress})` });
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

  if (hidden) return null;

  return (
    <div style={containerStyle}>
      <NetworkStatusDot
        dotColor={dotColor}
        tooltipText={tooltipText}
        isHovered={isHovered}
        setIsHovered={setIsHovered}
        onClick={() => {
          setIsOpen(!isOpen);
          setFeedback(null);
        }}
      />

      {isOpen && (
        <NetworkConfigPopover
          popoverRef={popoverRef}
          popoverStyle={popoverStyle}
          isDark={isDark}
          dotColor={dotColor}
          mode={mode}
          modeLabel={modeLabel}
          status={status}
          customIp={customIp}
          setCustomIp={setCustomIp}
          handleConnect={handleConnect}
          isConnecting={isConnecting}
          handleScanLan={handleScanLan}
          isScanning={isScanning}
          feedback={feedback}
          handleTriggerSync={handleTriggerSync}
          isSyncing={isSyncing}
          syncCompleted={syncCompleted}
          handleSwitchToCloud={handleSwitchToCloud}
          handleSwitchToLan={handleSwitchToLan}
          setIsOpen={setIsOpen}
        />
      )}
    </div>
  );
}
