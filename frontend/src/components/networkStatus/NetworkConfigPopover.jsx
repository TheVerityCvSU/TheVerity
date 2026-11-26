import { X, Check, RefreshCw } from 'lucide-react';
import { getCloudUrl } from '../../data/api';

export default function NetworkConfigPopover({
  popoverRef,
  popoverStyle,
  isDark,
  dotColor,
  mode,
  modeLabel,
  status,
  customIp,
  setCustomIp,
  handleConnect,
  isConnecting,
  handleScanLan,
  isScanning,
  feedback,
  handleTriggerSync,
  isSyncing,
  syncCompleted,
  handleSwitchToCloud,
  handleSwitchToLan,
  setIsOpen
}) {
  return (
    <div ref={popoverRef} style={popoverStyle}>
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

      {/* Connect to Server Form (Online or LAN) */}
      <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: isDark ? '#d4d4d8' : '#3f3f46' }}>
          Server Address
        </label>
        <input
          type="text"
          value={customIp}
          onChange={(e) => setCustomIp(e.target.value)}
          placeholder="http://192.168.254.101:3001 or https://..."
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
            {isConnecting ? 'Connecting...' : 'Connect'}
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

      {/* Switch back to Cloud if currently on LAN or Offline */}
      {mode !== 'cloud' && (
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
  );
}

