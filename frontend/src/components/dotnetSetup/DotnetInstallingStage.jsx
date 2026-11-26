import { Loader2 } from 'lucide-react';

export default function DotnetInstallingStage({ isDarkTheme }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '54px',
        height: '54px',
        borderRadius: '50%',
        backgroundColor: isDarkTheme ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.1)',
        color: isDarkTheme ? '#818cf8' : '#4f46e5',
        marginBottom: '16px'
      }}>
        <Loader2 size={28} className="animate-spin" />
      </div>

      <h4 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: '700' }}>
        Executing Silent Setup...
      </h4>
      <p style={{
        margin: '0 auto',
        maxWidth: '380px',
        fontSize: '0.85rem',
        color: isDarkTheme ? '#cbd5e1' : '#475569',
        lineHeight: '1.5'
      }}>
        The installer is registering system binaries. <strong>Please click &quot;Yes&quot;</strong> on the Windows Security (UAC) prompt if requested.
      </p>
    </div>
  );
}

