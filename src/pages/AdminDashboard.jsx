import React, { useState, useEffect } from 'react';
import { BarChart3, Users, Home, Shield, Settings, Search, Bell, Plus, X, Trash2 } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import ProfileMenu from './ProfileMenu';

const API = 'http://localhost:3001';

export default function AdminDashboard({ onLogout }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState(null); // { type: 'error' | 'success', text }
  // Real, server-wide dashboard numbers.
  const [stats, setStats] = useState({ activeUsers: 0, activeClassrooms: 0, securityFlagsToday: 0 });

  // Add-user modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'Student' });

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API}/users`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      setUsers([]);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${API}/stats`);
      const data = await res.json();
      setStats({
        activeUsers: data.activeUsers || 0,
        activeClassrooms: data.activeClassrooms || 0,
        securityFlagsToday: data.securityFlagsToday || 0
      });
    } catch {
      /* leave previous stats in place if the server is unreachable */
    }
  };

  // Fetch the user list + stats on mount, then refresh stats periodically so
  // new security flags / classrooms show up without a manual reload.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, state set after await
    loadUsers();
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    const payload = {
      name: `${newUser.firstName} ${newUser.lastName}`.trim(),
      email: newUser.email,
      password: newUser.password,
      role: newUser.role
    };
    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'error', text: data.message || 'Could not add user' });
        return;
      }
      setIsModalOpen(false);
      setNewUser({ firstName: '', lastName: '', email: '', password: '', role: 'Student' });
      setMsg({ type: 'success', text: 'User added successfully.' });
      setTimeout(() => setMsg(null), 3000);
      loadUsers();
      loadStats();
    } catch {
      setMsg({ type: 'error', text: 'Could not connect to server. Make sure server.js is running.' });
    }
  };

  const handleDeleteUser = async (email) => {
    try {
      const res = await fetch(`${API}/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
      if (res.ok) { loadUsers(); loadStats(); }
    } catch {
      setMsg({ type: 'error', text: 'Could not connect to server.' });
    }
  };

  const formatLogin = (iso) => {
    if (!iso) return 'Never';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const filtered = users.filter(u => {
    const q = query.toLowerCase();
    return (u.name || '').toLowerCase().includes(q) ||
           (u.email || '').toLowerCase().includes(q) ||
           (u.role || '').toLowerCase().includes(q);
  });

  const navIcons = [BarChart3, Users, Home, Shield, Settings];

  // Settings is its own independent full-screen page, not an overlay.
  if (isSettingsOpen) {
    return <SettingsPanel role="Administrator" onBack={() => setIsSettingsOpen(false)} />;
  }

  return (
    <div style={styles.container}>

      {/* LEFT SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={styles.logoContainer}>
          <span style={styles.logoV}>V</span>
          <span style={styles.logoText}>erity</span>
        </div>

        <div style={styles.navGroup}>
          {navIcons.map((Icon, i) => {
            const isSettings = Icon === Settings;
            return (
              <div
                key={i}
                style={{ ...styles.navRow, ...(i === 0 ? styles.activeNavRow : {}), ...(isSettings ? { cursor: 'pointer' } : {}) }}
                onClick={isSettings ? () => setIsSettingsOpen(true) : undefined}
                title={isSettings ? 'Settings' : undefined}
              >
                <Icon size={24} color="#374151" />
                <div style={styles.navPill}></div>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1 }}></div>

        <div style={styles.adminBox}>
          <div style={styles.divider}></div>
          <div style={styles.adminRow}>
            <div style={styles.avatar}></div>
            <span style={styles.adminName}>System Admin</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={styles.main}>

        {/* Top Bar */}
        <div style={styles.topBar}>
          <h1 style={styles.title}>Dashboard Overview</h1>
          {msg && (
            <div style={msg.type === 'success' ? { ...styles.msgBar, backgroundColor: '#d1fae5', color: '#065f46' } : { ...styles.msgBar, backgroundColor: '#fee2e2', color: '#991b1b' }}>
              {msg.text}
            </div>
          )}
          <div style={styles.searchBox}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              style={styles.searchInput}
            />
            <Search size={22} color="#6b7280" />
          </div>
          <div style={styles.bell}>
            <Bell size={24} color="#374151" />
          </div>
          <button onClick={() => setIsModalOpen(true)} style={styles.addUserBtn}>
            <Plus size={20} /> <span style={{ marginLeft: '8px' }}>Add new user</span>
          </button>
          <ProfileMenu onLogout={onLogout} />
        </div>

        {/* Stat Cards */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Active users</div>
            <div style={styles.statBig}>{stats.activeUsers}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Active Classrooms</div>
            <div style={styles.statBig}>{stats.activeClassrooms}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Security Flags Today</div>
            <div style={{ ...styles.statBig, color: '#ef4444' }}>{stats.securityFlagsToday}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>System Status</div>
            <div style={{ fontSize: '1.6rem', color: '#10b981', fontWeight: 'bold' }}>Online</div>
            <div style={{ fontSize: '1.1rem', color: '#4b5563' }}>100% Uptime</div>
          </div>
        </div>

        {/* User Management */}
        <div style={styles.tableCard}>
          <h2 style={styles.tableTitle}>User Management</h2>

          <div style={styles.tableHeader}>
            <span style={styles.colName}>Name</span>
            <span style={styles.col}>Role</span>
            <span style={styles.col}>Status</span>
            <span style={styles.col}>Last Login</span>
            <span style={{ ...styles.col, textAlign: 'right' }}>Actions</span>
          </div>

          {filtered.length === 0 && (
            <p style={{ color: '#9ca3af', padding: '20px', textAlign: 'center' }}>No users found.</p>
          )}

          {filtered.map((u) => (
            <div key={u.email} style={styles.tableRow}>
              <span style={styles.colName}>{u.name}</span>
              <span style={styles.col}>{u.role}</span>
              <span style={styles.col}>
                <span style={{ ...styles.statusPill, backgroundColor: (u.status === 'Active' ? '#d1fae5' : '#fee2e2'), color: (u.status === 'Active' ? '#059669' : '#ef4444') }}>
                  {u.status || 'Active'}
                </span>
              </span>
              <span style={styles.col}>{formatLogin(u.lastLogin)}</span>
              <span style={{ ...styles.col, textAlign: 'right' }}>
                <button onClick={() => handleDeleteUser(u.email)} style={styles.deleteBtn} title="Delete user">
                  <Trash2 size={18} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ADD USER MODAL */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, color: '#1f2937' }}>Add New User</h2>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeModalBtn}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddUser} style={styles.form}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" placeholder="First Name" required value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} style={{ ...styles.input, flex: 1 }} />
                <input type="text" placeholder="Last Name" required value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} style={{ ...styles.input, flex: 1 }} />
              </div>
              <input type="email" placeholder="Email" required value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} style={styles.input} />
              <input type="password" placeholder="Password" required value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} style={styles.input} />
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} style={styles.input}>
                <option value="Student">Student</option>
                <option value="Teacher">Teacher</option>
                <option value="Admin">Admin</option>
              </select>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                <button type="submit" style={styles.submitBtn}>Add User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { height: '100%', display: 'flex', background: '#e5e7eb', fontFamily: 'sans-serif', position: 'relative' },

  // Sidebar
  sidebar: { width: '280px', background: 'linear-gradient(to bottom, #f3f4f6, #d1d5db)', padding: '30px', display: 'flex', flexDirection: 'column' },
  logoContainer: { fontSize: '2.8rem', fontWeight: '900', fontStyle: 'italic', textShadow: '2px 2px 4px rgba(0,0,0,0.1)', marginBottom: '40px' },
  logoV: { color: '#10b981' },
  logoText: { color: 'white' },
  navGroup: { display: 'flex', flexDirection: 'column', gap: '20px' },
  navRow: { display: 'flex', alignItems: 'center', gap: '15px' },
  activeNavRow: {},
  navPill: { flex: 1, height: '44px', backgroundColor: '#c4c9d0', borderRadius: '50px', boxShadow: 'inset 1px 1px 3px rgba(255,255,255,0.6), 2px 2px 5px rgba(0,0,0,0.1)' },
  adminBox: { display: 'flex', flexDirection: 'column', gap: '12px' },
  divider: { height: '1px', backgroundColor: '#9ca3af', marginBottom: '10px' },
  adminRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  avatar: { width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#d1d5db', boxShadow: '2px 2px 5px rgba(0,0,0,0.1)' },
  adminName: { fontSize: '1.3rem', color: '#1f2937', fontWeight: '500' },
  logoutBtn: { alignSelf: 'flex-start', marginLeft: '56px', padding: '6px 24px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },

  // Main
  main: { flex: 1, padding: '25px 35px', display: 'flex', flexDirection: 'column', gap: '25px', overflowY: 'auto' },
  topBar: { backgroundColor: 'white', borderRadius: '16px', padding: '18px 25px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' },
  title: { margin: 0, fontSize: '1.8rem', color: '#1f2937', whiteSpace: 'nowrap' },
  searchBox: { flex: 1, display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#e5e7eb', borderRadius: '50px', padding: '10px 20px' },
  searchInput: { flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '1rem', color: '#4b5563' },
  bell: { width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  addUserBtn: { display: 'flex', alignItems: 'center', padding: '12px 22px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 8px rgba(37,99,235,0.3)' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' },
  statCard: { backgroundColor: 'white', borderRadius: '16px', padding: '22px 25px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
  statLabel: { fontSize: '1.1rem', color: '#374151', marginBottom: '8px' },
  statBig: { fontSize: '3rem', fontWeight: 'bold', color: '#111827', lineHeight: 1 },

  tableCard: { backgroundColor: 'white', borderRadius: '20px', padding: '30px 35px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', flex: 1 },
  tableTitle: { margin: '0 0 20px 0', fontSize: '1.6rem', color: '#1f2937' },
  tableHeader: { display: 'flex', alignItems: 'center', backgroundColor: '#b8bcc4', borderRadius: '50px', padding: '14px 30px', fontWeight: 'bold', color: '#1f2937', fontSize: '1.1rem' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '16px 30px', borderBottom: '1px solid #e5e7eb', color: '#4b5563' },
  colName: { flex: 2 },
  col: { flex: 1 },
  statusPill: { padding: '4px 14px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 'bold' },
  deleteBtn: { background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px' },

  // Modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalCard: { backgroundColor: 'white', padding: '40px', borderRadius: '24px', width: '90%', maxWidth: '480px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
  closeModalBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  input: { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#4b5563', fontSize: '1rem', boxSizing: 'border-box' },
  submitBtn: { padding: '12px 40px', backgroundColor: '#2563eb', border: 'none', borderRadius: '50px', color: 'white', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' },
  msgBar: { padding: '10px 20px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '500', whiteSpace: 'nowrap', flexShrink: 0 }
};
