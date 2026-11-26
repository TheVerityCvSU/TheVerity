import { ShieldAlert } from 'lucide-react';

export default function AppVmBlocker({ isDark, vmReasons, handleLogout }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      backgroundColor: isDark ? '#090d16' : '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{
        maxWidth: '640px',
        width: '100%',
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderRadius: '20px',
        border: isDark ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid #fecaca',
        padding: '36px 32px',
        textAlign: 'center',
        boxShadow: isDark
          ? '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(220, 38, 38, 0.2)'
          : '0 25px 50px -12px rgba(220, 38, 38, 0.15), 0 10px 25px -5px rgba(0, 0, 0, 0.08)',
        color: isDark ? '#f3f4f6' : '#1f2937'
      }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '24px', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#fef2f2', border: isDark ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)' }}>
          <ShieldAlert size={44} color="#ef4444" strokeWidth={2.2} />
        </div>
        <h2 style={{ fontSize: '1.85rem', fontWeight: 'bold', marginBottom: '12px', color: '#f87171' }}>
          Virtual Machine Detected — Exam Blocked
        </h2>
        <p style={{ fontSize: '1rem', color: isDark ? '#cbd5e1' : '#4b5563', lineHeight: 1.6, marginBottom: '20px' }}>
          The Verity Exam Integrity System has detected that this session is running inside a <strong>Virtual Machine (VM)</strong>. Taking exams or executing code within virtualized environments (VMware, VirtualBox, Hyper-V, QEMU, etc.) is strictly prohibited.
        </p>
        {vmReasons.length > 0 && (
          <div style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc', border: isDark ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', textAlign: 'left' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fca5a5', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Hardware & System Indicators:
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: isDark ? '#cbd5e1' : '#64748b', lineHeight: 1.5 }}>
              {vmReasons.slice(0, 4).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => {
              if (window.electronAPI?.closeApp) {
                window.electronAPI.closeApp();
              } else {
                handleLogout();
              }
            }}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            Exit Application
          </button>
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: 'transparent',
              color: isDark ? '#94a3b8' : '#64748b',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '12px 20px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
