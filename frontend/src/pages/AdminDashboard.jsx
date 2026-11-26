import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './admin/AdminLayout';
import DashboardOverview from './admin/DashboardOverview';
import UserManagement from './admin/UserManagement';
import GlobalClasses from './admin/GlobalClasses';
import SecurityLogs from './admin/SecurityLogs';
import AdminSettings from './admin/AdminSettings';
import { apiFetch } from '../data/api';

export default function AdminDashboard({ currentUser, onLogout, socket }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('verity_sidebar_collapsed');
    return saved ? saved === 'true' : false;
  });
  const [query, setQuery] = useState('');
  const [dashboardSearchFocused, setDashboardSearchFocused] = useState(false);
  const [msg, setMsg] = useState(null);
  const [maliciousAlert, setMaliciousAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ activeUsers: 0, activeClassrooms: 0, securityFlagsToday: 0, altTabCopyPasteFlags: 0 });

  const loadStats = async () => {
    try {
      const r = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/stats`); const d = await r.json();
      setStats({ activeUsers: d.activeUsers || 0, activeClassrooms: d.activeClassrooms || 0, securityFlagsToday: d.securityFlagsToday || 0, altTabCopyPasteFlags: d.altTabCopyPasteFlags || 0 });
    } catch { /* keep previous */ }
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSelectUsersPopup, setShowSelectUsersPopup] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'Student' });

  const loadNotifications = async () => {
    try {
      const r = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/notifications`);
      if (r.ok) {
        const d = await r.json();
        const fetched = d.notifications || [];
        let readKeys = [];
        try {
          const stored = localStorage.getItem('verity_notifications_read_keys');
          if (stored) readKeys = JSON.parse(stored);
        } catch {}
        const unread = fetched.filter(n => !readKeys.includes(`${n.id}:${n.text}`));
        setNotifications(unread);
      }
    } catch { /* keep previous */ }
  };

  const handleUpdateUser = async (email, updates) => {
    try {
      const endpoint = (Object.keys(updates).length === 1 && updates.status)
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/${encodeURIComponent(email)}/status`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/${encodeURIComponent(email)}`;
      const res = await apiFetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.message || 'Failed to update user' };
      }
      setUsers(prev => prev.map(u => u.email === email ? { ...u, ...updates, ...(data.user || {}) } : u));
      loadStats();
      loadNotifications();
      return { success: true, user: data.user };
    } catch (err) {
      console.error("Failed to update user", err);
      return { success: false, message: 'Server connection error' };
    }
  };

  const loadUsers = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const r = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users`);
      if (!r.ok) {
        console.warn(`[AdminDashboard] Failed to fetch users: HTTP ${r.status}`);
        if (showLoading) setUsers([]);
        return;
      }
      const d = await r.json();
      setUsers(d.users || []);
    } catch (err) {
      console.warn('[AdminDashboard] Error loading users:', err);
      if (showLoading) setUsers([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      loadUsers();
      loadStats();
      loadNotifications();
    });
    const iv = setInterval(() => {
      loadStats();
      loadNotifications();
      loadUsers(false);
    }, 10000);

    const handleServerOrDataChange = () => {
      loadUsers(false);
      loadStats();
      loadNotifications();
    };
    window.addEventListener('verity:server-changed', handleServerOrDataChange);
    window.addEventListener('verity:users-changed', handleServerOrDataChange);
    window.addEventListener('verity:sync-completed', handleServerOrDataChange);

    return () => {
      clearInterval(iv);
      window.removeEventListener('verity:server-changed', handleServerOrDataChange);
      window.removeEventListener('verity:users-changed', handleServerOrDataChange);
      window.removeEventListener('verity:sync-completed', handleServerOrDataChange);
    };
  }, []);

  // Real-time socket event listener for live alerts & Alt-Tab violations
  useEffect(() => {
    if (!socket) return;
    const handleLiveSecurityAlert = (data) => {
      loadStats();
      loadUsers(false);
      loadNotifications();
      if (data && (data.isMaliciousScript || (data.type || '').toLowerCase().includes('malicious'))) {
        setMaliciousAlert(data);
        setTimeout(() => setMaliciousAlert(null), 8000);
      }
    };
    socket.on('admin_security_alert', handleLiveSecurityAlert);
    socket.on('admin_stats_update', handleLiveSecurityAlert);
    socket.on('users_updated', handleLiveSecurityAlert);
    return () => {
      socket.off('admin_security_alert', handleLiveSecurityAlert);
      socket.off('admin_stats_update', handleLiveSecurityAlert);
      socket.off('users_updated', handleLiveSecurityAlert);
    };
  }, [socket]);

  useEffect(() => {
    localStorage.setItem('verity_sidebar_collapsed', sidebarCollapsed);
  }, [sidebarCollapsed]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    const payload = { name: `${newUser.firstName} ${newUser.lastName}`.trim(), email: newUser.email, password: newUser.password, role: newUser.role };
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.message || 'Could not add user' }); return; }
      setIsModalOpen(false);
      setNewUser({ firstName: '', lastName: '', email: '', password: '', role: 'Student' });
      setMsg({ type: 'success', text: 'User added successfully.' });
      setTimeout(() => setMsg(null), 3000);
      loadUsers(); loadStats(); loadNotifications();
    } catch { setMsg({ type: 'error', text: 'Could not connect to server.' }); }
  };

  const handleDeleteUser = async (email) => {
    try {
      const r = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const message = data.message || 'Failed to delete user';
        setMsg({ type: 'error', text: message });
        return { success: false, message };
      }
      loadUsers();
      loadStats();
      loadNotifications();
      return { success: true };
    } catch {
      const message = 'Could not connect to server.';
      setMsg({ type: 'error', text: message });
      return { success: false, message };
    }
  };

  return (
    <AdminLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      query={query}
      setQuery={setQuery}
      dashboardSearchFocused={dashboardSearchFocused}
      setDashboardSearchFocused={setDashboardSearchFocused}
      notifications={notifications}
      setNotifications={setNotifications}
      showNotifications={showNotifications}
      setShowNotifications={setShowNotifications}
      isModalOpen={isModalOpen}
      setIsModalOpen={setIsModalOpen}
      newUser={newUser}
      setNewUser={setNewUser}
      handleAddUser={handleAddUser}
      currentUser={currentUser}
      onLogout={onLogout}
      showSelectUsersPopup={showSelectUsersPopup}
      setShowSelectUsersPopup={setShowSelectUsersPopup}
    >
      <div style={{ display: activeTab === 'dashboard' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <DashboardOverview
          stats={stats}
          users={users}
          loading={loading}
          query={query}
          setQuery={setQuery}
          onDeleteUser={handleDeleteUser}
          msg={msg}
        />
      </div>
      <div style={{ display: activeTab === 'users' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <UserManagement
          users={users}
          loading={loading}
          onDeleteUser={handleDeleteUser}
          onUpdateUser={handleUpdateUser}
          onShowSelectUsersPopup={setShowSelectUsersPopup}
        />
      </div>
      <div style={{ display: activeTab === 'classes' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <GlobalClasses />
      </div>
      <div style={{ display: activeTab === 'security' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <SecurityLogs />
      </div>
      <div style={{ display: activeTab === 'settings' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <AdminSettings currentUser={currentUser} />
      </div>

      <AnimatePresence>
        {maliciousAlert && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => {
              setActiveTab('security');
              setMaliciousAlert(null);
            }}
            style={{
              position: 'fixed',
              top: '20px',
              right: '24px',
              zIndex: 9999999,
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              border: '2px solid #ef4444',
              borderRadius: '16px',
              padding: '14px 18px',
              boxShadow: '0 12px 32px rgba(220, 38, 38, 0.35)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              maxWidth: '440px',
              cursor: 'pointer'
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#991b1b' }}>
                Malicious Script Blocked!
              </div>
              <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: '3px', lineHeight: 1.35, wordBreak: 'break-word' }}>
                <strong>{maliciousAlert.user || 'Student'}</strong>: {maliciousAlert.desc || 'Attempted to run restricted script'}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMaliciousAlert(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#991b1b',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Close"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}