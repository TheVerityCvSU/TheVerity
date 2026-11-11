import React from 'react';
import ClassroomBannerIllustration from '../ClassroomBannerIllustration';

export default function ClassroomCardBanner({ classroom, theme, role }) {
  return (
    <div
      style={{
        height: '160px',
        borderTopLeftRadius: '15px',
        borderTopRightRadius: '15px',
        background: theme?.customImageUrl
          ? `url(${theme.customImageUrl}) center/cover no-repeat`
          : `linear-gradient(135deg, ${theme?.primary || '#137333'}, ${theme?.secondary || '#1e8e3e'})`,
        padding: '16px 20px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      {/* SVG Illustration in Top-Right Corner */}
      {!theme?.customImageUrl && (
        <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '55%', pointerEvents: 'none', overflow: 'hidden' }}>
          <ClassroomBannerIllustration themeId={theme?.id} style={{ width: '100%', height: '100%' }} />
        </div>
      )}

      {/* Title */}
      <h3
        style={{
          color: '#ffffff',
          fontSize: '1.45rem',
          fontWeight: '700',
          textDecoration: 'none',
          margin: 0,
          lineHeight: 1.2,
          zIndex: 2,
          textShadow: '0 1px 3px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={classroom.name}
      >
        {classroom.name}
      </h3>

      {/* Subtitle / Section */}
      <div
        style={{
          color: 'rgba(255,255,255,0.92)',
          fontSize: '0.95rem',
          fontWeight: '600',
          textDecoration: 'none',
          marginTop: '4px',
          zIndex: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {classroom.section || classroom.subject || '2'}
      </div>

      {/* Instructor subtitle if available */}
      {classroom.instructor && role === 'Student' && (
        <div
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: '0.8rem',
            marginTop: 'auto',
            zIndex: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {classroom.instructor}
        </div>
      )}
    </div>
  );
}

