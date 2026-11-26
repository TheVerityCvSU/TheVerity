import { RefreshCw, Download } from 'lucide-react';
import { useAppUpdate } from '../../hooks/useAppUpdate';
import UpdateStatusBanner from './UpdateStatusBanner';

export default function CheckUpdateField({ isDark, role }) {
  const {
    status,
    updateInfo,
    isDownloading,
    downloadProgress,
    isUpdateReady,
    downloadError,
    isInstalling,
    clientAppVersion,
    handleCheckUpdate,
    handleUpdateNow,
    handleRestartAndInstall,
  } = useAppUpdate(role);

  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '22px',
      borderRadius: '16px',
      backgroundColor: isDark ? '#2D2D2D' : '#f8fafc',
      border: `1px solid ${isDark ? '#404040' : '#e2e8f0'}`,
      transition: 'all 0.25s ease'
    }}>
      {/* Brief explanation & current version */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '640px' }}>
          <div style={{
            fontSize: '0.95rem',
            fontWeight: '700',
            color: isDark ? '#E8EAED' : '#1f2937',
            marginBottom: '4px'
          }}>
            Software Updates
          </div>
          <p style={{
            margin: 0,
            fontSize: '0.85rem',
            lineHeight: 1.5,
            color: isDark ? '#9AA0A6' : '#64748b'
          }}>
            Check if a newer version of The Verity is available. Updating ensures your system is equipped with the latest features, security patches, and performance fixes.
          </p>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '20px',
          backgroundColor: isDark ? '#3A3A3A' : '#e2e8f0',
          color: isDark ? '#E8EAED' : '#475569',
          fontSize: '0.82rem',
          fontWeight: '600',
          flexShrink: 0
        }}>
          <span>Current Version:</span>
          <span style={{ color: '#10b981', fontWeight: '700' }}>v{clientAppVersion || updateInfo?.currentVersion || '1.0.0'}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleCheckUpdate}
          disabled={status === 'checking' || isDownloading || isInstalling}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            borderRadius: '50px',
            backgroundColor: (status === 'checking' || isDownloading || isInstalling) ? (isDark ? '#4b5563' : '#9ca3af') : '#10b981',
            color: '#ffffff',
            border: 'none',
            fontWeight: '700',
            fontSize: '0.9rem',
            cursor: (status === 'checking' || isDownloading || isInstalling) ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
            transition: 'all 0.2s ease',
          }}
          title="Click to check for updates"
        >
          <RefreshCw
            size={16}
            style={{
              animation: status === 'checking' ? 'spin 1s linear infinite' : 'none',
            }}
          />
          {status === 'checking' ? 'Checking for updates...' : status === 'latest' ? 'Check Again' : 'Check for Updates'}
        </button>

        {status === 'available' && !isUpdateReady && (
          <button
            type="button"
            onClick={handleUpdateNow}
            disabled={isDownloading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              borderRadius: '50px',
              backgroundColor: isDownloading ? (isDark ? '#4b5563' : '#9ca3af') : '#059669',
              color: '#ffffff',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: isDownloading ? 'wait' : 'pointer',
              boxShadow: '0 2px 10px rgba(5, 150, 105, 0.35)',
              transition: 'all 0.2s ease',
            }}
            title="Download update inside The Verity"
          >
            <Download size={16} />
            {isDownloading ? 'Downloading Update...' : 'Update Now'}
          </button>
        )}

        {isUpdateReady && (
          <button
            type="button"
            onClick={handleRestartAndInstall}
            disabled={isInstalling}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              borderRadius: '50px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: isInstalling ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.45)',
              transition: 'all 0.2s ease',
              animation: 'pulse 2s infinite'
            }}
            title="Restart and install the downloaded update"
          >
            <RefreshCw size={16} style={{ animation: isInstalling ? 'spin 1s linear infinite' : 'none' }} />
            {isInstalling ? 'Restarting The Verity...' : 'Restart & Install Now'}
          </button>
        )}
      </div>

      {/* Status Banners */}
      <UpdateStatusBanner
        isDark={isDark}
        status={status}
        updateInfo={updateInfo}
        clientAppVersion={clientAppVersion}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        isUpdateReady={isUpdateReady}
        downloadError={downloadError}
        onUpdateNow={handleUpdateNow}
      />
    </div>
  );
}
