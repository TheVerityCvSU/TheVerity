import React from 'react';
import { motion } from 'framer-motion';
import { MonitorX, ShieldAlert, LogOut, Smartphone, Terminal, ExternalLink, HelpCircle, Code2, AlertOctagon } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { isDevToolsOrEmulation } from '../utils/deviceUtils';

export default function ComLabWebBlocker({ currentUser, onLogout }) {
  const { isDark } = useDarkMode();
  const isDevTools = isDevToolsOrEmulation();

  const handleLogout = () => {
    if (typeof onLogout === 'function') {
      onLogout();
    } else {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('verity_user');
      localStorage.removeItem('verity_token');
      localStorage.removeItem('token');
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: isDark ? '#090d16' : '#f8fafc',
        backgroundImage: isDark
          ? 'radial-gradient(circle at 50% 20%, rgba(220, 38, 38, 0.16) 0%, transparent 70%), radial-gradient(circle at 80% 80%, rgba(30, 58, 138, 0.18) 0%, transparent 60%)'
          : 'radial-gradient(circle at 50% 20%, rgba(239, 68, 68, 0.1) 0%, transparent 70%), radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 60%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflowY: 'auto',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          maxWidth: '680px',
          width: '100%',
          backgroundColor: isDark ? '#111827' : '#ffffff',
          borderRadius: '20px',
          border: isDark ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid #fecaca',
          boxShadow: isDark
            ? '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(220, 38, 38, 0.2)'
            : '0 25px 50px -12px rgba(220, 38, 38, 0.15), 0 10px 25px -5px rgba(0, 0, 0, 0.08)',
          padding: '36px 32px',
          textAlign: 'center',
          color: isDark ? '#f3f4f6' : '#1f2937',
        }}
      >
        {/* Top Warning Icon */}
        <div style={{ display: 'inline-flex', position: 'relative', marginBottom: '20px' }}>
          <div
            style={{
              width: '88px',
              height: '88px',
              borderRadius: '24px',
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#fef2f2',
              border: isDark ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)',
            }}
          >
            {isDevTools ? (
              <AlertOctagon size={48} color="#ef4444" strokeWidth={2.2} />
            ) : (
              <MonitorX size={48} color="#ef4444" strokeWidth={2.2} />
            )}
          </div>
          <span
            style={{
              position: 'absolute',
              bottom: '-6px',
              right: '-8px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '3px 10px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {isDevTools ? 'F12 EMULATION BLOCKED' : '.EXE ONLY'}
          </span>
        </div>

        {/* Heading & Subtitle */}
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            marginBottom: '8px',
            color: isDark ? '#ffffff' : '#111827',
            letterSpacing: '-0.02em',
          }}
        >
          {isDevTools ? 'Developer Tools & Emulation Blocked' : 'Desktop Application Required'}
        </h1>
        <p
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: '#ef4444',
            marginBottom: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {isDevTools
            ? 'Browser Device Mode (F12) Spoofing Detected'
            : 'ComLab & PC Web Browser Access Is Blocked For Students'}
        </p>

        {currentUser?.name && (
          <div
            style={{
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: '9999px',
              backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
              border: isDark ? '1px solid #374151' : '#e2e8f0',
              fontSize: '0.85rem',
              color: isDark ? '#9ca3af' : '#64748b',
              marginBottom: '20px',
            }}
          >
            Logged in as: <strong style={{ color: isDark ? '#f3f4f6' : '#0f172a' }}>{currentUser.name}</strong> ({currentUser.role || 'Student'})
          </div>
        )}

        {/* Explanation Card */}
        <div
          style={{
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.65)' : '#f8fafc',
            border: isDark ? '1px solid #1e293b' : '#e2e8f0',
            borderRadius: '14px',
            padding: '20px',
            textAlign: 'left',
            marginBottom: '24px',
          }}
        >
          {isDevTools ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
              <div style={{ marginTop: '2px', color: '#ef4444' }}>
                <Code2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: isDark ? '#f87171' : '#dc2626', marginBottom: '3px' }}>
                  Anti-Tamper & Spoofing Enforcement
                </div>
                <p style={{ margin: 0, fontSize: '0.88rem', color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.55 }}>
                  The Verity Integrity System detected that you are accessing this application on a <strong>desktop/laptop computer</strong> while using <strong>F12 Developer Tools / Device Mode Toolbar</strong> to emulate a mobile phone. Hardware indicators (mouse pointer, display resolution, and OS platform) confirm this is an emulated desktop session. Emulating mobile devices on PC to bypass exam restrictions is strictly prohibited.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
              <div style={{ marginTop: '2px', color: '#ef4444' }}>
                <ShieldAlert size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: isDark ? '#f87171' : '#dc2626', marginBottom: '3px' }}>
                  Computer Laboratory & Desktop Policy
                </div>
                <p style={{ margin: 0, fontSize: '0.88rem', color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.55 }}>
                  You are accessing <strong>The Verity</strong> through a desktop web browser (Chrome, Edge, Firefox, etc.).
                  To enforce <strong>exam kiosk lockdown, block unauthorized browser tabs, monitor secondary displays, and block virtual machines</strong>,
                  all students on desktop or laptop computers must run the official desktop application: <strong>The Verity.exe</strong>.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
            <div style={{ marginTop: '2px', color: '#3b82f6' }}>
              <Smartphone size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: isDark ? '#60a5fa' : '#2563eb', marginBottom: '3px' }}>
                Genuine Mobile Phone Exception
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.55 }}>
                The web browser version is strictly provided for online students who do not own or have access to a desktop or laptop computer, allowing them to take exams from their physical smartphone.
              </p>
            </div>
          </div>
        </div>

        {/* Instruction Steps */}
        <div
          style={{
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#eff6ff',
            border: isDark ? '1px solid #334155' : '#dbeafe',
            borderRadius: '14px',
            padding: '18px 20px',
            textAlign: 'left',
            marginBottom: '28px',
          }}
        >
          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: isDark ? '#93c5fd' : '#1d4ed8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            What you need to do now:
          </div>
          <ol style={{ margin: 0, paddingLeft: '22px', fontSize: '0.9rem', color: isDark ? '#e2e8f0' : '#1e293b', lineHeight: 1.6 }}>
            {isDevTools && <li><strong>Close Developer Tools (F12)</strong> and turn off device emulation.</li>}
            <li><strong>Close</strong> this web browser window.</li>
            <li>Look on your computer desktop or start menu for <strong>"The Verity"</strong> shortcut.</li>
            <li>Double-click to open <strong>The Verity.exe</strong> application.</li>
            <li>Log in with your student credentials inside the application to access your classrooms and exams.</li>
          </ol>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#b91c1c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; }}
          >
            <LogOut size={18} />
            Log Out & Switch to The Verity.exe
          </button>
        </div>

        {/* Environment Diagnostic Footer */}
        <div
          style={{
            marginTop: '28px',
            paddingTop: '16px',
            borderTop: isDark ? '1px solid #1f2937' : '#f1f5f9',
            fontSize: '0.78rem',
            color: isDark ? '#6b7280' : '#94a3b8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span>Environment: <strong>{isDevTools ? 'F12 Device Emulation (Blocked)' : 'Desktop Web Browser (Blocked)'}</strong></span>
          <span>Required Client: <strong>The Verity (.exe)</strong></span>
        </div>
      </motion.div>
    </div>
  );
}
