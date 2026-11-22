import React, { useState, useEffect } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { approveInstructor, rejectInstructor } from '../data/instructorApproval';
import { getStyles } from './pendingApprovals/pendingApprovalStyles';
import InstructorPillRow from './pendingApprovals/InstructorPillRow';
import SeeAllInstructorsModal from './pendingApprovals/SeeAllInstructorsModal';
import InstructorActionPopup from './pendingApprovals/InstructorActionPopup';
import InstructorDetailsModal from './pendingApprovals/InstructorDetailsModal';

export default function PendingInstructorApproval({ users = [], onActionLogged, onUpdateUser }) {
  const { isDark } = useDarkMode();
  const styles = getStyles(isDark);

  const [pendingInstructors, setPendingInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionPopup, setActionPopup] = useState(null); // { name: string, type: 'approve' | 'decline' }
  const [isSeeAllOpen, setIsSeeAllOpen] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState(null);

  useEffect(() => {
    const filterPendingInstructors = () => {
      try {
        const safeUsers = Array.isArray(users) ? users : [];
        const filtered = safeUsers.filter(
          user =>
            user &&
            (user.role === 'Teacher' || user.role === 'Instructor') &&
            (user.status === 'Pending' || (user.status || '').toLowerCase() === 'pending')
        );
        setPendingInstructors(filtered);
        setError(null);
      } catch (err) {
        console.error('Error filtering pending instructors:', err);
        setError('Could not process pending approvals data.');
        setPendingInstructors([]);
      } finally {
        setLoading(false);
      }
    };

    filterPendingInstructors();
  }, [users]);

  const handleApprove = async (email) => {
    const instructor = pendingInstructors.find(i => (i.emailAddress || i.email) === email);
    setPendingInstructors(prev => prev.filter(i => (i.emailAddress || i.email) !== email));
    try {
      await approveInstructor(email);

      const name = instructor?.name || instructor?.fullName || email.split('@')[0];
      setActionPopup({ name, type: 'approve' });
      setTimeout(() => setActionPopup(null), 2500);
      setSelectedInstructor(prev => ((prev?.emailAddress || prev?.email) === email ? null : prev));

      if (onUpdateUser) {
        onUpdateUser(email, { status: 'Active' });
      }

      if (onActionLogged) {
        onActionLogged({
          type: 'APPROVE_INSTRUCTOR',
          email,
          timestamp: new Date().toISOString(),
          message: 'Instructor approved and set to Active status'
        });
      }
      return true;
    } catch (err) {
      console.error('Error approving instructor:', err);
      if (instructor) {
        setPendingInstructors(prev => {
          const exists = prev.some(i => (i.emailAddress || i.email) === email);
          return exists ? prev : [instructor, ...prev];
        });
      }
      return false;
    }
  };

  const handleReject = async (email) => {
    const instructor = pendingInstructors.find(i => (i.emailAddress || i.email) === email);
    setPendingInstructors(prev => prev.filter(i => (i.emailAddress || i.email) !== email));
    try {
      await rejectInstructor(email);

      const name = instructor?.name || instructor?.fullName || email.split('@')[0];
      setActionPopup({ name, type: 'decline' });
      setTimeout(() => setActionPopup(null), 2500);
      setSelectedInstructor(prev => ((prev?.emailAddress || prev?.email) === email ? null : prev));

      if (onActionLogged) {
        onActionLogged({
          type: 'REJECT_INSTRUCTOR',
          email,
          timestamp: new Date().toISOString(),
          message: 'Instructor rejected and account deleted'
        });
      }
      return true;
    } catch (err) {
      console.error('Error rejecting instructor:', err);
      if (instructor) {
        setPendingInstructors(prev => {
          const exists = prev.some(i => (i.emailAddress || i.email) === email);
          return exists ? prev : [instructor, ...prev];
        });
      }
      return false;
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        Loading pending approvals...
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.error}>
        {error}
      </div>
    );
  }

  const displayedInstructors = pendingInstructors.slice(0, 3);

  const renderInstructor = (instructor) => {
    const email = instructor.emailAddress || instructor.email || '';
    return (
      <InstructorPillRow
        key={email}
        instructor={instructor}
        onApprove={handleApprove}
        onReject={handleReject}
        onSelect={setSelectedInstructor}
        styles={styles}
        isDark={isDark}
      />
    );
  };

  return (
    <div style={styles.cardContainer}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Pending Instructor Approval</h2>
        {pendingInstructors.length > 3 && (
          <button
            style={styles.seeAllBtn}
            onClick={() => setIsSeeAllOpen(true)}
          >
            See All
          </button>
        )}
      </div>

      {pendingInstructors.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H16L20 16V6C20 4.89543 19.1046 4 20 4Z" stroke={isDark ? '#64748b' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 6H20" stroke={isDark ? '#64748b' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M4 10H20" stroke={isDark ? '#64748b' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M4 14H20" stroke={isDark ? '#64748b' : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={styles.emptyText}>
            No pending instructor approvals.
          </p>
          <p style={styles.emptyHint}>
            New instructors requesting approval will appear here.
          </p>
        </div>
      ) : (
        <div style={styles.listContainer}>
          {displayedInstructors.map(renderInstructor)}
        </div>
      )}

      <SeeAllInstructorsModal
        isOpen={isSeeAllOpen}
        onClose={() => setIsSeeAllOpen(false)}
        pendingInstructors={pendingInstructors}
        renderInstructor={renderInstructor}
        styles={styles}
        isDark={isDark}
      />

      <InstructorDetailsModal
        instructor={selectedInstructor}
        onClose={() => setSelectedInstructor(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        styles={styles}
        isDark={isDark}
      />

      <InstructorActionPopup
        actionPopup={actionPopup}
        styles={styles}
        isDark={isDark}
      />
    </div>
  );
}
