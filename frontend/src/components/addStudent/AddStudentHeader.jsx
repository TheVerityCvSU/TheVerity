import { UserPlus, X } from 'lucide-react';

export default function AddStudentHeader({ onClose, loading, colors, isDark }) {
  return (
    <div
      style={{
        padding: '20px 24px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${colors.border}`
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: isDark ? '#133527' : '#ECFDF5',
            color: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <UserPlus size={22} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: '700', color: colors.title }}>
            Add Student
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: colors.subText, marginTop: '2px' }}>
            Enroll a student directly into this classroom
          </p>
        </div>
      </div>

      <button
        onClick={onClose}
        disabled={loading}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          color: colors.subText,
          padding: '6px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: loading ? 0.5 : 1
        }}
        title="Close (Esc)"
        type="button"
      >
        <X size={20} />
      </button>
    </div>
  );
}

