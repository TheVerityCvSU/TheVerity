import React, { useState, useEffect, useRef } from 'react';
import { generateClassCode } from '../../utils/classroomList';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  loadClassrooms as fetchClassroomsData,
  persistClassrooms,
  deleteClassroom as removeClassroom,
  enrollStudents as enrollStudentsApi,
  fetchClassroomRoster,
  fetchUsersAndRoles,
  triggerSync
} from '../../data/adminClasses';
import CreateClassModal from '../../components/admin/CreateClassModal';
import ClassDetailsModal from '../../components/admin/ClassDetailsModal';
import DeleteClassModal from '../../components/admin/DeleteClassModal';
import ClassroomStatsGrid from '../../components/admin/ClassroomStatsGrid';
import ClassroomAuthErrorBanner from '../../components/admin/ClassroomAuthErrorBanner';
import ClassroomSearchBar from '../../components/admin/ClassroomSearchBar';
import ClassroomsTable from '../../components/admin/ClassroomsTable';
import { getStyles, getThemeColors } from './globalClassesStyles';

export default function GlobalClassesTab() {
  const { isDark } = useDarkMode();
  const sh = getStyles(isDark);
  const colors = getThemeColors(isDark);

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [query, setQuery] = useState('');
  const [viewClass, setViewClass] = useState(null);
  const [viewStudents, setViewStudents] = useState([]);
  const [viewLoadingStudents, setViewLoadingStudents] = useState(false);
  const [viewStudentQuery, setViewStudentQuery] = useState('');
  const [showAddStudentsInView, setShowAddStudentsInView] = useState(false);
  const [selectedAddStudentIds, setSelectedAddStudentIds] = useState(new Set());
  const [addStudentQuery, setAddStudentQuery] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const isCreatingClassRef = useRef(false);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [deleteConfirmClass, setDeleteConfirmClass] = useState(null);
  const [newClass, setNewClass] = useState({ name: '', section: '', subject: '', instructor: '', code: '' });
  const [selectedCreateStudentIds, setSelectedCreateStudentIds] = useState(new Set());
  const [createStudentQuery, setCreateStudentQuery] = useState('');

  const [allRegisteredStudents, setAllRegisteredStudents] = useState([]);
  const [teacherOptions, setTeacherOptions] = useState([
    'Dr. Alan Turing', 'Prof. Katherine Johnson', 'Dr. Grace Hopper', 'Tim Berners-Lee', 'Edgar F. Codd'
  ]);

  const handleOpenCreateModal = () => {
    setNewClass({ name: '', section: '', subject: '', instructor: teacherOptions[0] || '', code: '' });
    setSelectedCreateStudentIds(new Set());
    setCreateStudentQuery('');
    setShowCreateModal(true);
  };

  const loadAllUsers = () => {
    fetchUsersAndRoles().then(({ teachers, students }) => {
      if (teachers.length > 0) setTeacherOptions(teachers);
      setAllRegisteredStudents(students);
    });
  };

  const loadClassrooms = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { classes: loadedClasses, authError: isAuthError } = await fetchClassroomsData();
      setAuthError(isAuthError);
      setClasses(loadedClasses || []);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleSyncClassrooms = async () => {
    setIsSyncing(true);
    try {
      await triggerSync();
      await Promise.all([loadClassrooms(false), loadAllUsers()]);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadClassrooms(true);
    loadAllUsers();
    const handleServerChanged = () => {
      loadClassrooms(true);
      loadAllUsers();
    };
    window.addEventListener('verity:server-changed', handleServerChanged);
    window.addEventListener('verity:classrooms-changed', handleServerChanged);
    window.addEventListener('verity:sync-completed', handleServerChanged);
    return () => {
      window.removeEventListener('verity:server-changed', handleServerChanged);
      window.removeEventListener('verity:classrooms-changed', handleServerChanged);
      window.removeEventListener('verity:sync-completed', handleServerChanged);
    };
  }, []);

  useEffect(() => {
    if (!viewClass || !viewClass.id) {
      setViewStudents([]);
      setShowAddStudentsInView(false);
      setSelectedAddStudentIds(new Set());
      return;
    }
    setViewLoadingStudents(true);
    fetchClassroomRoster(viewClass.id, viewClass.students)
      .then(setViewStudents)
      .finally(() => setViewLoadingStudents(false));
  }, [viewClass]);

  const handleDeleteClass = (c) => setDeleteConfirmClass({ id: c.id, name: c.name || c.className || 'this classroom' });

  const handleExecuteDeleteClass = async () => {
    if (!deleteConfirmClass) return;
    const updated = await removeClassroom(deleteConfirmClass.id, classes);
    setClasses(updated);
    setDeleteConfirmClass(null);
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (isCreatingClassRef.current) return;
    const nameTrim = (newClass.name || '').trim();
    if (!nameTrim) return;

    isCreatingClassRef.current = true;
    setIsCreatingClass(true);

    const selectedInstructor = newClass.instructor || teacherOptions[0] || 'Unassigned';
    const termLabel = newClass.subject ? `${newClass.subject}${newClass.section ? ' (' + newClass.section + ')' : ''}` : 'Fall 2026';
    const selectedStudentsList = allRegisteredStudents.filter(st => selectedCreateStudentIds.has(st.id || st.email));
    const classroomId = Date.now();
    const generatedCode = generateClassCode(classes);

    const created = {
      id: classroomId,
      code: generatedCode,
      name: nameTrim,
      className: nameTrim,
      section: newClass.section || 'N/A',
      subject: newClass.subject || 'General',
      instructor: selectedInstructor,
      instructorName: selectedInstructor,
      term: termLabel,
      status: 'Active',
      isActive: true,
      students: selectedStudentsList
    };

    // Close the popup and reset state immediately to prevent spam creation
    setShowCreateModal(false);
    setNewClass({ name: '', section: '', subject: '', instructor: '', code: '' });
    setSelectedCreateStudentIds(new Set());
    setCreateStudentQuery('');

    // Optimistically update classroom list in UI
    const updatedClasses = [created, ...classes];
    setClasses(updatedClasses);

    try {
      await persistClassrooms(updatedClasses);
      if (selectedStudentsList.length > 0) {
        await enrollStudentsApi(classroomId, selectedStudentsList).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to save classroom:', err);
    } finally {
      isCreatingClassRef.current = false;
      setIsCreatingClass(false);
    }
  };

  const handleEnrollStudentsInView = async () => {
    if (!viewClass || selectedAddStudentIds.size === 0) return;
    const studentsToEnroll = allRegisteredStudents.filter(st => selectedAddStudentIds.has(st.id || st.email));
    if (studentsToEnroll.length === 0) return;

    try {
      await enrollStudentsApi(viewClass.id, studentsToEnroll);
      const mergedStudentsMap = new Map();
      [...viewStudents, ...studentsToEnroll].forEach(s => {
        const key = (s.email || s.name || '').toLowerCase();
        if (key && !mergedStudentsMap.has(key)) mergedStudentsMap.set(key, s);
      });
      const updatedRoster = Array.from(mergedStudentsMap.values());
      setViewStudents(updatedRoster);
      setClasses(prev => prev.map(c => c.id === viewClass.id ? { ...c, students: updatedRoster } : c));
      setSelectedAddStudentIds(new Set());
      setShowAddStudentsInView(false);
    } catch (err) {
      console.error('Failed to enroll students:', err);
    }
  };

  const totalActive = classes.filter(c => c.status === 'Active' || c.isActive).length;
  const filtered = classes.filter(c => {
    const q = query.toLowerCase();
    return (c.name || c.className || '').toLowerCase().includes(q)
      || (c.instructor || c.instructorName || '').toLowerCase().includes(q)
      || (c.section || '').toLowerCase().includes(q)
      || (c.subject || '').toLowerCase().includes(q);
  });

  const alreadyEnrolledEmails = new Set(viewStudents.map(s => (s.email || '').toLowerCase()));
  const availableStudentsForView = allRegisteredStudents.filter(st => {
    if (alreadyEnrolledEmails.has((st.email || '').toLowerCase())) return false;
    const q = addStudentQuery.toLowerCase();
    return !q || st.name.toLowerCase().includes(q) || st.email.toLowerCase().includes(q);
  });

  const availableStudentsForCreate = allRegisteredStudents.filter(st => {
    const q = createStudentQuery.toLowerCase();
    return !q || st.name.toLowerCase().includes(q) || st.email.toLowerCase().includes(q);
  });

  return (
    <div style={sh.pageWrap}>
      <ClassroomStatsGrid
        totalClasses={classes.length}
        totalActive={totalActive}
        registeredStudentsCount={allRegisteredStudents.length}
        instructorsCount={teacherOptions.length}
        styles={sh}
      />

      <div style={sh.mainCard}>
        {authError && <ClassroomAuthErrorBanner isDark={isDark} />}
        <h2 style={{ ...sh.cardTitle, marginBottom: '16px' }}>Classroom Directory Management</h2>

        <ClassroomSearchBar
          query={query}
          setQuery={setQuery}
          isDark={isDark}
          isSyncing={isSyncing}
          onSync={handleSyncClassrooms}
          onCreateOpen={handleOpenCreateModal}
          styles={sh}
          muted={colors.muted}
        />

        <ClassroomsTable
          classes={filtered}
          loading={loading}
          isDark={isDark}
          onViewClass={setViewClass}
          onDeleteClass={handleDeleteClass}
          styles={sh}
          headerBg={colors.headerBg}
          headerColor={colors.headerColor}
          rowBg={colors.rowBg}
          muted={colors.muted}
        />
      </div>

      <CreateClassModal
        isOpen={showCreateModal}
        isDark={isDark}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateClass}
        isSubmitting={isCreatingClass}
        newClass={newClass}
        setNewClass={setNewClass}
        teacherOptions={teacherOptions}
        selectedCreateStudentIds={selectedCreateStudentIds}
        setSelectedCreateStudentIds={setSelectedCreateStudentIds}
        createStudentQuery={createStudentQuery}
        setCreateStudentQuery={setCreateStudentQuery}
        availableStudents={availableStudentsForCreate}
        styles={sh}
        muted={colors.muted}
      />

      <ClassDetailsModal
        viewClass={viewClass}
        isDark={isDark}
        onClose={() => setViewClass(null)}
        viewStudents={viewStudents}
        viewLoadingStudents={viewLoadingStudents}
        viewStudentQuery={viewStudentQuery}
        setViewStudentQuery={setViewStudentQuery}
        showAddStudentsInView={showAddStudentsInView}
        setShowAddStudentsInView={setShowAddStudentsInView}
        selectedAddStudentIds={selectedAddStudentIds}
        setSelectedAddStudentIds={setSelectedAddStudentIds}
        addStudentQuery={addStudentQuery}
        setAddStudentQuery={setAddStudentQuery}
        availableStudentsForView={availableStudentsForView}
        onEnrollStudents={handleEnrollStudentsInView}
        styles={sh}
        tagBg={colors.tagBg}
        headerBg={colors.headerBg}
        headerColor={colors.headerColor}
        rowBg={colors.rowBg}
        muted={colors.muted}
      />

      <DeleteClassModal
        deleteConfirmClass={deleteConfirmClass}
        isDark={isDark}
        onClose={() => setDeleteConfirmClass(null)}
        onConfirm={handleExecuteDeleteClass}
        styles={sh}
      />
    </div>
  );
}
