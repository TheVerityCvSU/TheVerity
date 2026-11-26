import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInputField({
  label,
  value,
  onChange,
  placeholder,
  showPassword,
  onToggleShow,
  inputRef,
  colors,
  iconSize = 16
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '0.84rem',
          fontWeight: '600',
          color: colors.title,
          marginBottom: '6px'
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          style={{
            width: '100%',
            padding: '12px 42px 12px 14px',
            borderRadius: '10px',
            border: `1px solid ${colors.inputBorder}`,
            backgroundColor: colors.inputBg,
            color: colors.inputText,
            fontSize: '0.92rem',
            boxSizing: 'border-box',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          style={{
            position: 'absolute',
            right: '10px',
            top: 0,
            bottom: 0,
            margin: 'auto 0',
            height: '24px',
            width: '24px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: colors.subText,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
          }}
          title={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={iconSize} /> : <Eye size={iconSize} />}
        </button>
      </div>
    </div>
  );
}

