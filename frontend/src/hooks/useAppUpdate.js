import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../data/api';

export function useAppUpdate(role) {
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
        setDownloadError(typeof err === 'string' ? err : (err?.error || 'Download failed. Please check connection.'));
      }));
    }

    return () => {
      cleanups.forEach(fn => fn && fn());
    };
  }, []);

  const handleCheckUpdate = useCallback(async (e) => {
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
      if (role) query.append('role', role);
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
  }, [role, clientAppVersion]);

  const handleUpdateNow = useCallback(async () => {
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
      // In-browser fallback
      try {
        const a = document.createElement('a');
        a.href = updateInfo.downloadUrl;
        a.setAttribute('download', '');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (_) {
        window.open(updateInfo.downloadUrl, '_blank');
      }
      setTimeout(() => setIsDownloading(false), 2000);
    }
  }, [updateInfo]);

  const handleRestartAndInstall = useCallback(async () => {
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
  }, []);

  return {
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
  };
}

