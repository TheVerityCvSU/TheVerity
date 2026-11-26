import { Sparkles } from 'lucide-react';
import { PRESET_AVATARS } from '../../data/settingsConstants';

export default function PresetAvatarTray({ isDark, currentAvatar, onSelectPreset }) {
  return (
    <div style={{
      borderTop: isDark ? '1px solid #4A4A4A' : '1px solid #e5e7eb',
      paddingTop: '18px',
      marginTop: '6px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{
        fontSize: '0.88rem',
        fontWeight: '700',
        color: isDark ? '#E8EAED' : '#374151',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <Sparkles size={13} color="#10b981" /> Or Choose An Avatar Badge
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {PRESET_AVATARS.map((preset) => {
          const isSelected = currentAvatar === preset.svg;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              title={preset.name}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                padding: 0,
                border: isSelected ? '2.5px solid #10b981' : (isDark ? '1.5px solid #525252' : '1.5px solid #d1d5db'),
                boxShadow: isSelected ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                overflow: 'hidden',
                transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
              }}
            >
              <img
                src={preset.svg}
                alt={preset.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

