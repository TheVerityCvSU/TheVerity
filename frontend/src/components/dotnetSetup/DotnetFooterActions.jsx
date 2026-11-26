import { ExternalLink, Loader2, Download, RefreshCw } from 'lucide-react';

export default function DotnetFooterActions({
  status,
  isDarkTheme,
  isStarting,
  handleOpenManualDownload,
  handleDismiss,
  handleStartInstall,
  handleCancel,
  setIsOpen
}) {
  return (
    <div style={{
      padding: '16px 28px 20px',
      backgroundColor: isDarkTheme ? 'rgba(15, 23, 42, 0.6)' : 'rgba(248, 250, 252, 0.6)',
      borderTop: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px'
    }}>
      {/* Left helper link */}
      <div>
        <button
          onClick={handleOpenManualDownload}
          style={{
            background: 'none',
            border: 'none',
            color: isDarkTheme ? '#94a3b8' : '#64748b',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
            textUnderlineOffset: '3px'
          }}
        >
          <span>Manual Download</span>
          <ExternalLink size={12} />
        </button>
      </div>

      {/* Right action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {status.stage === 'idle' && (
          <>
            <button
              onClick={handleDismiss}
              style={{
                background: 'transparent',
                border: isDarkTheme ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
                color: isDarkTheme ? '#cbd5e1' : '#475569',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Later
            </button>

            <button
              onClick={handleStartInstall}
              disabled={isStarting}
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                border: 'none',
                color: '#ffffff',
                padding: '9px 20px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
              }}
            >
              {isStarting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Install .NET 8 SDK</span>
                </>
              )}
            </button>
          </>
        )}

        {status.stage === 'downloading' && (
          <button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: isDarkTheme ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
              color: isDarkTheme ? '#cbd5e1' : '#475569',
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '0.84rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        )}

        {status.stage === 'installing' && (
          <span style={{ fontSize: '0.8rem', color: isDarkTheme ? '#94a3b8' : '#64748b' }}>
            Please wait...
          </span>
        )}

        {status.stage === 'completed' && (
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: '#10b981',
              border: 'none',
              color: '#ffffff',
              padding: '9px 24px',
              borderRadius: '10px',
              fontSize: '0.84rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}
          >
            Done
          </button>
        )}

        {status.stage === 'error' && (
          <>
            <button
              onClick={handleDismiss}
              style={{
                background: 'transparent',
                border: isDarkTheme ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
                color: isDarkTheme ? '#cbd5e1' : '#475569',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Close
            </button>

            <button
              onClick={handleStartInstall}
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                border: 'none',
                color: '#ffffff',
                padding: '9px 20px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <RefreshCw size={15} />
              <span>Retry Install</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

