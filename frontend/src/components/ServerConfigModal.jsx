import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Globe, CheckCircle2, AlertCircle, X, Loader2, RotateCcw, Wifi } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { getCloudUrl, DEFAULT_CLOUD_API_URL } from '../utils/api';

export default function ServerConfigModal({ isOpen, onClose }) {
  const { isDark } = useDarkMode();
  const [currentUrl, setCurrentUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }

  useEffect(() => {
    if (isOpen) {
      const active = getCloudUrl() || DEFAULT_CLOUD_API_URL;
      setCurrentUrl(active);
      setInputUrl(active);
      setTestResult(null);
    }
  }, [isOpen]);

  const normalizeUrl = (raw) => {
    let u = raw.trim();
    if (!u) return DEFAULT_CLOUD_API_URL;
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      u = `http://${u}`;
    }
    // If it looks like a raw IP without port, add :3001
    const match = u.match(/^http:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (match) {
      u = `${u}:3001`;
    }
    return u.replace(/\/$/, '');
  };

  const handleTestConnection = async () => {
    const target = normalizeUrl(inputUrl);
    setTesting(true);
    setTestResult(null);

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${target}/health`, { signal: controller.signal });
      clearTimeout(timer);
      const latency = Date.now() - startTime;

      if (res.ok) {
        setTestResult({
          success: true,
          message: `Connected successfully! (${latency}ms) — Server is online.`
        });
      } else {
        setTestResult({
          success: false,
          message: `Server returned HTTP ${res.status}. Verify the server is running.`
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `Could not reach ${target}. Ensure the Host PC is on the same network and port 3001 is open in Windows Firewall.`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const target = normalizeUrl(inputUrl);
    if (target === DEFAULT_CLOUD_API_URL) {
      localStorage.removeItem('verity_cloud_url');
    } else {
      localStorage.setItem('verity_cloud_url', target);
    }
    onClose();
    // Reload to apply new server socket and API endpoints cleanly
    window.location.reload();
  };

  const handleResetToCloud = () => {
    setInputUrl(DEFAULT_CLOUD_API_URL);
    localStorage.removeItem('verity_cloud_url');
    setTestResult(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div style={{
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
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%',
            maxWidth: '480px',
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
            borderRadius: '20px',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '22px 24px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.1)',
                color: isDark ? '#818cf8' : '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Server size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
                  Server Connection
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                  Configure Cloud or Offline School LAN Host
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: isDark ? '#94a3b8' : '#64748b',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 24px' }}>
            <p style={{
              margin: '0 0 16px',
              fontSize: '0.85rem',
              color: isDark ? '#cbd5e1' : '#475569',
              lineHeight: '1.5'
            }}>
              To connect this computer to a <strong>Teacher&apos;s Host PC</strong> in a local offline lab, enter the Teacher&apos;s IP address below (port 3001).
            </p>

            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: '700',
              marginBottom: '6px',
              color: isDark ? '#e2e8f0' : '#334155'
            }}>
              Host Server Address:
            </label>

            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  setTestResult(null);
                }}
                placeholder="192.168.1.100:3001 or https://..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
                  backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Test result status box */}
            {testResult && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: testResult.success
                  ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7')
                  : (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2'),
                color: testResult.success ? '#10b981' : '#ef4444',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginBottom: '14px',
                lineHeight: '1.4'
              }}>
                {testResult.success ? (
                  <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Helper Quick Actions */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#e2e8f0' : '#334155',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {testing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Wifi size={13} />
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetToCloud}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isDark ? '#818cf8' : '#4f46e5',
                  padding: '7px 10px',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <RotateCcw size={13} />
                <span>Reset to Cloud</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(248, 250, 252, 0.8)',
            borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                color: isDark ? '#cbd5e1' : '#475569',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: '#ffffff',
                padding: '9px 20px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              Save &amp; Connect
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
