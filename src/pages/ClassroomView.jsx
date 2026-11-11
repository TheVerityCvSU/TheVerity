import React, { useState, useEffect } from 'react';
// IMPORTING PROFESSIONAL SVGS
import { Home, Calendar, ClipboardList, Settings, User, MoreVertical, Play, ArrowLeft, Link2 } from 'lucide-react';

// Fallback shown only if the teacher hasn't created any classwork for this class yet.
const DEFAULT_ASSIGNMENTS = [
  { id: 1, title: "Activity 1: Hello World & Variables", details: "Write a C# program that declares a string variable for your name, an integer for your age, and prints them to the console.", dueDate: "Oct 15" },
  { id: 2, title: "Activity 2: Loops and Conditions", details: "Create a for-loop that counts from 1 to 50. Use an if-statement to only print the even numbers to the console.", dueDate: "Oct 20" }
];

export default function ClassroomView({ classroom, onBack, onOpenAssignment, socket }) {
  const [expandedId, setExpandedId] = useState(null);
  const [assignments, setAssignments] = useState([]);

  // Load the classwork the teacher created for THIS classroom. We prefer the
  // backend (so it syncs across machines) and fall back to this browser's
  // localStorage copy if the server can't be reached. The teacher saves under
  // the same classroom id, so the keys line up.
  useEffect(() => {
    const classroomId = classroom?.id ?? 'default';
    const storageKey = `verity_classwork_${classroomId}`;

    // `active` items only — students shouldn't see archived classwork.
    const applyList = (list) => {
      if (Array.isArray(list) && list.length > 0) {
        setAssignments(list.filter(item => !item.archived));
      } else {
        setAssignments(DEFAULT_ASSIGNMENTS);
      }
    };

    const loadFromLocal = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        applyList(saved ? JSON.parse(saved) : null);
      } catch {
        setAssignments(DEFAULT_ASSIGNMENTS);
      }
    };

    // 1. Try the backend first.
    let cancelled = false;
    fetch(`http://localhost:3001/classwork/${classroomId}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data.classwork) && data.classwork.length > 0) {
          applyList(data.classwork);
        } else {
          loadFromLocal();
        }
      })
      .catch(() => { if (!cancelled) loadFromLocal(); });

    // 2. Live updates: when the teacher saves, refresh instantly.
    const onClassworkChanged = (payload) => {
      if (String(payload.classroomId) === String(classroomId)) {
        applyList(payload.classwork);
      }
    };
    if (socket) socket.on('classwork_changed', onClassworkChanged);

    // 3. Same-browser updates from another tab.
    const onStorage = (e) => { if (e.key === storageKey) loadFromLocal(); };
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      if (socket) socket.off('classwork_changed', onClassworkChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [classroom, socket]);

  const toggleActivity = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div style={styles.container}>
      
      {/* LEFT SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={styles.logoContainer}>
          <span style={styles.logoV}>V</span>
          <span style={styles.logoText}>erity</span>
        </div>

        <div style={styles.navGroup}>
          <div style={styles.navItem} onClick={onBack}>
            <ArrowLeft size={20} /> <span style={{ marginLeft: '10px' }}>Back</span>
          </div>
          <div style={styles.navItem}>
            <Calendar size={20} /> <span style={{ marginLeft: '10px' }}>Schedule</span>
          </div>
          <div style={{...styles.navItem, ...styles.activeNavItem}}>
            <ClipboardList size={20} /> <span style={{ marginLeft: '10px' }}>Activities</span>
          </div>
        </div>

        <div style={{ flex: 1 }}></div>

        <div style={styles.settingsIcon}>
          <Settings size={28} />
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={styles.mainContent}>
        
        {/* Top Bar */}
        <div style={styles.topBar}>
          <div style={styles.profileCircle}>
            <User size={24} color="#6b7280" />
          </div>
        </div>

        {/* The Main White Card */}
        <div style={styles.whiteCard}>
          <h2 style={{ color: '#4b5563', marginBottom: '20px', paddingLeft: '10px' }}>
            {classroom ? classroom.name : "Classroom Activities"}
          </h2>

          {/* List of Assignments */}
          <div style={styles.assignmentList}>
            {assignments.length === 0 && (
              <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: '40px' }}>
                No activities yet. Check back once your instructor adds one.
              </p>
            )}
            {assignments.map((task) => {
              const isExpanded = expandedId === task.id;
              return (
                <div key={task.id} style={styles.assignmentWrapper}>

                  <div style={styles.assignmentHeader}>
                    <div style={styles.titlePill} onClick={() => toggleActivity(task.id)}>{task.title}</div>
                    <div style={styles.threeDots}><MoreVertical size={20} /></div>
                  </div>

                  {/* The "Details" Box — only shown when the activity is expanded */}
                  {isExpanded && (
                    <div style={styles.detailsBox}>
                      <p style={{ margin: 0, color: '#4b5563', lineHeight: '1.5' }}>{task.details}</p>

                      {task.attachments?.length > 0 && (
                        <div style={styles.cardAttachments}>
                          {task.attachments.map((att, i) => {
                            if (att.type === 'image') {
                              return <a key={i} href={att.url} target="_blank" rel="noreferrer"><img src={att.url} alt={att.name} style={styles.attachThumb} /></a>;
                            }
                            if (att.type === 'video') {
                              return <video key={i} src={att.url} controls style={styles.attachVideo} />;
                            }
                            return (
                              <a key={i} href={att.url} target="_blank" rel="noreferrer" style={{ ...styles.attachLink, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Link2 size={13} /> {att.name}
                              </a>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 'bold' }}>{task.dueDate ? `Due: ${task.dueDate}` : 'No Due Date'}</span>
                        <button style={styles.startButton} onClick={() => onOpenAssignment(task)}>
                          Start Coding <Play size={14} fill="currentColor" style={{ marginLeft: '6px' }} />
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}

// STYLES matching prototype
const styles = {
  container: { height: '100%', display: 'flex', background: 'linear-gradient(to bottom, #f3f4f6 0%, #cbd5e1 100%)', fontFamily: 'sans-serif' },
  sidebar: { width: '250px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '40px' },
  logoContainer: { fontSize: '2.5rem', fontWeight: '900', fontStyle: 'italic', textShadow: '2px 2px 4px rgba(0,0,0,0.1)' },
  logoV: { color: '#10b981' },
  logoText: { color: 'white' },
  navGroup: { display: 'flex', flexDirection: 'column', gap: '15px' },
  navItem: { display: 'flex', alignItems: 'center', padding: '12px 20px', backgroundColor: '#d1d5db', borderRadius: '50px', color: '#4b5563', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'inset 2px 2px 5px rgba(255,255,255,0.7), inset -2px -2px 5px rgba(0,0,0,0.1)' },
  activeNavItem: { backgroundColor: '#e2e8f0' },
  settingsIcon: { color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  mainContent: { flex: 1, padding: '30px 50px', display: 'flex', flexDirection: 'column' },
  topBar: { display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' },
  profileCircle: { width: '50px', height: '50px', backgroundColor: '#d1d5db', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '2px 2px 5px rgba(0,0,0,0.1)' },
  whiteCard: { backgroundColor: 'white', flex: 1, borderRadius: '24px', padding: '40px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', overflowY: 'auto' },
  assignmentList: { display: 'flex', flexDirection: 'column', gap: '30px' },
  assignmentWrapper: { display: 'flex', flexDirection: 'column', gap: '10px' },
  assignmentHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  titlePill: { backgroundColor: '#d1d5db', padding: '8px 20px', borderRadius: '50px', color: '#4b5563', fontWeight: 'bold', display: 'inline-block', cursor: 'pointer', userSelect: 'none' },
  threeDots: { color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  detailsBox: { backgroundColor: '#d1d5db', padding: '25px', borderRadius: '20px' },
  cardAttachments: { display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '15px', alignItems: 'flex-start' },
  attachThumb: { maxWidth: '140px', maxHeight: '100px', borderRadius: '8px', objectFit: 'cover', display: 'block' },
  attachVideo: { maxWidth: '220px', maxHeight: '140px', borderRadius: '8px', backgroundColor: '#000' },
  attachLink: { display: 'inline-flex', alignItems: 'center', color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem', wordBreak: 'break-all' },
  startButton: { display: 'flex', alignItems: 'center', padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }
};