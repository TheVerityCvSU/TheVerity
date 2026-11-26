import { motion } from 'framer-motion';
import { Code2 } from 'lucide-react';
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
      </div>
    </motion.div>
  );
}

