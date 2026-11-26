import { ShieldAlert } from 'lucide-react';

export default function DotnetErrorStage({ isDarkTheme, status }) {
  return (
    <div>
      <div style={{
        padding: '14px 16px',
        borderRadius: '12px',
        backgroundColor: isDarkTheme ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h5 style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: '700', color: '#ef4444' }}>
            Setup Encountered an Issue
          </h5>
          <p style={{ margin: 0, fontSize: '0.8rem', color: isDarkTheme ? '#fca5a5' : '#b91c1c', lineHeight: '1.45' }}>
            {status.error || 'Failed to download or execute the .NET SDK installer.'}
          </p>
        </div>
      </div>

      <p style={{ fontSize: '0.82rem', color: isDarkTheme ? '#94a3b8' : '#64748b', margin: 0 }}>
        You can try installing again, or download the installer directly from Microsoft if network restrictions apply.
      </p>
    </div>
  );
}

