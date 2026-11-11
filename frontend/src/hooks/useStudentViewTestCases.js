import { useState, useEffect } from 'react';

const defaultTestCases = [
  {
    id: 'tc-1',
    name: 'Case 1',
    input: '',
    expectedOutput: 'Hello, World!',
    actualOutput: '',
    status: 'idle',
    errorMessage: ''
  }
];

export function useStudentViewTestCases({
  assignment,
  assignmentId,
  studentId,
  submitted,
  isDesktopWeb,
  vmDetected,
  kioskRules,
  getCompilerSocket,
  currentUser,
  code,
  codeRef,
  setBottomTab
}) {
  const [testCases, setTestCases] = useState(() => {
    if (Array.isArray(assignment?.testCases) && assignment.testCases.length > 0) {
      return assignment.testCases.map((tc, idx) => ({
        id: tc.id || `tc-${idx + 1}`,
        name: tc.name || `Case ${idx + 1}`,
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        actualOutput: '',
        status: 'idle',
        errorMessage: ''
      }));
    }
    try {
      const saved = localStorage.getItem(`verity_testcases_${assignmentId}_${studentId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultTestCases;
  });

  const [activeTestCaseId, setActiveTestCaseId] = useState(() => testCases[0]?.id || 'tc-1');
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Persist test cases to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`verity_testcases_${assignmentId}_${studentId}`, JSON.stringify(testCases));
    } catch {}
  }, [testCases, assignmentId, studentId]);

  // Keep activeTestCaseId valid
  useEffect(() => {
    if (!testCases.some((tc) => tc.id === activeTestCaseId) && testCases.length > 0) {
      setActiveTestCaseId(testCases[0].id);
    }
  }, [testCases, activeTestCaseId]);

  const handleAddTestCase = () => {
    if (submitted) return;
    const newId = `tc-${Date.now()}`;
    const newCase = {
      id: newId,
      name: `Case ${testCases.length + 1}`,
      input: '',
      expectedOutput: '',
      actualOutput: '',
      status: 'idle',
      errorMessage: ''
    };
    setTestCases((prev) => [...prev, newCase]);
    setActiveTestCaseId(newId);
    if (typeof setBottomTab === 'function') setBottomTab('testcases');
  };

  const handleDeleteTestCase = (id, e) => {
    if (e) e.stopPropagation();
    if (submitted || testCases.length <= 1) return;
    const remaining = testCases.filter((tc) => tc.id !== id);
    setTestCases(remaining);
    if (activeTestCaseId === id) {
      setActiveTestCaseId(remaining[0].id);
    }
  };

  const handleUpdateTestCase = (id, field, value) => {
    if (submitted) return;
    setTestCases((prev) => prev.map((tc) => (tc.id === id ? { ...tc, [field]: value, status: 'idle' } : tc)));
  };

  const handleRunTestCase = (targetCase = null) => {
    if (submitted || isDesktopWeb || (vmDetected && kioskRules?.blockVirtualMachine !== false)) return;
    const caseToRun = targetCase || testCases.find((tc) => tc.id === activeTestCaseId) || testCases[0];
    if (!caseToRun) return;

    if (typeof setBottomTab === 'function') setBottomTab('testcases');
    setIsRunningTests(true);
    setTestCases((prev) =>
      prev.map((tc) => (tc.id === caseToRun.id ? { ...tc, status: 'running', errorMessage: '', actualOutput: '' } : tc))
    );

    setTimeout(() => {
      setIsRunningTests((current) => {
        if (current) {
          setTestCases((prev) =>
            prev.map((tc) => (tc.id === caseToRun.id && tc.status === 'running' ? { ...tc, status: 'error', errorMessage: 'Server timeout' } : tc))
          );
          return false;
        }
        return current;
      });
    }, 15000);

    const targetSocket = typeof getCompilerSocket === 'function' ? getCompilerSocket() : null;
    if (!targetSocket || !targetSocket.connected) {
      setTestCases((prev) =>
        prev.map((tc) => (tc.id === caseToRun.id ? { ...tc, status: 'error', errorMessage: 'Compiler socket not connected' } : tc))
      );
      setIsRunningTests(false);
      return;
    }

    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    const runCode = (codeRef && codeRef.current !== undefined) ? codeRef.current : code;
    targetSocket.emit('run_test_cases', {
      code: runCode,
      testCases: [caseToRun],
      token,
      user: currentUser
    });
  };

  const handleRunAllTestCases = () => {
    if (
      submitted ||
      isDesktopWeb ||
      (vmDetected && kioskRules?.blockVirtualMachine !== false) ||
      !testCases ||
      testCases.length === 0
    ) {
      return;
    }

    if (typeof setBottomTab === 'function') setBottomTab('testcases');
    setIsRunningTests(true);
    setTestCases((prev) => prev.map((tc) => ({ ...tc, status: 'running', errorMessage: '', actualOutput: '' })));

    setTimeout(() => {
      setIsRunningTests((current) => {
        if (current) {
          setTestCases((prev) =>
            prev.map((tc) => (tc.status === 'running' ? { ...tc, status: 'error', errorMessage: 'Server timeout' } : tc))
          );
          return false;
        }
        return current;
      });
    }, 15000);

    const targetSocket = typeof getCompilerSocket === 'function' ? getCompilerSocket() : null;
    if (!targetSocket || !targetSocket.connected) {
      setTestCases((prev) =>
        prev.map((tc) => ({ ...tc, status: 'error', errorMessage: 'Compiler socket not connected' }))
      );
      setIsRunningTests(false);
      return;
    }

    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    const runCode = (codeRef && codeRef.current !== undefined) ? codeRef.current : code;
    targetSocket.emit('run_test_cases', {
      code: runCode,
      testCases,
      token,
      user: currentUser
    });
  };

  const handleTestResults = (data) => {
    const results = data?.results || [];
    setTestCases((prev) =>
      prev.map((tc) => {
        const res = results.find((r) => String(r.id) === String(tc.id));
        if (!res) return tc;
        return {
          ...tc,
          status: res.status,
          actualOutput: res.actualOutput !== undefined ? res.actualOutput : '',
          errorMessage: res.error || ''
        };
      })
    );
    setIsRunningTests(false);
  };

  const handleSingleTestResult = (res) => {
    if (!res) return;
    setTestCases((prev) =>
      prev.map((tc) => {
        if (String(tc.id) === String(res.id)) {
          return {
            ...tc,
            status: res.status,
            actualOutput: res.actualOutput !== undefined ? res.actualOutput : '',
            errorMessage: res.error || ''
          };
        }
        return tc;
      })
    );
  };

  const passedTestsCount = testCases.filter((t) => t.status === 'passed').length;
  const hasTested = testCases.some((t) => t.status === 'passed' || t.status === 'failed');

  return {
    testCases,
    setTestCases,
    activeTestCaseId,
    setActiveTestCaseId,
    isRunningTests,
    passedTestsCount,
    hasTested,
    handleAddTestCase,
    handleDeleteTestCase,
    handleUpdateTestCase,
    handleRunTestCase,
    handleRunAllTestCases,
    handleTestResults,
    handleSingleTestResult
  };
}
