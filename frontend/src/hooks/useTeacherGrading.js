import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '../data/api';
import { getStudentGrade, isStudentGraded } from '../utils/gradeUtils';
import {
  fetchSubmissionsAndEnrollment,
  saveSingleStudentGrade,
  deleteSingleStudentGrade,
  bulkSaveStudentGrades
} from '../data/teacherGradingService';
import { useGradingSocketEvents } from './useGradingSocketEvents';

export function useTeacherGrading({ classroom, assignment, socket }) {
  const maxPoints = parseInt(assignment?.points, 10) || 100;
  const assignmentId = assignment?.id ?? 'default';
  const gradesKey = `verity_grades_${assignmentId}`;

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [totalEnrolledCount, setTotalEnrolledCount] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

  const [grades, setGrades] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(gradesKey)) || {};
    } catch {
      return {};
    }
  });

  const [gradeInput, setGradeInput] = useState(String(maxPoints));
  const [feedbackInput, setFeedbackInput] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState('');

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkGrade, setBulkGrade] = useState(String(maxPoints));
  const [bulkFeedback, setBulkFeedback] = useState('Great work on this assignment!');
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState('');

  const [showCodeModal, setShowCodeModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetchSubmissionsAndEnrollment(assignment, classroom);
    setStudents(res.students);
    setTotalEnrolledCount(res.enrolledCount);

    setSelectedId(prev => {
      if (prev && res.students.some(s => s.name?.toLowerCase() === prev.toLowerCase())) return prev;
      return res.students[0]?.id || null;
    });

    setLoading(false);
  }, [assignment, classroom]);

  const gradingTargetKey = `${classroom?.id ?? ''}|${assignment?.id ?? ''}`;
  const [prevGradingTargetKey, setPrevGradingTargetKey] = useState(null);
  if (gradingTargetKey !== prevGradingTargetKey) {
    setPrevGradingTargetKey(gradingTargetKey);
    setLoading(true);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => loadData());

    if (assignment?.id) {
      apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignment.id}`)
        .then(res => res.json())
        .then(data => {
          if (cancelled) return;
          if (data?.grades && Object.keys(data.grades).length > 0) {
            setGrades(prev => ({ ...prev, ...data.grades }));
          }
        })
        .catch(() => {});
    }

    const onStorage = () => loadData();
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
    };
  }, [assignment?.id, loadData]);

  useGradingSocketEvents({
    assignmentId,
    classroomId: assignment?.classroomId || assignment?.classroom_id || 'none',
    socket,
    loadData,
    setStudents,
    setSelectedId,
    setGrades
  });

  useEffect(() => {
    try {
      localStorage.setItem(gradesKey, JSON.stringify(grades));
    } catch {}
  }, [grades, gradesKey]);

  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedId) || null;
  }, [students, selectedId]);

  const savedGradeForSelected = selectedStudent ? getStudentGrade(grades, selectedStudent) : null;
  const selectedGradeSyncKey = `${selectedStudent?.id ?? ''}|${savedGradeForSelected?.grade ?? ''}|${savedGradeForSelected?.feedback ?? ''}|${maxPoints}`;
  const [prevSelectedGradeSyncKey, setPrevSelectedGradeSyncKey] = useState(null);
  if (selectedGradeSyncKey !== prevSelectedGradeSyncKey) {
    setPrevSelectedGradeSyncKey(selectedGradeSyncKey);
    if (selectedStudent) {
      setGradeInput(savedGradeForSelected?.grade != null ? String(savedGradeForSelected.grade) : String(maxPoints));
      setFeedbackInput(savedGradeForSelected?.feedback || '');
    } else {
      setGradeInput(String(maxPoints));
      setFeedbackInput('');
    }
    setSaveStatus('idle');
    setSaveError('');
  }

  const turnedInStudents = useMemo(() => {
    return students.filter(s => Boolean(s.submittedAt || s.finalCode));
  }, [students]);

  const gradedStudents = useMemo(() => {
    return students.filter(s => isStudentGraded(grades, s));
  }, [students, grades]);

  const ungradedStudents = useMemo(() => {
    return students.filter(s => !isStudentGraded(grades, s));
  }, [students, grades]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesEmail = s.email && s.email.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }
      const isGrad = isStudentGraded(grades, s);
      if (filterTab === 'ungraded' || filterTab === 'turned_in') return !isGrad;
      if (filterTab === 'graded') return isGrad;
      return true;
    });
  }, [students, searchTerm, filterTab, grades]);

  const handleEvaluate = async () => {
    if (!selectedStudent) return;
    setSaveStatus('saving');
    setSaveError('');
    const now = new Date().toISOString();
    const studentIdentifier = selectedStudent.id || selectedStudent.name;

    const updated = {
      ...grades,
      [studentIdentifier]: { grade: gradeInput, feedback: feedbackInput, gradedAt: now }
    };
    setGrades(updated);
    try {
      localStorage.setItem(gradesKey, JSON.stringify(updated));
    } catch {}

    try {
      await saveSingleStudentGrade(assignment?.id, studentIdentifier, gradeInput, feedbackInput);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err.message || 'Failed to save');
      setTimeout(() => setSaveStatus('idle'), 3500);
    }
  };

  const handleClearGrade = async () => {
    if (!selectedStudent) return;
    const studentIdentifier = selectedStudent.id || selectedStudent.name;
    const target = studentIdentifier.toLowerCase();

    setGrades(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (k.toLowerCase() === target) delete next[k];
      });
      return next;
    });

    try {
      await deleteSingleStudentGrade(assignment?.id, studentIdentifier);
    } catch {}
  };

  const handleBulkGrade = async () => {
    if (turnedInStudents.length === 0) return;
    const now = new Date().toISOString();
    const updated = { ...grades };
    const payload = [];

    turnedInStudents.forEach(s => {
      const sId = s.id || s.name;
      updated[sId] = { grade: bulkGrade, feedback: bulkFeedback, gradedAt: now };
      payload.push({ studentId: sId, grade: bulkGrade, feedback: bulkFeedback });
    });

    setGrades(updated);
    try {
      localStorage.setItem(gradesKey, JSON.stringify(updated));
    } catch {}

    await bulkSaveStudentGrades(assignment?.id, payload);
    setBulkSuccessMsg(`Successfully graded all ${turnedInStudents.length} turned-in student(s)!`);
    setTimeout(() => setBulkSuccessMsg(''), 3500);
    setShowBulkModal(false);
  };

  const handleCopyCode = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return {
    maxPoints,
    loading,
    students,
    totalEnrolledCount,
    selectedId,
    setSelectedId,
    selectedStudent,
    searchTerm,
    setSearchTerm,
    filterTab,
    setFilterTab,
    isInstructionsOpen,
    setIsInstructionsOpen,
    grades,
    gradeInput,
    setGradeInput,
    feedbackInput,
    setFeedbackInput,
    saveStatus,
    saveError,
    showBulkModal,
    setShowBulkModal,
    bulkGrade,
    setBulkGrade,
    bulkFeedback,
    setBulkFeedback,
    bulkSuccessMsg,
    showCodeModal,
    setShowCodeModal,
    copiedCode,
    turnedInStudents,
    gradedStudents,
    ungradedStudents,
    filteredStudents,
    handleEvaluate,
    handleClearGrade,
    handleBulkGrade,
    handleCopyCode
  };
}
