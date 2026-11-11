import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function DiagnosticModal({ isOpen, isDark, diagnosticData, onClose, styles }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div style={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            style={{ ...styles.modalCard, maxWidth: '400px', textAlign: 'center' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <h2 style={{ margin: '0 0 16px', color: isDark ? '#f1f5f9' : '#1e293b' }}>System Diagnostic</h2>

            {!diagnosticData ? (
              <div style={{ padding: '24px', backgroundColor: isDark ? '#2a2a2a' : '#f8fafc', borderRadius: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '36px', height: '36px', border: '4px solid #cbd5e1', borderTopColor: '#007bff', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
                <strong style={{ fontSize: '1.1rem', color: isDark ? '#cbd5e1' : '#334155' }}>Running diagnostic checks...</strong>
              </div>
            ) : diagnosticData.status === 'operational' ? (
              <div style={{ padding: '24px', backgroundColor: isDark ? '#2a2a2a' : '#f8fafc', borderRadius: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '12px' }} />
                <strong style={{ fontSize: '1.1rem', color: '#22c55e' }}>All systems operational!</strong>
                <p style={{ fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#64748b', marginTop: '8px' }}>
                  Latency: {diagnosticData.latency}ms • Server Uptime: {Math.floor(diagnosticData.uptime / 60)}m {Math.floor(diagnosticData.uptime % 60)}s
                  <br />Database: {diagnosticData.db === 'connected' ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            ) : (
              <div style={{ padding: '24px', backgroundColor: '#fee2e2', borderRadius: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <AlertCircle size={48} color="#b91c1c" style={{ marginBottom: '12px' }} />
                <strong style={{ fontSize: '1.1rem', color: '#b91c1c' }}>System Error Detected</strong>
                <p style={{ fontSize: '0.85rem', color: '#b91c1c', marginTop: '8px' }}>
                  {diagnosticData.error}
                  <br />Latency: {diagnosticData.latency}ms
                </p>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              style={styles.submitBlueBtn}
            >
              Close
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

