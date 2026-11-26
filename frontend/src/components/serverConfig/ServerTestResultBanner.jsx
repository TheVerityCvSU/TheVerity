import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function ServerTestResultBanner({ testResult, isDark }) {
  if (!testResult) return null;

  return (
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
  );
}

