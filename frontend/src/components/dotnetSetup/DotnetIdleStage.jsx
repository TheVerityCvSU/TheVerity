import { AlertCircle } from 'lucide-react';

export default function DotnetIdleStage({ isDarkTheme, status }) {
  return (
    <div>
      <p style={{ 
        margin: '0 0 16px', 
        fontSize: '0.92rem', 
        lineHeight: '1.55',
        color: isDarkTheme ? '#cbd5e1' : '#334155' 
      }}>
        Verity compiles and tests C# submissions locally on your computer. An official <strong>Microsoft .NET 8 SDK</strong> is required to enable offline compilation and test runner execution.
      </p>

      {/* Specs Box */}
      <div style={{
        backgroundColor: isDarkTheme ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.7)',
        borderRadius: '12px',
        padding: '14px 16px',
        border: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.04)',
        fontSize: '0.82rem',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Target Component:</span>
          <strong style={{ color: isDarkTheme ? '#f8fafc' : '#0f172a' }}>Microsoft .NET 8.0 SDK (LTS)</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Platform / Arch:</span>
          <span style={{ color: isDarkTheme ? '#e2e8f0' : '#1e293b' }}>Windows x64</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Download Size:</span>
          <span style={{ color: isDarkTheme ? '#e2e8f0' : '#1e293b' }}>~213 MB (one-time setup)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Distribution:</span>
          <span style={{ color: isDarkTheme ? '#818cf8' : '#4f46e5' }}>Official Microsoft CDN</span>
        </div>
      </div>

      {status.error && (
        <div style={{
          marginBottom: '16px',
          padding: '10px 14px',
          borderRadius: '8px',
          backgroundColor: isDarkTheme ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
          color: '#ef4444',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} flexShrink={0} />
          <span>{status.error}</span>
        </div>
      )}
    </div>
  );
}

