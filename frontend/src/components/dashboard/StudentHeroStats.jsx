import React from 'react';
import { motion } from 'framer-motion';

export default function StudentHeroStats({
  currentUser,
  dashboardStats,
  textColor,
  textMuted,
  cardBg,
  isDark
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '36px',
      flexWrap: 'wrap',
      gap: '20px'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <p style={{
          color: '#059669',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '8px'
        }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()} · YOUR LEARNING DASHBOARD
        </p>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 12px', color: textColor }}>
          Good morning, {currentUser?.name || 'Verity Student'}.
        </h1>
      </motion.div>

      {/* Stats Pill */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={{
          display: 'flex',
          backgroundColor: cardBg,
          borderRadius: '50px',
          padding: '16px 32px',
          gap: '32px',
          boxShadow: isDark ? '0 4px 15px rgba(0,0,0,0.2)' : '0 4px 15px rgba(0,0,0,0.05)',
          border: isDark ? '1px solid #333' : '1px solid #e5e7eb'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{dashboardStats.done}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: textMuted, marginTop: '2px' }}>Done</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{dashboardStats.dueSoon}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: textMuted, marginTop: '2px' }}>Due Soon</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{dashboardStats.miss}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: textMuted, marginTop: '2px' }}>Miss</div>
        </div>
      </motion.div>
    </div>
  );
}

