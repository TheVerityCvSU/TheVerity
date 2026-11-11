import React from 'react';
import { ArrowLeft } from 'lucide-react';
import ClassroomBannerIllustration from '../ClassroomBannerIllustration';

export default function ClassroomHeroBanner({
  classroom,
  bannerTheme,
  activeTab,
  onTabChange,
  onNavigateBack,
  isDark
}) {
  const theme = bannerTheme || {};

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '280px',
      borderRadius: '24px',
      overflow: 'hidden',
      marginBottom: '32px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: theme.customImageUrl
          ? `linear-gradient(to right, rgba(15, 23, 42, 1) 0%, rgba(15, 23, 42, 0.85) 30%, rgba(15, 23, 42, 0.3) 60%, transparent 100%), url(${theme.customImageUrl}) center/cover no-repeat`
          : `linear-gradient(150deg, ${theme.primary || '#137333'}, ${theme.secondary || '#1e8e3e'})`,
        zIndex: 0
      }} />

      {/* Decorative ambient rings */}
      <div style={{ position: 'absolute', top: '-70px', right: '-70px', width: '220px', height: '220px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.14)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '130px', height: '130px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', pointerEvents: 'none', zIndex: 0 }} />

      {!theme.customImageUrl && (
        <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', pointerEvents: 'none', zIndex: 0 }}>
          <ClassroomBannerIllustration
            themeId={theme.id || 'emerald_books'}
            style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '100%', pointerEvents: 'none' }}
          />
        </div>
      )}

      {/* Top row */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', padding: '24px 32px' }}>
        <button onClick={onNavigateBack} style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}>
          <ArrowLeft size={18} /> All courses
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ padding: '8px 16px', borderRadius: '50px', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.85rem', fontWeight: '500', backdropFilter: 'blur(8px)' }}>
            Class code <span style={{ fontWeight: 'bold', marginLeft: '6px' }}>{classroom?.code || 'CS101'}</span>
          </div>
        </div>
      </div>

      {/* Middle row */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 32px' }}>
        {(classroom?.section || classroom?.subject) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <span style={{ color: 'white', fontSize: '0.95rem', opacity: 0.9, fontWeight: '500' }}>
              {classroom?.section || classroom?.subject}
            </span>
          </div>
        )}
        <h1 style={{ color: 'white', fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>
          {classroom?.name || 'C# Programming'}
        </h1>
      </div>

      {/* Bottom row */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '32px', padding: '0 32px', backgroundColor: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', paddingTop: '16px' }}>
        {['Overview', 'Classwork', 'Materials'].map(tab => {
          const isActive = (activeTab === tab.toLowerCase() || (activeTab === 'stream' && tab === 'Overview'));
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab === 'Overview' ? 'stream' : tab.toLowerCase())}
              style={{
                background: 'none',
                border: 'none',
                color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                fontSize: '0.95rem',
                fontWeight: '600',
                paddingBottom: '16px',
                borderBottom: isActive ? '3px solid #10b981' : '3px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}
