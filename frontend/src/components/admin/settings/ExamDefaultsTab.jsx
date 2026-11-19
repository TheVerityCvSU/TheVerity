import React from 'react';
import { motion } from 'framer-motion';
import { Code2, Timer } from 'lucide-react';
import { tabVariants } from '../../../data/adminSettings';
import { Toggle } from './SettingControls';

export default function ExamDefaultsTab({ data, onChange, direction, styles, T }) {
  const update = (key, val) => onChange({ ...data, [key]: val });

  return (
    <motion.div custom={direction} variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={styles.card}>
        {/* Compiler Settings */}
        <div>
          <h3 style={styles.sectionTitle}><Code2 size={18} color={T.blue} /><span>C# Compiler Behavior</span></h3>
          <p style={styles.sectionSub}>Configure the offline .NET C# compiler strictness for student code evaluation.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Toggle
              on={data.treatWarningsAsErrors}
              onToggle={() => update('treatWarningsAsErrors', !data.treatWarningsAsErrors)}
              label="Treat Compiler Warnings as Errors"
              subtext="When ON, code will fail submission if compiler warnings exist, even if it runs."
              accent={T.amber}
              T={T}
            />
          </div>
        </div>

        <div style={styles.divider} />

        {/* Auto-Save & Timer */}
        <div>
          <h3 style={styles.sectionTitle}><Timer size={18} color={T.blue} /><span>Auto-Save & Exam Timer Defaults</span></h3>
          <p style={styles.sectionSub}>These values are applied automatically when a new exam assignment is created.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <div>
              <label style={styles.label}>Code Editor Auto-Save Interval</label>
              <select value={data.autoSaveInterval} onChange={e => update('autoSaveInterval', e.target.value)} style={styles.select}>
                <option value="10s">Every 10 Seconds</option>
                <option value="30s">Every 30 Seconds</option>
                <option value="1m">Every 1 Minute</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: T.muted, marginTop: '4px', display: 'block' }}>
                How often the student's code draft is saved to localStorage.
              </span>
            </div>
            <div>
              <label style={styles.label}>Default Exam Timer (Minutes)</label>
              <input
                type="number" min="10" max="300" step="5"
                value={data.defaultExamTimer}
                onChange={e => update('defaultExamTimer', parseInt(e.target.value) || 60)}
                style={styles.input}
              />
              <span style={{ fontSize: '0.75rem', color: T.muted, marginTop: '4px', display: 'block' }}>
                Default countdown timer auto-applied when creating a new exam.
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

