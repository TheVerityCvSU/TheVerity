const fs = require('fs');
const path = require('path');
const teacherPath = path.join('c:/Users/vicfa/The-Verity/frontend/src/pages/TeacherDashboard.jsx');
let teacher = fs.readFileSync(teacherPath, 'utf8');

// 1. Add missing state to teacher
if(!teacher.includes('isHeaderHovered')) {
  teacher = teacher.replace('const [activeMenu, setActiveMenu] = useState(null);', 'const [activeMenu, setActiveMenu] = useState(null);\n  const [isHeaderHovered, setIsHeaderHovered] = useState(false);\n  const [isFadingOut, setIsFadingOut] = useState(false);');
}

// 2. Fix indicatorStyle layout effect
teacher = teacher.replace(
  /const \[indicatorStyle, setIndicatorStyle\] = useState\(\{ top: 0, height: 0, opacity: 0 \}\);/,
  'const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });'
);

const layoutEffectOld = `useLayoutEffect(() => {
    const update = () => {
      const activeRef = navRefs.current[activeView];
      if (activeRef) {
        try {
          sessionStorage.setItem('verity_teacher_nav_indicator_top', String(activeRef.offsetTop));
          sessionStorage.setItem('verity_teacher_nav_indicator_height', String(activeRef.offsetHeight));
        } catch { /* ignore */ }

        setIndicatorStyle(prev => {
          const distance = Math.abs(activeRef.offsetTop - prev.top);
          const bounceOvershoot = distance > 0 ? Math.min(0.42, Math.max(0.03, 16 / distance)) : 0;
          const bounceRatio = (1 + bounceOvershoot).toFixed(3);
          const duration = distance > 150 ? '0.46s' : '0.38s';
          const transitionStr = \`top \${duration} cubic-bezier(0.34, \${bounceRatio}, 0.64, 1), height 0.25s ease, opacity 0.2s ease\`;

          if (prev.top === activeRef.offsetTop && prev.height === activeRef.offsetHeight && prev.opacity === 1 && prev.transition === transitionStr) return prev;
          return { top: activeRef.offsetTop, height: activeRef.offsetHeight, opacity: 1, transition: transitionStr };
        });
      } else {
        setIndicatorStyle(prev => prev.opacity === 0 ? prev : { ...prev, opacity: 0 });
      }
    };

    update();
    const timer = setTimeout(update, 20);
    return () => clearTimeout(timer);
  }, [activeView, collapsed]);`;

const layoutEffectNew = `useLayoutEffect(() => {
    const activeRef = navRefs.current[activeView];
    if (activeRef) {
      setIndicatorStyle(prev => ({
        left: activeRef.offsetLeft,
        width: activeRef.offsetWidth,
        opacity: 1,
        transition: prev.opacity === 0 ? 'none' : 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
      }));
    }
  }, [activeView]);`;

teacher = teacher.replace(layoutEffectOld, layoutEffectNew);

let teacherReturnIndex = teacher.indexOf('return (\n    <div style={styles.container}>');

