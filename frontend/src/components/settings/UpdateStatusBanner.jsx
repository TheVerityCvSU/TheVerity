import React from 'react';
import { Download, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

export default function UpdateStatusBanner({
  isDark,
  status,
  updateInfo,
  clientAppVersion,
  isDownloading,
  downloadProgress,
  isUpdateReady,
  downloadError,
  onUpdateNow
}) {
  return (
    <>
      {/* Up to date status */}
      {status === 'latest' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
          border: '1px solid #10b981',
          color: isDark ? '#34d399' : '#047857',
          fontSize: '0.88rem',
          fontWeight: '500',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
            <span>You're up to date! The Verity is running the latest version (v{clientAppVersion || updateInfo?.currentVersion || '1.0.0'}).</span>
          </div>
          {updateInfo?.downloadUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={onUpdateNow}
                disabled={isDownloading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  color: isDark ? '#34d399' : '#047857',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: isDownloading ? 'wait' : 'pointer'
                }}
              >
                <Download size={14} />
                {isDownloading ? 'Downloading...' : 'Reinstall / Re-sync from Local Server'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Update available status */}
      {status === 'available' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px 20px',
          borderRadius: '12px',
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#eff6ff',
          border: '1px solid #3b82f6',
          color: isDark ? '#93c5fd' : '#1d4ed8',
          fontSize: '0.88rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.92rem' }}>
            <Sparkles size={18} color="#3b82f6" style={{ flexShrink: 0 }} />
            <span>Update Available: Version {updateInfo?.latestVersion}</span>
          </div>
          {updateInfo?.releaseNotes && (
            <div style={{ fontSize: '0.83rem', opacity: 0.9, lineHeight: 1.4 }}>
              {updateInfo.releaseNotes}
            </div>
          )}

          {/* In-app download progress bar */}
          {isDownloading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '12px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
              border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: '600' }}>
                <span>Downloading update inside The Verity...</span>
                <span>{downloadProgress ? `${downloadProgress.percent}%` : 'Connecting...'}</span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                borderRadius: '999px',
                backgroundColor: isDark ? '#374151' : '#e2e8f0',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${downloadProgress?.percent || 0}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                  borderRadius: '999px',
                  transition: 'width 0.2s ease'
                }} />
              </div>
            </div>
          )}

          {/* Update ready notice */}
          {isUpdateReady && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5',
              border: '1px solid #10b981',
              color: isDark ? '#34d399' : '#047857',
              fontWeight: '600',
              fontSize: '0.85rem'
            }}>
              <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
              <span>Update downloaded successfully! Click "Restart & Install Now" to apply the update seamlessly.</span>
            </div>
          )}

          {/* Download error alert */}
          {downloadError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
              border: '1px solid #ef4444',
              color: isDark ? '#f87171' : '#b91c1c',
              fontSize: '0.83rem',
              fontWeight: '600'
            }}>
              <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
              <span>{downloadError}</span>
            </div>
          )}
        </div>
      )}

      {/* Error status */}
      {status === 'error' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
          border: '1px solid #ef4444',
          color: isDark ? '#f87171' : '#b91c1c',
          fontSize: '0.88rem',
        }}>
          <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
          <span>Unable to check for updates right now. Please check your connection and try again.</span>
        </div>
      )}
    </>
  );
}

