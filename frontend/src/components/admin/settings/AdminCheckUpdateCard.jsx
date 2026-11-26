import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Download } from 'lucide-react';
import { apiFetch } from '../../../data/api';
import { useDarkMode } from '../../../hooks/useDarkMode';
import UpdateStatusBanners from './UpdateStatusBanners';

export default function AdminCheckUpdateCard({ styles, T }) {
  const { isDark } = useDarkMode();
  const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'latest' | 'available' | 'error'
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null); // { percent, transferred, total }
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [clientAppVersion, setClientAppVersion] = useState(() => import.meta.env.VITE_APP_VERSION || '1.0.0');

  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(v => {
        if (v) setClientAppVersion(v);
      }).catch(() => {});
    }

    const cleanups = [];
    if (window.electronAPI?.onUpdateDownloadProgress) {
      cleanups.push(window.electronAPI.onUpdateDownloadProgress((progress) => {
        setDownloadProgress(progress);
        setIsDownloading(true);
        setDownloadError(null);
      }));
    }
    if (window.electronAPI?.onUpdateDownloadComplete) {
      cleanups.push(window.electronAPI.onUpdateDownloadComplete(() => {
        setIsDownloading(false);
        setIsUpdateReady(true);
        setDownloadProgress(null);
        setDownloadError(null);
      }));
    }
    if (window.electronAPI?.onUpdateDownloadError) {
      cleanups.push(window.electronAPI.onUpdateDownloadError((err) => {
        setIsDownloading(false);
        setDownloadError(typeof err === 'string' ? err : (err?.error || 'Download failed. Please check network connection.'));
      }));
    }

    return () => {
      cleanups.forEach(fn => fn && fn());
    };
  }, []);

  const handleCheckUpdate = async (e) => {
    const force = e?.altKey || e?.shiftKey;
    setStatus('checking');
    setDownloadError(null);
    setIsUpdateReady(false);
    setIsDownloading(false);
    setDownloadProgress(null);

    try {
      let activeVer = clientAppVersion;
      if (window.electronAPI?.getAppVersion) {
        try {
          const v = await window.electronAPI.getAppVersion();
          if (v) {
            activeVer = v;
            setClientAppVersion(v);
          }
        } catch (_) {}
      }

      const query = new URLSearchParams();
      query.append('role', 'Administrator');
      query.append('app', 'admin');
      if (activeVer) query.append('clientVersion', activeVer);
      if (force) query.append('force', 'true');
      const res = await apiFetch(`/api/check-update?${query.toString()}`);
      if (res && res.ok) {
        const data = await res.json();
        setUpdateInfo(data);
        if (data.updateAvailable) {
          setStatus('available');
        } else {
          setStatus('latest');
        }
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
      setStatus('error');
    }
  };

  const handleUpdateNow = async () => {
    if (!updateInfo?.downloadUrl) return;
    setIsDownloading(true);
    setDownloadError(null);
    setIsUpdateReady(false);
    setDownloadProgress({ percent: 0, transferred: 0, total: 0 });

    if (window.electronAPI?.startAppUpdate) {
      try {
        const res = await window.electronAPI.startAppUpdate(updateInfo.downloadUrl);
        if (!res?.success) {
          setIsDownloading(false);
          setDownloadError(res?.error || 'Failed to start update download.');
        }
      } catch (err) {
        setIsDownloading(false);
        setDownloadError(err?.message || 'Update download failed.');
      }
    } else {
      try {
        const a = document.createElement('a');
        a.href = updateInfo.downloadUrl;
        a.setAttribute('download', '');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        window.open(updateInfo.downloadUrl, '_blank');
      }
      setTimeout(() => setIsDownloading(false), 2000);
    }
  };

  const handleRestartAndInstall = async () => {
    setIsInstalling(true);
    if (window.electronAPI?.installAppUpdate) {
      try {
        const res = await window.electronAPI.installAppUpdate();
        if (!res?.success) {
          setIsInstalling(false);
          setDownloadError(res?.error || 'Failed to launch installer.');
        }
      } catch (err) {
        setIsInstalling(false);
        setDownloadError(err?.message || 'Failed to launch installer.');
      }
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={styles.sectionTitle}>
            <RefreshCw size={18} color={T.blue} />
            <span>Check for Updates</span>
          </h3>
          <p style={styles.sectionSub}>
            Check if a newer version of The Verity is available. Keep your administrative software up to date with the latest security fixes and features.
          </p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '9999px',
          backgroundColor: isDark ? '#3a3a3a' : '#f1f5f9',
          color: isDark ? '#e2e8f0' : '#475569',
          fontSize: '0.82rem',
          fontWeight: '700',
        }}>
          <span>Current Version:</span>
          <span style={{ color: T.blue }}>v{clientAppVersion || updateInfo?.currentVersion || '1.0.0'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCheckUpdate}
          disabled={status === 'checking' || isDownloading || isInstalling}
          style={{
            ...styles.secBtn,
            backgroundColor: (status === 'checking' || isDownloading || isInstalling) ? (isDark ? '#4b5563' : '#94a3b8') : T.blue,
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0, 123, 255, 0.25)',
            cursor: (status === 'checking' || isDownloading || isInstalling) ? 'not-allowed' : 'pointer'
          }}
          title="Click to check for updates"
        >
          <RefreshCw
            size={15}
            style={{
              animation: status === 'checking' ? 'spin 1s linear infinite' : 'none',
            }}
          />
          <span>{status === 'checking' ? 'Checking for updates...' : status === 'latest' ? 'Check Again' : 'Check for Updates'}</span>
        </motion.button>

        {status === 'available' && !isUpdateReady && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleUpdateNow}
            disabled={isDownloading}
            style={{
              ...styles.secBtn,
              backgroundColor: isDownloading ? (isDark ? '#4b5563' : '#94a3b8') : '#16a34a',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
              cursor: isDownloading ? 'wait' : 'pointer'
            }}
            title="Download update inside The Verity"
          >
            <Download size={15} />
            <span>{isDownloading ? 'Downloading Update...' : 'Update Now'}</span>
          </motion.button>
        )}

        {isUpdateReady && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleRestartAndInstall}
            disabled={isInstalling}
            style={{
              ...styles.secBtn,
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.45)',
              cursor: isInstalling ? 'wait' : 'pointer'
            }}
            title="Restart and install the downloaded update"
          >
            <RefreshCw size={15} style={{ animation: isInstalling ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isInstalling ? 'Restarting The Verity...' : 'Restart & Install Now'}</span>
          </motion.button>
        )}
      </div>

      <UpdateStatusBanners
        status={status}
        isDark={isDark}
        T={T}
        clientAppVersion={clientAppVersion}
        updateInfo={updateInfo}
        handleUpdateNow={handleUpdateNow}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        isUpdateReady={isUpdateReady}
        downloadError={downloadError}
      />
    </div>
  );
}
