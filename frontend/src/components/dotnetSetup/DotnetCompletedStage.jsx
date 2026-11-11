import React from 'react';
import { CheckCircle2, Zap } from 'lucide-react';

export default function DotnetCompletedStage({ isDarkTheme, status }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: isDarkTheme ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
        color: '#10b981',
        marginBottom: '16px'
      }}>
        <CheckCircle2 size={32} />
      </div>

      <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: '700' }}>
        Installation Complete!
      </h4>
      <p style={{
        margin: '0 0 16px',
        fontSize: '0.86rem',
        color: isDarkTheme ? '#94a3b8' : '#64748b'
      }}>
        Detected version: <strong style={{ color: isDarkTheme ? '#f8fafc' : '#0f172a' }}>{status.version || '8.0'}</strong> ({status.targetFramework || 'net8.0'})
      </p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        borderRadius: '10px',
        backgroundColor: isDarkTheme ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.08)',
        color: '#10b981',
        fontSize: '0.82rem',
        fontWeight: '600'
      }}>
        <Zap size={14} />
        <span>Offline C# Compiler and Roslyn engine are active and ready.</span>
      </div>
    </div>
  );
}

