import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Download, Sparkles, AlertCircle } from 'lucide-react';

export default function UpdateStatusBanners({
  status,
  isDark,
  T,
  clientAppVersion,
  updateInfo,
  handleUpdateNow,
  isDownloading,
  downloadProgress,
  isUpdateReady,
  downloadError,
}) {
  return (
    <AnimatePresence>
      {status === 'latest' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: isDark ? 'rgba(34, 197, 94, 0.12)' : '#dcfce7',
            border: '1px solid #22c55e',
            color: isDark ? '#4ade80' : '#15803d',
            fontSize: '0.85rem',
            fontWeight: '600',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>You're up to date! The Verity Admin is running the latest version (v{clientAppVersion || updateInfo?.currentVersion || '1.0.0'}).</span>
          </div>
          {updateInfo?.downloadUrl && (
            <div>
              <button
                type="button"
                onClick={handleUpdateNow}
                disabled={isDownloading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid #22c55e',
                  color: isDark ? '#4ade80' : '#15803d',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  cursor: isDownloading ? 'wait' : 'pointer'
                }}
              >
                <Download size={13} />
                {isDownloading ? 'Downloading...' : 'Reinstall / Re-sync from Local Server'}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {status === 'available' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            marginTop: '16px',
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: isDark ? 'rgba(0, 123, 255, 0.12)' : '#eff6ff',
            border: `1px solid ${T.blue}`,
            color: isDark ? '#93c5fd' : '#1d4ed8',
            fontSize: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
            <Sparkles size={16} color={T.blue} />
            <span>Update Available: Version {updateInfo?.latestVersion}</span>
          </div>
          {updateInfo?.releaseNotes && (
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
              {updateInfo.releaseNotes}
            </div>
          )}

          {isDownloading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '12px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
              border: `1px solid ${isDark ? 'rgba(0, 123, 255, 0.3)' : 'rgba(0, 123, 255, 0.2)'}`
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

          {isUpdateReady && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
              border: '1px solid #22c55e',
              color: isDark ? '#4ade80' : '#15803d',
              fontWeight: '600',
              fontSize: '0.85rem'
            }}>
              <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0 }} />
              <span>Update downloaded successfully! Click "Restart & Install Now" to apply the update seamlessly.</span>
            </div>
          )}

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
        </motion.div>
      )}

      {status === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
            border: '1px solid #ef4444',
            color: isDark ? '#f87171' : '#b91c1c',
            fontSize: '0.85rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={16} />
          <span>Unable to check for updates right now. Please check your network connection and try again.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