let newReturn = `return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: isFadingOut ? 0 : 1 }} 
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        minHeight: '100vh',
        backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ═══ GLOBAL TOP HEADER (Copied from Student) ═══ */}
      <header 
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
        borderBottom: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {activeView !== 'compiler' && (
          <div style={{
            position: 'absolute',
            bottom: '-30px',
            left: 0,
            right: 0,
            height: '30px',
            background: \`linear-gradient(to bottom, \${isDark ? '#1a1a1a' : '#f8f9fa'}, transparent)\`,
            pointerEvents: 'none'
          }} />
        )}

        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'baseline', cursor: 'pointer', flex: 1, justifyContent: 'flex-start' }} onClick={() => handleSetView('classrooms')}>
          <span style={{ color: '#10b981', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>V</span>
          <span style={{ color: isDark ? '#f5f5f5' : '#111827', fontSize: '1.75rem', fontWeight: '900', fontStyle: 'italic' }}>erity</span>
          <span style={{ fontSize: '0.7rem', color: isDark ? '#a3a3a3' : '#6b7280', marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructor</span>
        </div>

        {/* Center: Navigation */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '8px',
          opacity: isHeaderHovered ? 1 : 0,
          pointerEvents: isHeaderHovered ? 'auto' : 'none',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          transform: isHeaderHovered ? 'translateY(0)' : 'translateY(-10px)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            top: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '50px',
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 4px 16px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.35)',
            transition: indicatorStyle.transition || 'none',
            opacity: indicatorStyle.opacity,
            pointerEvents: 'none',
            zIndex: 0,
          }} />

          {navItems.map(item => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                ref={el => navRefs.current[item.id] = el}
                onClick={() => handleSetView(item.id)}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '50px',
                  background: 'transparent',
                  border: '1px solid transparent',
                  color: active ? '#10b981' : (isDark ? '#a3a3a3' : '#6b7280'),
                  fontWeight: active ? '700' : '600',
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


          <button
            ref={el => navRefs.current['settings'] = el}
            onClick={() => handleSetView('settings')}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              borderRadius: '50px',
              backgroundColor: 'transparent',
              color: isDark ? '#a3a3a3' : '#6b7280',
              border: 'none',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            <Settings size={20} />
            <span style={{ marginLeft: '8px', fontWeight: '600', fontSize: '0.9rem' }}>Settings</span>
          </button>
        </div>

        {/* Right: Profile */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: '16px' }}>
          <ProfileMenu currentUser={currentUser} onLogout={onLogout} />
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: activeView === 'compiler' ? 'hidden' : 'visible',
        padding: activeView === 'compiler' ? 0 : '40px',
        maxWidth: activeView === 'compiler' ? '100%' : '1400px',
        margin: activeView === 'compiler' ? 0 : '0 auto',
        width: '100%'
      }}>
        <AnimatePresence mode="wait" custom={slideDirection}>
          {activeView === 'calendar' && (
            <motion.div key="calendar" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <TeacherCalendar classrooms={classrooms} />
            </motion.div>
          )}

          {activeView === 'archived' && (
            <motion.div key="archived" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', padding: '0 10px' }}>
                <h2 style={{ color: isDark ? '#E8EAED' : '#4b5563', margin: 0 }}>Archived Classrooms</h2>
              </div>

              {classrooms.filter(c => c.archived).length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}>
                  <h3 style={{ margin: 0, color: isDark ? '#a3a3a3' : '#6b7280' }}>No Archived Classrooms</h3>
                  <p style={{ marginTop: '10px', color: isDark ? '#6b7280' : '#9ca3af' }}>Classrooms you archive will appear here.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                  {classrooms.filter(c => c.archived).map(cls => (
                    <ClassroomCard
                      key={cls.id}
                      classroom={cls}
                      onEnter={onEnterClassroom}
                      onUnarchive={handleUnarchiveClass}
                      onDelete={(allowDelete || currentUser?.role === 'Admin') ? handleDeleteClass : undefined}
                      isArchived={true}
                      role="Teacher"
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div key="settings" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <SettingsPanel role="Instructor" />
            </motion.div>
          )}
          
          {activeView === 'compiler' && (
            <motion.div key="compiler" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <CompilerView />
            </motion.div>
          )}

          {activeView === 'classroomSettings' && settingsClassroom && (
            <motion.div key="classroomSettings" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <ClassroomSettings
                classroom={settingsClassroom}
                onClose={() => { setSettingsClassroom(null); handleSetView('classrooms'); }}
                onUpdate={(updated) => {
                  setClassrooms(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
                  setSettingsClassroom(updated);
                }}
              />
            </motion.div>
          )}

          {activeView === 'classrooms' && (
            <motion.div key="classrooms" custom={slideDirection} variants={drillVariants} initial="initial" animate="animate" exit="exit">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', padding: '0 10px' }}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleOpenCreateModal}
                  style={{
                    padding: '12px 24px', backgroundColor: '#10b981', color: '#ffffff',
                    border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold',
                    cursor: 'pointer', boxShadow: '0 8px 20px rgba(16,185,129,0.3)'
                  }}
                >
                  Create
                </motion.button>
              </div>

              {/* Classroom Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                {loadingClassrooms
                  ? Array.from({ length: 4 }).map((_, i) => <Skeleton.Card key={i} />)
                  : classrooms.filter(c => !c.archived).length === 0 ? (
                    <div style={{
                      gridColumn: '1 / -1',
                      padding: '50px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                      borderRadius: '20px',
                      border: isDark ? '1.5px dashed #404040' : '1.5px dashed #cbd5e1'
                    }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        backgroundColor: isDark ? '#262626' : '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '14px'
                      }}>
                        <Home size={28} color="#10b981" />
                      </div>
                      <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: '700', color: isDark ? '#f5f5f5' : '#1e293b' }}>
                        No Classrooms Yet
                      </h3>
                      <p style={{ margin: '0 0 16px', maxWidth: '380px', fontSize: '0.88rem', color: isDark ? '#a3a3a3' : '#64748b' }}>
                        Click <strong>Create</strong> above to create your first classroom.
                      </p>
                    </div>
                  ) : classrooms.filter(c => !c.archived).map((cls, idx) => (
                  <motion.div
                    key={cls.id}
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, delay: idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <ClassroomCard
                      classroom={cls}
                      onEnter={onEnterClassroom}
                      onArchive={handleArchiveClass}
                      onSettings={(c) => {
                        setSettingsClassroom(c);
                        handleSetView('classroomSettings');
                      }}
                      onDelete={(allowDelete || currentUser?.role === 'Admin') ? handleDeleteClass : undefined}
                      role="Teacher"
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      {isMobile && (
        <nav style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          backgroundColor: isDark ? '#262626' : '#ffffff',
          borderTop: isDark ? '1px solid #3f3f46' : '1px solid #e5e7eb',
          height: '65px',
          flexShrink: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 60
        }}>
          {[...navItems, { id: 'settings', Icon: Settings, label: 'Settings' }].map(({ id, Icon, label }) => {
            const active = activeView === id || (id === 'settings' && activeView === 'classroomSettings');
            return (
              <button
                key={id}
                onClick={() => handleSetView(id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  color: active ? '#10b981' : (isDark ? '#a3a3a3' : '#64748b'),
                  cursor: 'pointer',
                  padding: '8px',
                  minWidth: '64px'
                }}
              >
                <Icon size={20} style={{ marginBottom: '4px' }} />
                <span style={{ fontSize: '0.65rem', fontWeight: active ? '700' : '600' }}>{label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
          }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                backgroundColor: isDark ? '#1e1e1e' : '#fff',
                padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '400px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              }}
            >
              <h2 style={{ margin: '0 0 24px', color: isDark ? '#fff' : '#111827', fontSize: '1.5rem', fontWeight: 'bold' }}>Create Class</h2>
              <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#a3a3a3' : '#4b5563' }}>Class Name (Required)</label>
                  <input
                    type="text"
                    value={newClass.name}
                    onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                    required
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      border: \`2px solid \${nameFocused ? '#10b981' : (isDark ? '#404040' : '#e5e7eb')}\`,
                      backgroundColor: isDark ? '#262626' : '#f9fafb', color: isDark ? '#fff' : '#111827',
                      outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                    }}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    placeholder="e.g., AP Computer Science"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#a3a3a3' : '#4b5563' }}>Section (Optional)</label>
                  <input
                    type="text"
                    value={newClass.section}
                    onChange={(e) => setNewClass({ ...newClass, section: e.target.value })}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      border: \`2px solid \${sectionFocused ? '#10b981' : (isDark ? '#404040' : '#e5e7eb')}\`,
                      backgroundColor: isDark ? '#262626' : '#f9fafb', color: isDark ? '#fff' : '#111827',
                      outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                    }}
                    onFocus={() => setSectionFocused(true)}
                    onBlur={() => setSectionFocused(false)}
                    placeholder="e.g., Room 204"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#a3a3a3' : '#4b5563' }}>Subject (Optional)</label>
                  <input
                    type="text"
                    value={newClass.subject}
                    onChange={(e) => setNewClass({ ...newClass, subject: e.target.value })}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      border: \`2px solid \${subjectFocused ? '#10b981' : (isDark ? '#404040' : '#e5e7eb')}\`,
                      backgroundColor: isDark ? '#262626' : '#f9fafb', color: isDark ? '#fff' : '#111827',
                      outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                    }}
                    onFocus={() => setSubjectFocused(true)}
                    onBlur={() => setSubjectFocused(false)}
                    placeholder="e.g., Programming"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                  <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: 'transparent', color: isDark ? '#a3a3a3' : '#6b7280', fontWeight: '600', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );`;

let newTeacherStr = teacher.substring(0, teacherReturnIndex) + newReturn;

fs.writeFileSync(teacherPath, newTeacherStr);
console.log('TeacherDashboard.jsx updated successfully!');
