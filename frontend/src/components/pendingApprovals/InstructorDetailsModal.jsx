import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, X, Copy, Check, Clock, AlertCircle } from 'lucide-react';

/**
 * Pop-up card showing the full name and email of a pending instructor account.
 */
export default function InstructorDetailsModal({
  instructor,
  onClose = () => {},
  onApprove,
  onReject,
  styles = {},
  isDark = false
}) {
  const [copiedForEmail, setCopiedForEmail] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(null);
  const [actionErrorState, setActionErrorState] = useState(null);

  const email = instructor?.emailAddress || instructor?.email || '';
  const name = instructor?.name || instructor?.fullName || (email ? email.split('@')[0] : 'Instructor');
  const initial = name.charAt(0).toUpperCase() || '?';
  const roleLabel = instructor?.role || 'Teacher';

  const copiedEmail = Boolean(email && copiedForEmail === email);
  const actionError =
    actionErrorState && actionErrorState.email === email ? actionErrorState.message : null;

  useEffect(() => {
    if (!instructor) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submittingAction) {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [instructor, submittingAction, onClose]);

  const handleClose = () => {
    if (submittingAction) return;
    setActionErrorState(null);
    setCopiedForEmail(null);
    onClose();
  };

  const handleCopyEmail = async () => {
    if (!email) return;
    try {
      await navigator.clipboard?.writeText(email);
      setCopiedForEmail(email);
      setTimeout(() => {
        setCopiedForEmail((prev) => (prev === email ? null : prev));
      }, 2000);
    } catch {
      setActionErrorState({ email, message: 'Could not copy email to clipboard.' });
    }
  };

  const handleAction = async (actionType) => {
    if (!email || submittingAction) return;
    const handler = actionType === 'approve' ? onApprove : onReject;
    if (!handler) return;

    setSubmittingAction(actionType);
    setActionErrorState(null);

    try {
      const ok = await handler(email);
      if (ok === false) {
        setActionErrorState({
          email,
          message:
            actionType === 'approve'
              ? 'Could not approve this instructor account. Please try again.'
              : 'Could not decline this instructor account. Please try again.'
        });
        return;
      }
      onClose();
    } catch (err) {
      setActionErrorState({
        email,
        message: err?.message || 'Unable to complete this action. Please try again.'
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  const modalMarkup = (
    <AnimatePresence>
      {instructor && (
        <motion.div
          key="instructor-details-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={styles.detailsModalOverlay}
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pending-instructor-modal-title"
        >
          <motion.div
            key={email || 'instructor-details-card'}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            style={styles.detailsModalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.detailsHeader}>
              <h2 id="pending-instructor-modal-title" style={styles.detailsTitle}>
                Instructor Account
              </h2>
              <button
                type="button"
                onClick={handleClose}
                disabled={Boolean(submittingAction)}
                aria-label="Close popup"
                style={styles.closeBtn}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#333333' : '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.detailsIdentityRow}>
              <div style={styles.detailsAvatar}>{initial}</div>
              <div style={styles.detailsBadgeRow}>
                <span style={styles.detailsRolePill}>{roleLabel}</span>
                <span style={styles.detailsPendingPill}>
                  <Clock size={12} />
                  <span>Pending Approval</span>
                </span>
              </div>
            </div>

            <div style={styles.detailsFieldsStack}>
              <div style={styles.detailsFieldCard}>
                <div style={styles.detailsFieldLabelRow}>
                  <User size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                  <span style={styles.detailsFieldLabel}>Name</span>
                </div>
                <div style={styles.detailsFieldName}>{name}</div>
              </div>

              <div style={styles.detailsFieldCard}>
                <div style={styles.detailsFieldTopRow}>
                  <div style={styles.detailsFieldLabelRow}>
                    <Mail size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                    <span style={styles.detailsFieldLabel}>Email</span>
                  </div>
                  {email && (
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      style={{
                        ...styles.detailsCopyBtn,
                        color: copiedEmail
                          ? isDark
                            ? '#4ade80'
                            : '#16a34a'
                          : isDark
                          ? '#93c5fd'
                          : '#2563eb'
                      }}
                      title="Copy email address"
                    >
                      {copiedEmail ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
                <div style={styles.detailsFieldEmail}>{email || 'No email provided'}</div>
              </div>
            </div>

            {actionError && (
              <div style={styles.detailsErrorBanner}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{actionError}</span>
              </div>
            )}

            <div style={styles.detailsActionsRow}>
              <motion.button
                type="button"
                whileHover={submittingAction ? {} : { scale: 1.02 }}
                whileTap={submittingAction ? {} : { scale: 0.98 }}
                disabled={Boolean(submittingAction)}
                onClick={() => handleAction('approve')}
                style={{
                  ...styles.detailsAcceptBtn,
                  opacity: submittingAction && submittingAction !== 'approve' ? 0.55 : 1,
                  cursor: submittingAction ? 'not-allowed' : 'pointer'
                }}
              >
                {submittingAction === 'approve' ? 'Approving...' : 'Accept'}
              </motion.button>
              <motion.button
                type="button"
                whileHover={submittingAction ? {} : { scale: 1.02 }}
                whileTap={submittingAction ? {} : { scale: 0.98 }}
                disabled={Boolean(submittingAction)}
                onClick={() => handleAction('decline')}
                style={{
                  ...styles.detailsDeclineBtn,
                  opacity: submittingAction && submittingAction !== 'decline' ? 0.55 : 1,
                  cursor: submittingAction ? 'not-allowed' : 'pointer'
                }}
              >
                {submittingAction === 'decline' ? 'Declining...' : 'Decline'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalMarkup, document.body);
  }
  return modalMarkup;
}
