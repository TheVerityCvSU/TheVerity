import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '../data/api';
import { getStudentGrade, isStudentGraded } from '../utils/gradeUtils';
import {
  fetchSubmissionsAndEnrollment,
  saveGradeApi,
  deleteGradeApi,
  bulkGradeApi
} from '../data/teacherGradingService';
import { useTeacherGradingSocket } from './useTeacherGradingSocket';

export function useTeacherGradingData({ assignment, classroom, socket }) {
  const maxPoints = parseInt(assignment?.points, 10) || 100;
  const assignmentId = assignment?.id ?? 'default';
  const gradesKey = `verity_grades_${assignmentId}`;

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [totalEnrolledCount, setTotalEnrolledCount] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all');

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
    const { submissionList, enrolledCount } = await fetchSubmissionsAndEnrollment(assignment, classroom);
    setTotalEnrolledCount(enrolledCount);
    setStudents(submissionList);
    setSelectedId(prev => {
      if (prev && submissionList.some(s => s.id?.toLowerCase() === prev.toLowerCase())) return prev;
      return submissionList[0]?.id || null;
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
    Promise.resolve().then(() => loadData());

    if (assignment?.id) {
      apiFetch(`${import.meta.env.VITE_API_URL}/grades/${assignment.id}`)
        .then(res => res.json())
        .then(data => {
          if (data?.grades && Object.keys(data.grades).length > 0) {
            setGrades(prev => ({ ...prev, ...data.grades }));
          }
        })
        .catch(() => {});
    }
  }, [assignment?.id, loadData]);

  useTeacherGradingSocket({
    assignmentId: assignment?.id,
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

  const turnedInStudents = useMemo(() => students.filter(s => Boolean(s.submittedAt || s.finalCode)), [students]);
  const gradedStudents = useMemo(() => students.filter(s => isStudentGraded(grades, s)), [students, grades]);
  const ungradedStudents = useMemo(() => students.filter(s => !isStudentGraded(grades, s)), [students, grades]);

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
      await saveGradeApi(assignment?.id, studentIdentifier, gradeInput, feedbackInput);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Error evaluating student:', err);
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

    await deleteGradeApi(assignment?.id, studentIdentifier);
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

    await bulkGradeApi(assignment?.id, payload);
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

  const scorePresets = useMemo(() => {
    const list = [
      maxPoints,
      Math.round(maxPoints * 0.95),
      Math.round(maxPoints * 0.9),
      Math.round(maxPoints * 0.85),
      Math.round(maxPoints * 0.8),
      Math.round(maxPoints * 0.75),
      Math.round(maxPoints * 0.7),
      0
    ];
    return Array.from(new Set(list));
  }, [maxPoints]);

  const quickFeedbacks = [
    'Great job! Clean and well structured code.',
    'Good implementation, all requirements met.',
    'Solid attempt! Make sure to test edge cases.',
    'Check variable naming and indentation style.',
    'Needs better error handling and comments.'
  ];

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
    scorePresets,
    quickFeedbacks,
    handleEvaluate,
    handleClearGrade,
    handleBulkGrade,
    handleCopyCode
  };
}
