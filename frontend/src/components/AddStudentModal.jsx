import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { enrollStudentInClassroom } from '../data/enrollmentService';
import AddStudentHeader from './addStudent/AddStudentHeader';
import AddStudentForm from './addStudent/AddStudentForm';

/**
 * AddStudentModal
 * A modern pop-up modal for instructors to manually enroll a student into a classroom.
 */
export default function AddStudentModal({
  isOpen,
  onClose,
  classroomId,
  classCode,
  onSuccess,
  isDark = false
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const emailInputRef = useRef(null);

  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setEmail('');
      setName('');
      setError('');
      setSuccessMsg('');
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = setTimeout(() => emailInputRef.current?.focus(), 80);
    return () => clearTimeout(focusTimer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, loading]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter a valid student email address.');
      emailInputRef.current?.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address (e.g., student@school.edu).');
      emailInputRef.current?.focus();
      return;
    }

    const trimmedName = name.trim() || trimmedEmail.split('@')[0];

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const data = await enrollStudentInClassroom({
        classroomId,
        studentEmail: trimmedEmail,
        studentName: trimmedName
      });

      setSuccessMsg(`Successfully added ${trimmedName}!`);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess({ email: trimmedEmail, name: trimmedName, data });
        }
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'An error occurred while adding the student.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const colors = {
    overlayBg: 'rgba(0, 0, 0, 0.65)',
    cardBg: isDark ? '#262626' : '#FFFFFF',
    border: isDark ? '#404040' : '#E5E7EB',
    title: isDark ? '#F3F4F6' : '#111827',
    subText: isDark ? '#9CA3AF' : '#6B7280',
    inputBg: isDark ? '#333333' : '#F9FAFB',
    inputBorder: isDark ? '#4B5563' : '#D1D5DB',
    inputText: isDark ? '#F9FAFB' : '#111827',
    infoBg: isDark ? '#1a2e22' : '#ecfdf5',
    infoBorder: isDark ? '#065f46' : '#a7f3d0',
    infoText: isDark ? '#6ee7b7' : '#047857'
  };

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.overlayBg,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '16px'
        }}
        onClick={() => {
          if (!loading) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: '20px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <AddStudentHeader
            onClose={onClose}
            loading={loading}
            colors={colors}
            isDark={isDark}
          />

          <AddStudentForm
            email={email}
            setEmail={setEmail}
            name={name}
            setName={setName}
            loading={loading}
            error={error}
            setError={setError}
            successMsg={successMsg}
            emailInputRef={emailInputRef}
            classCode={classCode}
            colors={colors}
            isDark={isDark}
            onSubmit={handleSubmit}
            onClose={onClose}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
