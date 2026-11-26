import { useState, useEffect, useRef, useCallback } from 'react';
import localStore from '../data/localStore';
import { loadInitialHistory, persistHistory } from '../utils/studentViewUtils';

export function useStudentViewFiles({
  assignment,
  assignmentId,
  studentId,
  safeUsername,
  submitted,
  codeHistoryRef: propCodeHistoryRef,
  codeHistory: propCodeHistory,
  persistHistoryFn: propPersistHistoryFn,
  emitToSockets,
  studentActualId,
  studentDisplayName,
  currentUser,
  classroom,
  classroomId,
  proctorLogsRef: _proctorLogsRef,
  proctorLogs: _proctorLogs
}) {
  const draftKey = `verity_code_${assignmentId}_${studentId}`;
  const initialCode = `using System;\n\nnamespace HelloWorld\n{\n    class Program\n    {\n        static void Main(string[] args)\n        {\n            Console.WriteLine("Hello, World!");\n        }\n    }\n}`;

  const [code, setCode] = useState(() => {
    try {
      const savedCode = localStorage.getItem(draftKey);
      if (savedCode && !savedCode.includes('UserInputApp')) return savedCode;
    } catch {}
    return assignment?.starterCode || initialCode;
  });

  const codeRef = useRef(code);
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const starterSyncKey = `${draftKey}|${assignment?.starterCode || ''}`;
  const [prevStarterSyncKey, setPrevStarterSyncKey] = useState(starterSyncKey);
  if (starterSyncKey !== prevStarterSyncKey) {
    setPrevStarterSyncKey(starterSyncKey);
    if (assignment?.starterCode && (!code || code === initialCode)) {
      let restored = null;
      try {
        const savedCode = localStorage.getItem(draftKey);
        if (savedCode && !savedCode.includes('UserInputApp')) restored = savedCode;
      } catch {}
      setCode(restored || assignment.starterCode);
    }
  }

  const [codeHistory, setCodeHistory] = useState(() =>
    propCodeHistory || loadInitialHistory(classroomId, assignmentId, studentId, safeUsername, currentUser, code)
  );
  const internalCodeHistoryRef = useRef(codeHistory);
  useEffect(() => {
    internalCodeHistoryRef.current = codeHistory;
  }, [codeHistory]);
  const activeCodeHistoryRef = propCodeHistoryRef || internalCodeHistoryRef;

  const persistHistoryFn = useCallback((hist, currentCodeVal) => {
    if (propPersistHistoryFn) {
      propPersistHistoryFn(hist, currentCodeVal);
    } else {
      persistHistory(hist, currentCodeVal, classroomId, assignmentId, studentId, safeUsername, currentUser);
    }
  }, [propPersistHistoryFn, classroomId, assignmentId, studentId, safeUsername, currentUser]);

  const extraFilesKey = `verity_extrafiles_${assignmentId}_${studentId}`;
  const [extraFiles, setExtraFiles] = useState(() => {
    try {
      const saved = localStorage.getItem(extraFilesKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [activeFileId, setActiveFileId] = useState('main');
  const [renamingFileId, setRenamingFileId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [saveStatus, setSaveStatus] = useState(false);
  const saveTimeoutRef = useRef(null);

  const persistExtraFiles = (files) => {
    try {
      localStorage.setItem(extraFilesKey, JSON.stringify(files));
    } catch {}
  };

  const handleAddFile = () => {
    if (submitted) return;
    const num = extraFiles.length + 2;
    const newFile = {
      id: `ef_${Date.now()}`,
      name: `File${num}`,
      code: `// File${num}.cs\npublic class File${num}\n{\n    // Add your code here\n}\n`
    };
    const updated = [...extraFiles, newFile];
    setExtraFiles(updated);
    persistExtraFiles(updated);
    setActiveFileId(newFile.id);
  };

  const handleDeleteFile = (id) => {
    if (submitted) return;
    const updated = extraFiles.filter((f) => f.id !== id);
    setExtraFiles(updated);
    persistExtraFiles(updated);
    if (activeFileId === id) setActiveFileId('main');
  };

  const handleRenameFile = (id, newName) => {
    if (submitted) return;
    const safeName = newName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'File';
    const updated = extraFiles.map((f) => (f.id === id ? { ...f, name: safeName } : f));
    setExtraFiles(updated);
    persistExtraFiles(updated);
    setRenamingFileId(null);
  };

  const handleExtraFileCodeChange = (id, newCode) => {
    if (submitted) return;
    const updated = extraFiles.map((f) => (f.id === id ? { ...f, code: newCode } : f));
    setExtraFiles(updated);
    persistExtraFiles(updated);
  };

  const activeCode = activeFileId === 'main' ? code : extraFiles.find((f) => f.id === activeFileId)?.code ?? '';
  const setActiveCode = (newCode) => {
    if (activeFileId === 'main') {
      setCode(newCode);
    } else {
      handleExtraFileCodeChange(activeFileId, newCode);
    }
  };

  // Load draft from local SQLite storage if available
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const draft = await localStore.getDraft(assignmentId, studentId);
        if (isMounted && draft && draft.code && !draft.code.includes('UserInputApp')) {
          setCode(draft.code);
          codeRef.current = draft.code;
        }
      } catch {}
    })();
    return () => {
      isMounted = false;
    };
  }, [assignmentId, studentId]);

  const handleSaveCode = () => {
    if (submitted) return;
    const currentCode = codeRef.current;
    const curHist = activeCodeHistoryRef.current?.length > 0 ? activeCodeHistoryRef.current : codeHistory;
    try {
      localStorage.setItem(draftKey, currentCode);
      if (studentId !== safeUsername) {
        localStorage.setItem(`verity_code_${assignmentId}_${safeUsername}`, currentCode);
      }
      persistHistoryFn(curHist, currentCode);
    } catch {}

    if (emitToSockets) {
      emitToSockets('student_typing', {
        studentId: studentActualId,
        id: studentActualId,
        name: studentDisplayName,
        studentName: studentDisplayName,
        email: currentUser?.email || '',
        code: currentCode,
        classroomId:
          (classroom?.id != null ? String(classroom.id) : null) ||
          (classroomId !== 'none' ? classroomId : null) ||
          'none',
        assignmentId: assignment?.id || assignmentId
      });
    }

    setSaveStatus(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus(false);
    }, 2000);
  };

  return {
    code,
    setCode,
    codeRef,
    draftKey,
    extraFiles,
    setExtraFiles,
    activeFileId,
    setActiveFileId,
    renamingFileId,
    setRenamingFileId,
    renameValue,
    setRenameValue,
    activeCode,
    setActiveCode,
    handleAddFile,
    handleDeleteFile,
    handleRenameFile,
    handleExtraFileCodeChange,
    handleSaveCode,
    saveStatus,
    codeHistory,
    setCodeHistory,
    codeHistoryRef: activeCodeHistoryRef,
    persistHistory: persistHistoryFn
  };
}
