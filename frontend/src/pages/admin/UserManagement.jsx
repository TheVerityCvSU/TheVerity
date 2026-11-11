import React, { useState, useEffect } from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  fetchPasswordPolicies,
  saveEditedUser,
  registerNewUser,
  checkUserOnline,
  formatUserDate,
} from '../../data/adminUsers';
import UserFilterBar from '../../components/admin/UserFilterBar';
import UsersTable from '../../components/admin/UsersTable';
import SecurityControlPanel from '../../components/admin/SecurityControlPanel';
import BulkActionModal from '../../components/admin/BulkActionModal';
import AddUserModal from '../../components/admin/AddUserModal';
import ViewUserModal from '../../components/admin/ViewUserModal';
import EditUserModal from '../../components/admin/EditUserModal';
import UserSelectToast from '../../components/admin/UserSelectToast';
import { getStyles } from './userManagementStyles';

export default function UserManagementTab({ users = [], loading = false, onDeleteUser, onUpdateUser, onShowSelectUsersPopup }) {
  const { isDark } = useDarkMode();
  const sh = getStyles(isDark);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'Student' });
  const [modalAction, setModalAction] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [localMsg, setLocalMsg] = useState(null);
  const [addOrigin, setAddOrigin] = useState({ x: '50%', y: '50%' });
  const [showBulkPassword, setShowBulkPassword] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [viewingUser, setViewingUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  const [policies, setPolicies] = useState(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60000);
    fetchPasswordPolicies().then(setPolicies);
    return () => clearInterval(tick);
  }, []);

  const getUserStatus = (u) => {
    if (!u) return 'Inactive';
    if ((u.status || '').toLowerCase() === 'inactive') return 'Inactive';
    return checkUserOnline(u.lastLogin, now) ? 'Active' : 'Inactive';
  };

  const filtered = users
    .filter((u) => u.role !== 'Admin' && u.status !== 'Pending')
    .filter((u) => {
      const q = query.toLowerCase();
      const userStatus = getUserStatus(u);
      const matchesQuery = (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
      const matchesRole = roleFilter === 'All' || (u.role || '').toLowerCase() === roleFilter.toLowerCase();
      const matchesStatus = statusFilter === 'All' || userStatus.toLowerCase() === statusFilter.toLowerCase();
      return matchesQuery && matchesRole && matchesStatus;
    });

  const toggleSel = (email) => {
    setSelected((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));
  };

  const toggleAll = () => {
    setSelected(selected.length === filtered.length && filtered.length > 0 ? [] : filtered.map((u) => u.email));
  };

  const handleOpenEdit = (u) => {
    const parts = (u.name || '').trim().split(' ');
    setEditingUser({
      originalEmail: u.email,
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email: u.email,
      role: u.role || 'Student',
      status: u.status || 'Active',
      password: '',
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditLoading(true);
    setEditError(null);

    try {
      const { fullName, payload } = await saveEditedUser(editingUser, onUpdateUser);
      setLocalMsg({ type: 'success', text: `User "${fullName}" updated successfully.` });
      setTimeout(() => setLocalMsg(null), 3500);
      if (viewingUser && viewingUser.email === editingUser.originalEmail) {
        setViewingUser((prev) => ({
          ...prev,
          name: fullName,
          email: payload.email,
          role: payload.role,
          status: payload.status,
        }));
      }
      setEditingUser(null);
    } catch (err) {
      setEditError(err.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCopyEmail = (email) => {
    navigator.clipboard?.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await registerNewUser({
        name: `${newUser.firstName} ${newUser.lastName}`.trim(),
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
      });
      setIsAddOpen(false);
      setNewUser({ firstName: '', lastName: '', email: '', password: '', role: 'Student' });
      setLocalMsg({ type: 'success', text: 'User added successfully.' });
      setTimeout(() => setLocalMsg(null), 3000);
    } catch (err) {
      setLocalMsg({ type: 'error', text: err.message || 'Could not add user' });
    }
  };

  const handleBulkActionClick = (action) => {
    if (selected.length === 0) {
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 3000);
      return;
    }
    setModalAction(action);
  };

  const confirmBulkAction = () => {
    if (modalAction === 'suspend') {
      selected.forEach((email) => onUpdateUser && onUpdateUser(email, { status: 'Inactive' }));
      setLocalMsg({ type: 'success', text: `Suspended ${selected.length} accounts.` });
    } else if (modalAction === 'delete') {
      selected.forEach((email) => onDeleteUser && onDeleteUser(email));
      setSelected([]);
      setLocalMsg({ type: 'success', text: `Deleted ${selected.length} accounts.` });
    } else if (modalAction === 'reset') {
      setLocalMsg({ type: 'success', text: `Password reset for ${selected.length} users.` });
      setNewPassword('');
    }
    setModalAction(null);
    setTimeout(() => setLocalMsg(null), 3000);
  };

  return (
    <div style={sh.pageWrap}>
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '320px' }}>
          <div style={sh.mainCard}>
            <h2 style={{ ...sh.cardTitle, marginBottom: '14px' }}>User List Dashboard</h2>
            {localMsg && (
              <div
                style={{
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  marginBottom: '12px',
                  fontSize: '0.85rem',
                  backgroundColor: localMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                  color: localMsg.type === 'success' ? '#15803d' : '#b91c1c',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>{localMsg.text}</span>
              </div>
            )}

            <UserFilterBar
              query={query}
              setQuery={setQuery}
              roleFilter={roleFilter}
              setRoleFilter={setRoleFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              isDark={isDark}
              styles={sh}
              onOpenAdd={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setAddOrigin({ x: `${rect.left + rect.width / 2}px`, y: `${rect.top + rect.height / 2}px` });
                setIsAddOpen(true);
              }}
              onBulkAction={handleBulkActionClick}
            />

            <UsersTable
              users={filtered}
              filtered={filtered}
              loading={loading}
              selected={selected}
              onToggleAll={toggleAll}
              onToggleSel={toggleSel}
              onViewUser={setViewingUser}
              onEditUser={handleOpenEdit}
              fmt={formatUserDate}
              isDark={isDark}
              getUserStatus={getUserStatus}
              styles={sh}
            />
          </div>
        </div>

        <SecurityControlPanel
          users={users}
          onUpdateUser={onUpdateUser}
          onBulkActionClick={handleBulkActionClick}
          isDark={isDark}
          styles={sh}
          onShowSelectUsersPopup={onShowSelectUsersPopup}
        />
      </div>

      <BulkActionModal
        isOpen={Boolean(modalAction)}
        modalAction={modalAction}
        selectedCount={selected.length}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        showBulkPassword={showBulkPassword}
        setShowBulkPassword={setShowBulkPassword}
        onClose={() => setModalAction(null)}
        onConfirm={confirmBulkAction}
        isDark={isDark}
        styles={sh}
      />

      <AddUserModal
        isOpen={isAddOpen}
        newUser={newUser}
        setNewUser={setNewUser}
        showAddPassword={showAddPassword}
        setShowAddPassword={setShowAddPassword}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleAdd}
        addOrigin={addOrigin}
        isDark={isDark}
        styles={sh}
      />

      <ViewUserModal
        viewingUser={viewingUser}
        onClose={() => setViewingUser(null)}
        onOpenEdit={() => {
          handleOpenEdit(viewingUser);
          setViewingUser(null);
        }}
        onDeleteUser={(email) => {
          onDeleteUser && onDeleteUser(email);
          setViewingUser(null);
        }}
        copiedEmail={copiedEmail}
        onCopyEmail={handleCopyEmail}
        fmt={formatUserDate}
        getUserStatus={getUserStatus}
        isDark={isDark}
        styles={sh}
      />

      <EditUserModal
        editingUser={editingUser}
        setEditingUser={setEditingUser}
        showEditPassword={showEditPassword}
        setShowEditPassword={setShowEditPassword}
        editLoading={editLoading}
        editError={editError}
        policies={policies}
        onClose={() => setEditingUser(null)}
        onSubmit={handleSaveEdit}
        isDark={isDark}
        styles={sh}
      />

      <UserSelectToast isVisible={toastVisible} />
    </div>
  );
}
