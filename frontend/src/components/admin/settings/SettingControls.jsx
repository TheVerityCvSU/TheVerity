import React from 'react';
import { motion } from 'framer-motion';

export const Toggle = ({ on, onToggle, label, subtext, accent, T }) => {
  const accentColor = accent || T.green;
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 18px',
      backgroundColor: T.bg,
      borderRadius: '16px',
      border: `1px solid ${T.border}`,
    }}>
      <div>
        <span style={{ fontSize: '0.88rem', fontWeight: '700', color: T.text, display: 'block' }}>{label}</span>
        {subtext && <span style={{ fontSize: '0.78rem', color: T.muted, marginTop: '2px', display: 'block' }}>{subtext}</span>}
      </div>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggle}
        style={{
          width: '50px',
          height: '26px',
          borderRadius: '9999px',
          backgroundColor: on ? accentColor : '#cbd5e1',
          position: 'relative',
          transition: 'background 0.25s ease',
          display: 'flex',
          alignItems: 'center',
          padding: '3px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <motion.div
          animate={{ x: on ? 24 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{
            width: '20px',
            height: '20px',
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        />
      </motion.div>
    </div>
  );
};

export const Slider = ({ value, onChange, min, max, step = 1, label, unit = '', subtext, T }) => {
  return (
    <div style={{ padding: '14px 18px', backgroundColor: T.bg, borderRadius: '16px', border: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <span style={{ fontSize: '0.88rem', fontWeight: '700', color: T.text }}>{label}</span>
          {subtext && <span style={{ fontSize: '0.78rem', color: T.muted, display: 'block', marginTop: '2px' }}>{subtext}</span>}
        </div>
        <span style={{
          fontSize: '1rem',
          fontWeight: '800',
          color: T.blue,
          backgroundColor: '#eff6ff',
          padding: '4px 14px',
          borderRadius: '9999px',
        }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: T.blue, cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: T.muted, marginTop: '4px' }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
};

