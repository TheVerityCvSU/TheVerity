import { Monitor, ShieldAlert, MonitorX } from 'lucide-react';

export default function StudentViewSecurityModals({
  multiMonitorDetected,
  vmDetected,
  vmReasons = [],
  kioskRules,
  isDesktopWeb,
  onBack
}) {
  const safeReasons = Array.isArray(vmReasons) ? vmReasons : [];
  return (
    <>
      {/* Multiple Monitors Modal */}
      {multiMonitorDetected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            padding: '30px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '22px',
              backgroundColor: 'rgba(217, 119, 6, 0.18)',
              border: '1px solid rgba(217, 119, 6, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: '0 8px 25px rgba(217, 119, 6, 0.25)'
            }}
          >
            <Monitor size={38} color="#fbbf24" strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '12px', color: '#fbbf24' }}>
            Multiple Displays Detected
          </h2>
          <p style={{ fontSize: '1rem', maxWidth: '480px', color: '#cbd5e1', lineHeight: 1.5 }}>
            Verity Kiosk Enforcement policy requires a single active monitor during exams. Please disconnect secondary monitors to continue.
          </p>
        </div>
      )}

      {/* Virtual Machine Detected Modal */}
      {vmDetected && kioskRules?.blockVirtualMachine !== false && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            padding: '30px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              backgroundColor: 'rgba(220, 38, 38, 0.18)',
              border: '1px solid rgba(220, 38, 38, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: '0 8px 30px rgba(220, 38, 38, 0.35)'
            }}
          >
            <ShieldAlert size={42} color="#f87171" strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '12px', color: '#f87171' }}>
            Virtual Machine Detected — Exam Blocked
          </h2>
          <p style={{ fontSize: '1.05rem', maxWidth: '580px', color: '#e2e8f0', lineHeight: 1.6, marginBottom: '20px' }}>
            The Verity Exam Integrity System has detected that this session is running inside a{' '}
            <strong>Virtual Machine (VM)</strong>. Taking exams or executing code within virtualized environments is strictly prohibited.
          </p>
          {safeReasons.length > 0 && (
            <div
              style={{
                maxWidth: '580px',
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '24px',
                textAlign: 'left'
              }}
            >
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#fca5a5',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Hardware & Driver Indicators:
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                {safeReasons.slice(0, 4).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={() => {
              if (typeof onBack === 'function') onBack();
            }}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#b91c1c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
            }}
          >
            Exit Exam Workspace
          </button>
        </div>
      )}

      {/* Desktop Web Browser Blocking Modal */}
      {isDesktopWeb && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            padding: '30px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              backgroundColor: 'rgba(220, 38, 38, 0.18)',
              border: '1px solid rgba(220, 38, 38, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: '0 8px 30px rgba(220, 38, 38, 0.35)'
            }}
          >
            <MonitorX size={42} color="#f87171" strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '12px', color: '#f87171' }}>
            The Verity.exe Desktop Application Required
          </h2>
          <p style={{ fontSize: '1.05rem', maxWidth: '580px', color: '#e2e8f0', lineHeight: 1.6, marginBottom: '20px' }}>
            Taking exams or executing code in a standard desktop web browser is strictly prohibited in the Computer Laboratory. All laboratory and desktop computer examinations must be conducted through the official{' '}
            <strong>The Verity.exe</strong> desktop application for kiosk lockdown and exam security.
          </p>
          <button
            onClick={() => {
              if (typeof onBack === 'function') onBack();
            }}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#b91c1c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
            }}
          >
            Exit Exam Workspace
          </button>
        </div>
      )}
    </>
  );
}
