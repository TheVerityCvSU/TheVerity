const fs = require('fs');
const file = 'frontend/src/pages/ClassroomView.jsx';
let content = fs.readFileSync(file, 'utf8');

const returnStartIdx = content.indexOf('return (\n    <div style={styles.container}>');
const classworkTabIdx = content.indexOf('{/* ═══ TAB 2: CLASSWORK ═══ */}');

if (returnStartIdx === -1 || classworkTabIdx === -1) {
  console.log('Could not find boundaries');
  process.exit(1);
}

const newJSX = `return (
    <div style={{ minHeight: '100vh', backgroundColor: bgColor, fontFamily: '"Inter", "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column', color: textColor }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        backgroundColor: cardBg,
        borderBottom: isDark ? '1px solid #333' : '1px solid #e5e7eb',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer' }} onClick={() => onNavigateView ? onNavigateView('classrooms') : onBack()}>
          <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
          <span style={{ color: textColor, fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
          <span style={{ fontSize: '0.7rem', color: textMuted, marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[
            { id: 'home', label: 'Home', Icon: Home },
            { id: 'calendar', label: 'Calendar', Icon: Calendar },
            { id: 'stream', label: 'Classroom', Icon: BookOpen },
            { id: 'archived', label: 'Archived', Icon: Archive }
          ].map(item => {
            const active = item.id === 'stream';
            return (
              <button
                key={item.id}
                onClick={() => onNavigateView && onNavigateView(item.id === 'stream' ? 'classrooms' : item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '50px',
                  backgroundColor: active ? (isDark ? '#064e3b' : '#d1fae5') : 'transparent',
                  color: active ? '#059669' : textMuted,
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <item.Icon size={18} />
                {item.label}
              </button>
            );
          })}
          <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '50px', backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', marginLeft: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
            <Plus size={18} /> Add course
          </button>
          <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: '50px', backgroundColor: 'transparent', color: textMuted, border: 'none', cursor: 'pointer', marginLeft: '8px' }}>
            <Settings size={20} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
        </div>
      </header>

      <main style={{ flex: 1, padding: '24px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* HERO BANNER */}
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
            background: \`linear-gradient(to right, rgba(15, 23, 42, 1) 0%, rgba(15, 23, 42, 0.85) 30%, rgba(15, 23, 42, 0.3) 60%, transparent 100%), url(\${bannerTheme.customImageUrl || bannerTheme.image || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80'}) center/cover no-repeat\`,
            zIndex: 0
          }} />
          
          {/* Top row */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', padding: '24px 32px' }}>
            <button onClick={() => onNavigateView ? onNavigateView('classrooms') : onBack()} style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}>
              <ArrowLeft size={18} /> All courses
            </button>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', backdropFilter: 'blur(8px)', cursor: 'pointer' }}>
                <Bell size={18} />
              </div>
              <div style={{ padding: '8px 16px', borderRadius: '50px', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.85rem', fontWeight: '500', backdropFilter: 'blur(8px)' }}>
                Class code <span style={{ fontWeight: 'bold', marginLeft: '6px' }}>{classroom?.code || 'CS101'}</span>
              </div>
            </div>
          </div>

          {/* Middle row */}
          <div style={{ position: 'relative', zIndex: 1, padding: '0 32px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
               <div style={{ backgroundColor: '#dcfce7', color: '#065f46', padding: '4px 12px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 'bold' }}>{classroom?.code || 'CS101'}</div>
               <span style={{ color: 'white', fontSize: '0.9rem' }}>{classroom?.section || 'Section A'}</span>
             </div>
             <h1 style={{ color: 'white', fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>{classroom?.name || 'C# Programming'}</h1>
          </div>

          {/* Bottom row */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '32px', padding: '0 32px', backgroundColor: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', paddingTop: '16px' }}>
            {['Overview', 'Classwork', 'Materials', 'People'].map(tab => {
               const isActive = (activeTab === tab.toLowerCase() || (activeTab === 'stream' && tab === 'Overview'));
               return (
               <button key={tab} onClick={() => handleTabChange(tab === 'Overview' ? 'stream' : tab.toLowerCase())} style={{ background: 'none', border: 'none', color: isActive ? 'white' : 'rgba(255,255,255,0.7)', fontSize: '0.95rem', fontWeight: '600', paddingBottom: '16px', borderBottom: isActive ? '3px solid #10b981' : '3px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
                 {tab}
               </button>
               );
            })}
          </div>
        </div>

        {/* MAIN GRID */}
        {activeTab === 'stream' && (
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
           {/* LEFT COLUMN */}
           <div style={{ flex: '1 1 65%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
             
             {/* Upcoming Work */}
             <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                 <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                   <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Upcoming work</h2>
                   <span style={{ fontSize: '0.85rem', color: textMuted }}>3 items</span>
                 </div>
                 <button onClick={() => handleTabChange('classwork')} style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   View all <ChevronRight size={16} />
                 </button>
               </div>
               
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                 {/* Card 1 */}
                 <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '20px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                     <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                       <TerminalSquare size={16} />
                     </div>
                     <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: textMuted }}>TODAY - 09:30</span>
                   </div>
                   <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#8b5cf6', letterSpacing: '0.05em', marginBottom: '4px' }}>ASSIGNMENT</div>
                   <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '6px' }}>Methods checkpoint</div>
                   <div style={{ fontSize: '0.8rem', color: textMuted }}>8 questions · 15 min</div>
                 </div>
                 
                 {/* Card 2 */}
                 <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '20px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                     <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                       <TerminalSquare size={16} />
                     </div>
                     <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: textMuted }}>FRI - 11:59 PM</span>
                   </div>
                   <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#8b5cf6', letterSpacing: '0.05em', marginBottom: '4px' }}>ASSIGNMENT</div>
                   <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '6px' }}>Build a grade calculator</div>
                   <div style={{ fontSize: '0.8rem', color: textMuted }}>Starter file included</div>
                 </div>

                 {/* Card 3 */}
                 <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '20px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                     <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                       <TerminalSquare size={16} />
                     </div>
                     <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: textMuted }}>MON - 10:00 AM</span>
                   </div>
                   <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#8b5cf6', letterSpacing: '0.05em', marginBottom: '4px' }}>ASSIGNMENT</div>
                   <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '6px' }}>When should a method return?</div>
                   <div style={{ fontSize: '0.8rem', color: textMuted }}>1 post + 2 replies</div>
                 </div>
               </div>
             </div>

             {/* Learning Materials */}
             <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                 <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                   <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Learning materials</h2>
                   <span style={{ fontSize: '0.85rem', color: textMuted }}>Module 4</span>
                 </div>
                 <button style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   Open library <ChevronRight size={16} />
                 </button>
               </div>
               
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                 {/* Mat 1 */}
                 <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px 20px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
                     <FileText size={20} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '2px' }}>Methods quick guide</div>
                     <div style={{ fontSize: '0.75rem', color: textMuted }}>PDF · 6 pages</div>
                   </div>
                   <ChevronRight size={18} color={textMuted} />
                 </div>
                 
                 {/* Mat 2 */}
                 <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px 20px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', flexShrink: 0 }}>
                     <TerminalSquare size={20} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '2px' }}>Practice sandbox</div>
                     <div style={{ fontSize: '0.75rem', color: textMuted }}>Interactive editor</div>
                   </div>
                   <ChevronRight size={18} color={textMuted} />
                 </div>

                 {/* Mat 3 */}
                 <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px 20px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', flexShrink: 0 }}>
                     <PlayCircle size={20} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '2px' }}>Parameter patterns</div>
                     <div style={{ fontSize: '0.75rem', color: textMuted }}>Video · 12 min</div>
                   </div>
                   <ChevronRight size={18} color={textMuted} />
                 </div>
               </div>
             </div>
             
           </div>

           {/* RIGHT COLUMN */}
           <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
             
             {/* Main Right Card */}
             <div style={{ backgroundColor: cardBg, borderRadius: '24px', padding: '24px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '24px' }}>
               
               {/* Teacher Info */}
               <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                 <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#059669', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                   KF
                 </div>
                 <div>
                   <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#10b981', letterSpacing: '0.05em', textTransform: 'uppercase' }}>YOUR TEACHER</div>
                   <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{classroom?.instructor || 'Kim Fabie'}</div>
                   <div style={{ fontSize: '0.75rem', color: textMuted }}>Offline 24 hours ago</div>
                 </div>
               </div>

               {/* Announcement */}
               <div style={{ backgroundColor: isDark ? '#064e3b' : '#dcfce7', borderRadius: '16px', padding: '16px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                   <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#34d399' : '#059669' }}>
                     <ClipboardList size={12} />
                   </div>
                   <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: isDark ? '#34d399' : '#059669', letterSpacing: '0.05em' }}>LATEST ANNOUNCEMENT</span>
                   <span style={{ fontSize: '0.65rem', color: isDark ? '#6ee7b7' : '#047857', marginLeft: 'auto' }}>Today</span>
                 </div>
                 <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '6px', color: isDark ? 'white' : '#064e3b' }}>Live coding lab moved to Friday</div>
                 <div style={{ fontSize: '0.8rem', color: isDark ? 'rgba(255,255,255,0.7)' : '#065f46', lineHeight: 1.4 }}>Bring your grade calculator draft—we'll review methods together.</div>
               </div>

               {/* Classmates */}
               <div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                   <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Classmates</span>
                   <span style={{ fontSize: '0.8rem', color: textMuted }}>24 enrolled</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ display: 'flex' }}>
                     {['#f59e0b', '#6366f1', '#10b981', '#ef4444'].map((col, i) => (
                       <div key={i} style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: col, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', border: \`2px solid \${cardBg}\`, marginLeft: i > 0 ? '-8px' : 0, zIndex: 4 - i }}>
                         {['AM', 'JL', 'RK', 'NS'][i]}
                       </div>
                     ))}
                     <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: isDark ? '#404040' : '#f1f5f9', color: textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', border: \`2px solid \${cardBg}\`, marginLeft: '-8px', zIndex: 0 }}>
                       +20
                     </div>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                     <span style={{ fontSize: '0.75rem', color: textMuted }}>8 online</span>
                   </div>
                 </div>
               </div>

               {/* Class Discussion Button */}
               <div style={{ backgroundColor: isDark ? '#1e293b' : '#0f172a', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <MessageSquare size={20} color="#38bdf8" />
                   <div>
                     <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Class discussion</div>
                     <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>3 new replies</div>
                   </div>
                 </div>
                 <button style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>
                   Open
                 </button>
               </div>
               
             </div>

             {/* Next Live Session */}
             <div style={{ backgroundColor: cardBg, borderRadius: '24px', padding: '20px', border: isDark ? '1px solid #333' : '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
               <div style={{ backgroundColor: isDark ? '#3b0764' : '#f3e8ff', borderRadius: '16px', width: '54px', height: '54px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#9333ea', letterSpacing: '0.05em' }}>FRI</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isDark ? 'white' : '#6b21a8' }}>02</div>
               </div>
               <div style={{ flex: 1 }}>
                 <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#8b5cf6', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>NEXT LIVE SESSION</div>
                 <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '2px' }}>Methods coding lab</div>
                 <div style={{ fontSize: '0.75rem', color: textMuted }}>10:00 am · Room 3B</div>
               </div>
               <CalendarIcon size={20} color={textMuted} />
             </div>

           </div>
        </div>
        )}
        
        {/* ═══ TAB 2: CLASSWORK ═══ */}
`;

content = content.substring(0, returnStartIdx) + newJSX + content.substring(classworkTabIdx + 32);

fs.writeFileSync(file, content);
