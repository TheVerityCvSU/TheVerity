import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { ArrowLeft, Save, Play, Square, Settings, TerminalSquare, Check, AlertTriangle, Trash2, Moon, Sun, X, Link2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, PanelLeftClose, PanelLeft, BookOpen, CheckSquare, Plus, CheckCircle2, XCircle, PlayCircle, Loader2, Maximize2, Minimize2, Monitor, MonitorX, ShieldAlert, Lock } from 'lucide-react';
import { apiFetch, getCompilerSocketUrl, getLocalApiUrl, getCloudUrl, getConnectionStatus } from '../utils/api';
import localStore from '../services/localStore';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import ImagePreviewModal from '../components/ImagePreviewModal';
import VideoPreviewModal from '../components/VideoPreviewModal';
import IframePreviewModal from '../components/IframePreviewModal';
import VideoAttachment from '../components/VideoAttachment';
import AttachmentCard from '../components/AttachmentCard';
import { openDotnetSetup } from '../utils/dotnetHelper';
import { isDesktopWebBrowser } from '../utils/deviceUtils';
import { registerMonacoSnippets } from '../utils/monacoSnippets.js';

// Strip whitespace so editor auto-indent on paste doesn't cause false mismatches.
const normalize = (text) => (text || "").replace(/\s+/g, '');

export default function StudentView({ socket, currentUser, username, assignment, classroom, onBack, isSandbox = false }) {
  // SAFETY NET: Robust student display name and persistent ID
  const studentDisplayName =
    (currentUser?.name && currentUser.name.trim()) ||
    (typeof username === 'string' && username.trim()) ||
    (currentUser?.displayName && currentUser.displayName.trim()) ||
    (currentUser?.fullName && currentUser.fullName.trim()) ||
    (currentUser?.full_name && currentUser.full_name.trim()) ||
    (currentUser?.email ? currentUser.email.split('@')[0] : '') ||
    `Student_${Math.floor(Math.random() * 1000)}`;
  const safeUsername = studentDisplayName;
  const studentActualId =
    currentUser?.id != null
      ? String(currentUser.id)
      : (currentUser?.email || studentDisplayName);
  const studentId = studentActualId;
  const assignmentId = assignment?.id != null ? String(assignment.id) : 'none';
  const rawClassroomId =
    classroom?.id ??
    classroom?.classroom_id ??
    classroom?.code ??
    assignment?.classroom_id ??
    assignment?.classroomId ??
    assignment?.classId ??
    assignment?.classroom?.id ??
    null;
  const classroomId = rawClassroomId != null && rawClassroomId !== '' && rawClassroomId !== 'none'
    ? String(rawClassroomId)
    : 'none';

  const getSubKeys = () => [
    `verity_sub_${classroomId}_${assignmentId}_${studentId}`,
    `verity_sub_${classroomId}_${assignmentId}_${safeUsername}`,
    currentUser?.name ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.name}` : null,
    currentUser?.email ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.email}` : null,
    currentUser?.id ? `verity_sub_${classroomId}_${assignmentId}_id_${currentUser.id}` : null,
    `verity_sub_${classroomId}_${assignmentId}`
  ].filter(Boolean);

  const checkLocalSubmitted = () => {
    const keys = getSubKeys();
    for (const k of keys) {
      try {
        if (localStorage.getItem(k)) return true;
      } catch { /* ignore */ }
    }
    return false;
  };

  const [submitted, setSubmitted] = useState(() => checkLocalSubmitted());

  // Locked workspace check: when teacher enabled disableBack, students cannot exit until submitted
  const isBackDisabled = Boolean(!isSandbox && (assignment?.disableBack || assignment?.disable_back));
  const isBackBlocked = isBackDisabled && !submitted;

  // Intercept browser back navigation & keyboard shortcuts when back is blocked
  useEffect(() => {
    if (!isBackBlocked) return;

    const handleKeyDown = (e) => {
      // Block Alt + ArrowLeft (browser back)
      if (e.altKey && (e.key === 'ArrowLeft' || e.keyCode === 37)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handlePopState = (e) => {
      try {
        window.history.pushState(null, '', window.location.href);
      } catch {}
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isBackBlocked]);

  const getHistoryKeys = () => [
    `verity_history_${classroomId}_${assignmentId}_${studentId}`,
    `verity_history_${classroomId}_${assignmentId}_${safeUsername}`,
    currentUser?.name ? `verity_history_${classroomId}_${assignmentId}_${currentUser.name}` : null,
    currentUser?.email ? `verity_history_${classroomId}_${assignmentId}_${currentUser.email}` : null,
    `verity_history_${assignmentId}_${studentId}`,
    `verity_history_${assignmentId}_${safeUsername}`
  ].filter(Boolean);

  const draftKey = `verity_code_${assignmentId}_${studentId}`;

  const initialCode = `using System;\n\nnamespace HelloWorld\n{\n    class Program\n    {\n        static void Main(string[] args)\n        {\n            Console.WriteLine("Hello, World!");\n        }\n    }\n}`;

  const [code, setCode] = useState(() => {
    try {
      const savedCode = localStorage.getItem(draftKey);
      if (savedCode && !savedCode.includes("UserInputApp")) return savedCode;
    } catch { /* ignore */ }
    return assignment?.starterCode || initialCode;
  });

  // Multi-file support (sandbox + assignment modes)
  const extraFilesKey = `verity_extrafiles_${assignmentId}_${studentId}`;
  const [extraFiles, setExtraFiles] = useState(() => {
    try {
      const saved = localStorage.getItem(extraFilesKey);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [];
  });
  const [activeFileId, setActiveFileId] = useState('main'); // 'main' = Program.cs
  const [renamingFileId, setRenamingFileId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const persistExtraFiles = (files) => {
    try { localStorage.setItem(extraFilesKey, JSON.stringify(files)); } catch { /* ignore */ }
  };

  const handleAddFile = () => {
    if (submitted) return;
    const num = extraFiles.length + 2;
    const newFile = { id: `ef_${Date.now()}`, name: `File${num}`, code: `// File${num}.cs\npublic class File${num}\n{\n    // Add your code here\n}\n` };
    const updated = [...extraFiles, newFile];
    setExtraFiles(updated);
    persistExtraFiles(updated);
    setActiveFileId(newFile.id);
  };

  const handleDeleteFile = (id) => {
    if (submitted) return;
    const updated = extraFiles.filter(f => f.id !== id);
    setExtraFiles(updated);
    persistExtraFiles(updated);
    if (activeFileId === id) setActiveFileId('main');
  };

  const handleRenameFile = (id, newName) => {
    if (submitted) return;
    const safeName = newName.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 40) || 'File';
    const updated = extraFiles.map(f => f.id === id ? { ...f, name: safeName } : f);
    setExtraFiles(updated);
    persistExtraFiles(updated);
    setRenamingFileId(null);
  };

  const handleExtraFileCodeChange = (id, newCode) => {
    if (submitted) return;
    const updated = extraFiles.map(f => f.id === id ? { ...f, code: newCode } : f);
    setExtraFiles(updated);
    persistExtraFiles(updated);
  };

  // Derive the active code and setter based on which tab is open
  const activeCode = activeFileId === 'main' ? code : (extraFiles.find(f => f.id === activeFileId)?.code ?? '');
  const setActiveCode = (newCode) => {
    if (activeFileId === 'main') {
      setCode(newCode);
    } else {
      handleExtraFileCodeChange(activeFileId, newCode);
    }
  };

  const loadInitialHistory = (currentCode) => {
    // 1. Check persistent history keys
    const hKeys = [
      `verity_history_${classroomId}_${assignmentId}_${studentId}`,
      `verity_history_${classroomId}_${assignmentId}_${safeUsername}`,
      currentUser?.name ? `verity_history_${classroomId}_${assignmentId}_${currentUser.name}` : null,
      currentUser?.email ? `verity_history_${classroomId}_${assignmentId}_${currentUser.email}` : null,
      `verity_history_${assignmentId}_${studentId}`,
      `verity_history_${assignmentId}_${safeUsername}`
    ].filter(Boolean);
    for (const k of hKeys) {
      try {
        const item = localStorage.getItem(k);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch { }
    }

    // 2. Check draft storage in localStorage
    const dKeys = [
      `verity_draft_${assignmentId}_${studentId}`,
      `verity_draft_${assignmentId}_${safeUsername}`
    ];
    for (const k of dKeys) {
      try {
        const item = localStorage.getItem(k);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed?.history) && parsed.history.length > 0) return parsed.history;
        }
      } catch { }
    }

    // 3. Check existing submissions in localStorage (e.g. from prior submit before unsubmit)
    const sKeys = [
      `verity_sub_${classroomId}_${assignmentId}_${studentId}`,
      `verity_sub_${classroomId}_${assignmentId}_${safeUsername}`,
      currentUser?.name ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.name}` : null,
      currentUser?.email ? `verity_sub_${classroomId}_${assignmentId}_${currentUser.email}` : null,
      `verity_sub_${classroomId}_${assignmentId}`
    ].filter(Boolean);
    for (const k of sKeys) {
      try {
        const item = localStorage.getItem(k);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed?.codeHistory) && parsed.codeHistory.length > 0) return parsed.codeHistory;
          if (Array.isArray(parsed?.history) && parsed.history.length > 0) return parsed.history;
        }
      } catch { }
    }

    // Fallback: start initial point
    return [{ time: Date.now(), code: currentCode }];
  };

  const [codeHistory, setCodeHistory] = useState(() => loadInitialHistory(code));
  const codeHistoryRef = useRef(codeHistory);
  codeHistoryRef.current = codeHistory;

  const persistHistory = (hist, currentCodeVal) => {
    if (!Array.isArray(hist) || hist.length === 0) return;
    const curCode = currentCodeVal !== undefined ? currentCodeVal : (codeRef?.current || code);
    
    // Save to all history keys in localStorage
    getHistoryKeys().forEach(k => {
      try { localStorage.setItem(k, JSON.stringify(hist)); } catch { }
    });

    // Save to localStore (SQLite / IPC / browser fallback)
    try {
      localStore.saveDraft(assignmentId, studentId, curCode, hist);
      if (studentId !== safeUsername) {
        localStore.saveDraft(assignmentId, safeUsername, curCode, hist);
      }
    } catch { }
  };
  const [output, setOutput] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  // True once the program is actually running (past compilation) — gates the
  // terminal input box so the cursor doesn't show during "Initializing/Compiling".
  const [programStarted, setProgramStarted] = useState(false);
  // Seed the instruction from the assignment the student opened ("details").
  const [instruction, setInstruction] = useState(assignment?.details || "");
  const [strictCompiler, setStrictCompiler] = useState(false);
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showUnsubmitModal, setShowUnsubmitModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [previewIframe, setPreviewIframe] = useState(null);

  const handleInstructionClick = (e) => {
    const anchor = e.target.closest('a');
    if (anchor && anchor.href) {
      e.preventDefault();
      e.stopPropagation();
      const targetUrl = anchor.href;
      setPreviewIframe({
        url: targetUrl,
        name: anchor.innerText?.trim() || targetUrl,
        type: 'link'
      });
    }
  };
  const [editorFontSize, setEditorFontSize] = useState(() => {
    try {
      return Number(localStorage.getItem('verity_editor_font_size')) || 16;
    } catch {
      return 16;
    }
  });

  const [kioskRules, setKioskRules] = useState({
    flagTabExits: true,
    strictClipboardBlocking: true,
    flagMultipleLogins: true,
    violationThreshold: 3,
    sessionTimeout: '30m',
    cognitivePauseThreshold: 45,
    enforceSingleMonitor: false,
    disableWindowsKeyAltTab: true,
    blockVirtualMachine: true
  });
  const kioskRulesRef = useRef(kioskRules);
  useEffect(() => { kioskRulesRef.current = kioskRules; }, [kioskRules]);

  const [multiMonitorDetected, setMultiMonitorDetected] = useState(false);
  const [vmDetected, setVmDetected] = useState(false);
  const [vmReasons, setVmReasons] = useState([]);
  const [isDesktopWeb, setIsDesktopWeb] = useState(() => isDesktopWebBrowser());
  const [idleWarning, setIdleWarning] = useState(false);

  // Real-time DevTools and viewport resize monitor in exam workspace
  useEffect(() => {
    if (window.electronAPI) return;

    const checkEnvironment = () => {
      const isDesktop = isDesktopWebBrowser();
      setIsDesktopWeb(prev => prev !== isDesktop ? isDesktop : prev);
    };

    window.addEventListener('resize', checkEnvironment);
    window.addEventListener('orientationchange', checkEnvironment);
    const timer = setInterval(checkEnvironment, 600);

    return () => {
      window.removeEventListener('resize', checkEnvironment);
      window.removeEventListener('orientationchange', checkEnvironment);
      clearInterval(timer);
    };
  }, []);
  const lastActivityRef = useRef(Date.now());
  const cognitivePauseTimerRef = useRef(null);
  const hasLoggedPauseRef = useRef(false);

  // Synchronize compiler strictness & kiosk rules from Admin Settings
  useEffect(() => {
    let isMounted = true;
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/system-settings`)
      .then(res => res.ok ? res.json() : {})
      .then(d => {
        if (!isMounted) return;
        const treatWarnings = !!d.settings?.examDefaults?.treatWarningsAsErrors;
        setStrictCompiler(treatWarnings);
        if (d.settings?.global_config?.security) {
          setKioskRules(prev => ({ ...prev, ...d.settings.global_config.security }));
        } else if (d.settings?.security) {
          setKioskRules(prev => ({ ...prev, ...d.settings.security }));
        }
      })
      .catch(() => {});

    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/kiosk-settings`)
      .then(res => res.ok ? res.json() : {})
      .then(data => {
        if (isMounted && data?.settings) {
          setKioskRules(prev => ({ ...prev, ...data.settings }));
        }
      })
      .catch(() => {});

    if (socket) {
      const sendAuth = () => {
        const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
        socket.emit('authenticate', { token, user: currentUser });
      };

      sendAuth();
      socket.on('connect', sendAuth);

      const handleSettingsUpdate = (data) => {
        if (data?.settings?.examDefaults?.treatWarningsAsErrors !== undefined) {
          setStrictCompiler(!!data.settings.examDefaults.treatWarningsAsErrors);
        }
        if (data?.settings?.global_config?.security) {
          setKioskRules(prev => ({ ...prev, ...data.settings.global_config.security }));
        }
      };
      const handleKioskSettings = (newSettings) => {
        if (newSettings) {
          setKioskRules(prev => ({ ...prev, ...newSettings }));
        }
      };

      socket.on('system_settings_updated', handleSettingsUpdate);
      socket.on('kiosk_settings', handleKioskSettings);
      return () => {
        isMounted = false;
        socket.off('connect', sendAuth);
        socket.off('system_settings_updated', handleSettingsUpdate);
        socket.off('kiosk_settings', handleKioskSettings);
      };
    }
    return () => { isMounted = false; };
  }, [socket, currentUser]);

  // Activate Electron lockdown with option to disable Windows key / Alt+Tab hook
  useEffect(() => {
    if (window.electronAPI && typeof window.electronAPI.enableLockdown === 'function') {
      window.electronAPI.enableLockdown({ disableWindowsKeyAltTab: kioskRules.disableWindowsKeyAltTab });
    }
  }, [kioskRules.disableWindowsKeyAltTab]);



  // Monitor count enforcement
  useEffect(() => {
    if (!kioskRules.enforceSingleMonitor) {
      setMultiMonitorDetected(false);
      return;
    }

    const checkMonitors = async () => {
      if (window.electronAPI && typeof window.electronAPI.getDisplayCount === 'function') {
        try {
          const count = await window.electronAPI.getDisplayCount();
          setMultiMonitorDetected(count > 1);
        } catch (_) {}
      }
    };

    checkMonitors();
    const interval = setInterval(checkMonitors, 3000);
    return () => clearInterval(interval);
  }, [kioskRules.enforceSingleMonitor]);

  // Virtual Machine (VM) detection & enforcement
  useEffect(() => {
    if (kioskRules.blockVirtualMachine === false) {
      setVmDetected(false);
      return;
    }

    let isMounted = true;
    const checkVm = async () => {
      if (window.electronAPI && typeof window.electronAPI.checkVmStatus === 'function') {
        try {
          const res = await window.electronAPI.checkVmStatus();
          if (!isMounted) return;
          if (res && res.isVm) {
            setVmDetected(true);
            setVmReasons(res.reasons || []);
            const studentName = currentUser?.name || currentUser?.email || 'Student';
            const studentIdVal = currentUser?.id || currentUser?.email || studentName;
            emitToSockets('proctor_alert', {
              studentId: studentIdVal,
              name: studentName,
              email: currentUser?.email || '',
              action: 'Virtual Machine Detected',
              desc: `VM Detected during exam: ${(res.reasons && res.reasons[0]) || 'Virtualized environment detected'}`,
              color: '#ef4444'
            });
          } else {
            setVmDetected(false);
          }
        } catch (_) {}
      }
    };

    checkVm();
    const interval = setInterval(checkVm, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [kioskRules.blockVirtualMachine, socket, currentUser]);

  // Idle session timeout enforcement
  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    const parseTimeoutMs = (str) => {
      if (!str) return 30 * 60 * 1000;
      const match = String(str).match(/^(\d+)\s*([smh])?$/i);
      if (!match) return 30 * 60 * 1000;
      const val = parseInt(match[1], 10);
      const unit = (match[2] || 'm').toLowerCase();
      if (unit === 's') return val * 1000;
      if (unit === 'h') return val * 3600 * 1000;
      return val * 60 * 1000;
    };

    const timeoutMs = parseTimeoutMs(kioskRules.sessionTimeout);
    const interval = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime >= timeoutMs - 60000) {
        setIdleWarning(true);
      } else {
        setIdleWarning(false);
      }
    }, 5000);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      clearInterval(interval);
    };
  }, [kioskRules.sessionTimeout]);

  useEffect(() => {
    if (assignment?.details !== undefined) {
      setInstruction(assignment.details);
    }
  }, [assignment?.details]);

  // Load draft from local SQLite storage if available
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const draft = await localStore.getDraft(assignmentId, studentId);
        if (isMounted && draft && draft.code && !draft.code.includes("UserInputApp")) {
          setCode(draft.code);
          codeRef.current = draft.code;
          if (Array.isArray(draft.history) && draft.history.length > 0) {
            setCodeHistory(prev => {
              if (draft.history.length > prev.length) {
                persistHistory(draft.history, draft.code);
                return draft.history;
              }
              return prev;
            });
          }
        }
      } catch { /* ignore */ }
    })();
    return () => { isMounted = false; };
  }, [assignmentId, studentId]);
  const terminalEndRef = useRef(null);
  const terminalBodyRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const diagnosticsRef = useRef([]);
  const [proctorLogs, setProctorLogs] = useState(() => {
    try {
      const aId = assignment?.id != null ? String(assignment.id) : (assignmentId && assignmentId !== 'none' ? String(assignmentId) : null);
      if (!aId || aId === 'none' || aId === 'default' || aId === 'undefined') return [];
      const cId = classroom?.id != null ? String(classroom.id) : (classroomId || 'none');
      const sId = studentActualId || 'student';
      const keys = [
        `verity_proctor_logs_${cId}_${aId}_${sId}`,
        sId !== safeUsername ? `verity_proctor_logs_${cId}_${aId}_${safeUsername}` : null,
        cId !== 'none' ? `verity_proctor_logs_none_${aId}_${sId}` : null
      ].filter(Boolean);
      for (const k of keys) {
        const saved = localStorage.getItem(k);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter(l => !l.assignmentId || String(l.assignmentId) === aId);
          }
        }
      }
    } catch {}
    return [];
  });
  const proctorLogsRef = useRef(proctorLogs);
  proctorLogsRef.current = proctorLogs;

  // Sync proctorLogs when assignment / classroom finishes loading
  useEffect(() => {
    const aId = assignment?.id != null ? String(assignment.id) : (assignmentId && assignmentId !== 'none' ? String(assignmentId) : null);
    if (!aId || aId === 'none' || aId === 'default' || aId === 'undefined') {
      setProctorLogs([]);
      return;
    }
    const cId = classroom?.id != null ? String(classroom.id) : (classroomId || 'none');
    const sId = studentActualId || 'student';
    try {
      const keys = [
        `verity_proctor_logs_${cId}_${aId}_${sId}`,
        sId !== safeUsername ? `verity_proctor_logs_${cId}_${aId}_${safeUsername}` : null,
        cId !== 'none' ? `verity_proctor_logs_none_${aId}_${sId}` : null
      ].filter(Boolean);
      let found = null;
      for (const k of keys) {
        const saved = localStorage.getItem(k);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            found = parsed.filter(l => !l.assignmentId || String(l.assignmentId) === aId);
            break;
          }
        }
      }
      setProctorLogs(found || []);
    } catch {
      setProctorLogs([]);
    }
  }, [classroom?.id, classroomId, assignment?.id, assignmentId, studentActualId, safeUsername]);

  // High-Speed Local Compiler Socket (instant execution in Electron / local machine)
  const [localSocket, setLocalSocket] = useState(null);
  const localSocketRef = useRef(null);

  useEffect(() => {
    let isSubscribed = true;
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');

    try {
      const socketEndpoint = getCompilerSocketUrl();
      const localFallback = getLocalApiUrl();
      const local = io(socketEndpoint, {
        timeout: 3000,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        auth: { token }
      });

      local.on('connect', () => {
        if (isSubscribed) {
          setLocalSocket(local); // triggers re-run of listener useEffect
          local.emit('authenticate', { token, user: currentUser });
        }
      });

      local.on('disconnect', () => {
        if (isSubscribed) setLocalSocket(null);
      });

      local.on('connect_error', () => {
        if (local.io && local.io.uri !== localFallback) {
          console.warn(`[StudentView] Compiler socket at ${local.io.uri} unreachable. Switching to local server at ${localFallback}...`);
          local.io.uri = localFallback;
          local.connect();
          return;
        }
        if (isSubscribed) setLocalSocket(null);
      });

      localSocketRef.current = local;
    } catch (_) {}

    return () => {
      isSubscribed = false;
      setLocalSocket(null);
      if (localSocketRef.current) {
        try { localSocketRef.current.disconnect(); } catch (_) {}
        localSocketRef.current = null;
      }
    };
  }, [currentUser]);

  const getCompilerSocket = () => {
    if (localSocket && localSocket.connected) {
      return localSocket;
    }
    return socket;
  };

  // Bottom panel tab: 'terminal' or 'testcases'
  const [bottomTab, setBottomTab] = useState('terminal');

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

  // Persist custom test cases to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`verity_testcases_${assignmentId}_${studentId}`, JSON.stringify(testCases));
    } catch {}
  }, [testCases, assignmentId, studentId]);

  // Keep activeTestCaseId valid
  useEffect(() => {
    if (!testCases.some(tc => tc.id === activeTestCaseId) && testCases.length > 0) {
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
    setTestCases(prev => [...prev, newCase]);
    setActiveTestCaseId(newId);
    setBottomTab('testcases');
  };

  const handleDeleteTestCase = (id, e) => {
    if (e) e.stopPropagation();
    if (submitted || testCases.length <= 1) return;
    const remaining = testCases.filter(tc => tc.id !== id);
    setTestCases(remaining);
    if (activeTestCaseId === id) {
      setActiveTestCaseId(remaining[0].id);
    }
  };

  const handleUpdateTestCase = (id, field, value) => {
    if (submitted) return;
    setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, [field]: value, status: 'idle' } : tc));
  };

  const handleRunTestCase = (targetCase = null) => {
    if (submitted || isDesktopWeb || (vmDetected && kioskRules.blockVirtualMachine !== false)) return;
    const caseToRun = targetCase || testCases.find(tc => tc.id === activeTestCaseId) || testCases[0];
    if (!caseToRun) return;

    setBottomTab('testcases');
    setIsRunningTests(true);
    setTestCases(prev => prev.map(tc => tc.id === caseToRun.id ? { ...tc, status: 'running', errorMessage: '', actualOutput: '' } : tc));

    // Failsafe timeout
    setTimeout(() => {
        setIsRunningTests((current) => {
            if (current) {
                setTestCases(prev => prev.map(tc => tc.id === caseToRun.id && tc.status === 'running' ? { ...tc, status: 'error', errorMessage: 'Server timeout' } : tc));
                return false;
            }
            return current;
        });
    }, 15000);

    const targetSocket = getCompilerSocket();
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    targetSocket.emit('run_test_cases', {
      code,
      testCases: [caseToRun],
      token,
      user: currentUser
    });
  };

  const handleRunAllTestCases = () => {
    if (submitted || isDesktopWeb || (vmDetected && kioskRules.blockVirtualMachine !== false) || !testCases || testCases.length === 0) return;

    setBottomTab('testcases');
    setIsRunningTests(true);
    setTestCases(prev => prev.map(tc => ({ ...tc, status: 'running', errorMessage: '', actualOutput: '' })));

    // Failsafe timeout
    setTimeout(() => {
        setIsRunningTests((current) => {
            if (current) {
                setTestCases(prev => prev.map(tc => tc.status === 'running' ? { ...tc, status: 'error', errorMessage: 'Server timeout' } : tc));
                return false;
            }
            return current;
        });
    }, 15000);

    const targetSocket = getCompilerSocket();
    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    targetSocket.emit('run_test_cases', {
      code,
      testCases,
      token,
      user: currentUser
    });
  };

  // Terminal resizable height & drag state
  const [terminalHeight, setTerminalHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_terminal_height');
      if (saved) return Math.max(100, Math.min(parseInt(saved, 10), window.innerHeight * 0.75));
    } catch {}
    return 240;
  });

  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(() => {
    try {
      return localStorage.getItem('verity_terminal_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);

  const toggleTerminalCollapse = () => {
    setIsTerminalMaximized(false);
    setIsTerminalCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('verity_terminal_collapsed', String(next)); } catch {}
      return next;
    });
  };
  const toggleTerminalMaximize = () => {
    setIsTerminalCollapsed(false);
    setIsTerminalMaximized(prev => !prev);
  };

  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(240);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);

  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsResizingTerminal(true);

    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    startYRef.current = clientY;

    // Immediately un-collapse and un-maximize so drag visually updates in real time
    let curHeight = terminalHeight;
    if (isTerminalCollapsed) {
      curHeight = 38;
      setIsTerminalCollapsed(false);
      try { localStorage.setItem('verity_terminal_collapsed', 'false'); } catch {}
    }
    if (isTerminalMaximized) {
      curHeight = Math.round(window.innerHeight * 0.5);
      setIsTerminalMaximized(false);
    }
    startHeightRef.current = curHeight;
    setTerminalHeight(curHeight);

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const currentY = moveEvent.clientY ?? moveEvent.touches?.[0]?.clientY;
      if (currentY === undefined) return;
      const deltaY = startYRef.current - currentY;
      const minHeight = 60;
      const maxHeight = Math.max(minHeight, Math.round(window.innerHeight * 0.85));
      const newHeight = Math.max(minHeight, Math.min(startHeightRef.current + deltaY, maxHeight));
      setTerminalHeight(newHeight);
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsResizingTerminal(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      setTerminalHeight((finalHeight) => {
        try { localStorage.setItem('verity_terminal_height', String(finalHeight)); } catch {}
        return finalHeight;
      });
      setTimeout(() => {
        if (editorRef.current) editorRef.current.layout();
      }, 30);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
  };

  // Instruction sidebar resizable width & height state
  const [instructionWidth, setInstructionWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_instruction_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 180 && val <= window.innerWidth * 0.75) {
          return val;
        }
      }
    } catch {}
    return 320;
  });

  const [instructionHeight, setInstructionHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_instruction_height');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 100 && val <= window.innerHeight * 0.7) {
          return val;
        }
      }
    } catch {}
    return Math.round(window.innerHeight * 0.35);
  });

  const [isInstructionCollapsed, setIsInstructionCollapsed] = useState(() => {
    try {
      return localStorage.getItem('verity_instruction_collapsed') === 'true';
    } catch {}
    return false;
  });

  // Warning section height inside the sidebar
  const [warningHeight, setWarningHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_warning_height');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 45 && val <= 500) return val;
      }
    } catch {}
    return 220;
  });
  const [isWarningCollapsed, setIsWarningCollapsed] = useState(false);
  const [isWarningMaximized, setIsWarningMaximized] = useState(false);
  const toggleWarningMaximize = () => {
    setIsWarningCollapsed(false);
    setIsWarningMaximized(prev => !prev);
  };

  // Drag states
  const isDraggingSidebarRef = useRef(false);
  const startSidebarXRef = useRef(0);
  const startSidebarYRef = useRef(0);
  const startSidebarWidthRef = useRef(320);
  const startSidebarHeightRef = useRef(250);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const isDraggingWarningRef = useRef(false);
  const startWarningYRef = useRef(0);
  const startWarningHeightRef = useRef(220);
  const [isResizingWarning, setIsResizingWarning] = useState(false);

  // Resize handler for Instruction sidebar (Horizontal on desktop, Vertical on mobile)
  const handleSidebarDividerMouseDown = (e) => {
    e.preventDefault();
    if (isInstructionCollapsed) return;
    isDraggingSidebarRef.current = true;
    setIsResizingSidebar(true);
    startSidebarXRef.current = e.clientX;
    startSidebarYRef.current = e.clientY;
    startSidebarWidthRef.current = instructionWidth;
    startSidebarHeightRef.current = instructionHeight;
    document.body.style.cursor = isMobile ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingSidebarRef.current) return;
      if (isMobile) {
        const deltaY = moveEvent.clientY - startSidebarYRef.current;
        const minH = 100;
        const maxH = Math.round(window.innerHeight * 0.7);
        const newH = Math.max(minH, Math.min(startSidebarHeightRef.current + deltaY, maxH));
        setInstructionHeight(newH);
      } else {
        const deltaX = moveEvent.clientX - startSidebarXRef.current;
        const minW = 200;
        const maxW = Math.round(window.innerWidth * 0.7);
        const newW = Math.max(minW, Math.min(startSidebarWidthRef.current + deltaX, maxW));
        setInstructionWidth(newW);
      }
    };

    const handleMouseUp = () => {
      isDraggingSidebarRef.current = false;
      setIsResizingSidebar(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (isMobile) {
        setInstructionHeight((finalH) => {
          try { localStorage.setItem('verity_instruction_height', String(finalH)); } catch {}
          return finalH;
        });
      } else {
        setInstructionWidth((finalW) => {
          try { localStorage.setItem('verity_instruction_width', String(finalW)); } catch {}
          return finalW;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Resize handler for internal Warning section inside instruction sidebar
  const handleWarningDividerMouseDown = (e) => {
    e.preventDefault();
    if (isWarningCollapsed) return;
    isDraggingWarningRef.current = true;
    setIsResizingWarning(true);
    startWarningYRef.current = e.clientY;
    startWarningHeightRef.current = warningHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingWarningRef.current) return;
      const deltaY = startWarningYRef.current - moveEvent.clientY;
      const minH = 70;
      const maxH = 450;
      const newH = Math.max(minH, Math.min(startWarningHeightRef.current + deltaY, maxH));
      setWarningHeight(newH);
    };

    const handleMouseUp = () => {
      isDraggingWarningRef.current = false;
      setIsResizingWarning(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      setWarningHeight((finalH) => {
        try { localStorage.setItem('verity_warning_height', String(finalH)); } catch {}
        return finalH;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const [isInstructionMaximized, setIsInstructionMaximized] = useState(false);
  const toggleInstructionCollapse = () => {
    setIsInstructionMaximized(false);
    setIsInstructionCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('verity_instruction_collapsed', String(next)); } catch {}
      return next;
    });
  };
  const toggleInstructionMaximize = () => {
    setIsInstructionCollapsed(false);
    setIsInstructionMaximized(prev => !prev);
  };

  // Keep Monaco editor layout in sync with sidebar and terminal resizing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [instructionWidth, instructionHeight, isInstructionCollapsed, terminalHeight, warningHeight, isWarningCollapsed]);

  const codeRef = useRef(code);
  codeRef.current = code;
  const [saveStatus, setSaveStatus] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Dual-bridge secondary socket (connecting to LAN if primary is Cloud, or Cloud if primary is LAN)
  const secondarySocketRef = useRef(null);

  useEffect(() => {
    let secSocket = null;
    try {
      const conn = getConnectionStatus();
      const localUrl = getLocalApiUrl();
      const cloudUrl = getCloudUrl();
      const primaryUri = socket?.io?.uri || '';

      let altTarget = null;
      if (primaryUri.includes('localhost') || primaryUri.includes('127.0.0.1') || primaryUri.includes('192.168.')) {
        if (conn.isOnline && cloudUrl && !cloudUrl.includes('localhost') && !cloudUrl.includes('127.0.0.1')) {
          altTarget = cloudUrl;
        }
      } else {
        if (!conn.isWebHosted && localUrl && !localUrl.includes('verity-2z4v')) {
          altTarget = localUrl;
        }
      }

      if (altTarget && altTarget !== primaryUri) {
        console.log(`📡 [StudentView] Establishing secondary dual-bridge socket to ${altTarget}`);
        secSocket = io(altTarget, {
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          timeout: 5000,
          transports: ['websocket', 'polling'],
          auth: (cb) => {
            const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
            cb({ token });
          }
        });
        secondarySocketRef.current = secSocket;
      }
    } catch (_) {}

    return () => {
      if (secondarySocketRef.current) {
        try { secondarySocketRef.current.disconnect(); } catch (_) {}
        secondarySocketRef.current = null;
      }
    };
  }, [socket]);

  const emitToSockets = useCallback((event, data) => {
    if (socket && typeof socket.emit === 'function') {
      socket.emit(event, data);
    }
    if (secondarySocketRef.current && typeof secondarySocketRef.current.emit === 'function') {
      secondarySocketRef.current.emit(event, data);
    }
  }, [socket]);

  const handleSaveCode = () => {
    if (submitted) return;
    const currentCode = codeRef.current;
    const curHist = codeHistoryRef.current?.length > 0 ? codeHistoryRef.current : codeHistory;
    try {
      localStorage.setItem(draftKey, currentCode);
      if (studentId !== safeUsername) {
        localStorage.setItem(`verity_code_${assignmentId}_${safeUsername}`, currentCode);
      }
      persistHistory(curHist, currentCode);
    } catch { /* ignore */ }

    emitToSockets('student_typing', {
      studentId: studentActualId,
      id: studentActualId,
      name: studentDisplayName,
      studentName: studentDisplayName,
      email: currentUser?.email || '',
      avatar: currentUser?.avatar || '',
      code: currentCode,
      classroomId: (classroom?.id != null ? String(classroom.id) : null) || (classroomId !== 'none' ? classroomId : null) || 'none',
      assignmentId: assignment?.id || assignmentId,
      logs: proctorLogsRef.current || proctorLogs
    });

    setSaveStatus(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus(false);
    }, 2000);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (submitted) return;
        handleSaveCode();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleInstructionCollapse();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [draftKey, safeUsername, studentId, assignmentId, classroom?.id, socket, isInstructionCollapsed, submitted]);

  const isExitingCleanlyRef = useRef(false);
  const leaveInfoRef = useRef({
    curAId: assignment?.id != null ? String(assignment.id) : assignmentId,
    curCId: classroom?.id != null ? String(classroom.id) : classroomId,
    curSId: studentActualId,
    curSName: studentDisplayName
  });

  useEffect(() => {
    leaveInfoRef.current = {
      curAId: assignment?.id != null ? String(assignment.id) : assignmentId,
      curCId: classroom?.id != null ? String(classroom.id) : classroomId,
      curSId: studentActualId,
      curSName: studentDisplayName
    };
  }, [assignment?.id, assignmentId, classroom?.id, classroomId, studentActualId, studentDisplayName]);

  // Tell the server we left the workspace ONLY when actually unmounting,
  // and make sure current keystroke history is flushed to persistent storage.
  useEffect(() => {
    return () => {
      isExitingCleanlyRef.current = true;
      const { curAId, curCId, curSId, curSName } = leaveInfoRef.current;
      if (codeHistoryRef.current && codeHistoryRef.current.length > 0) {
        persistHistory(codeHistoryRef.current, codeRef.current);
      }
      emitToSockets('student_leave_workspace', {
        assignmentId: curAId,
        classroomId: curCId,
        studentId: curSId,
        name: curSName
      });
      try {
        const sKey = `verity_active_session_${curCId}_${curAId}_${curSId}`;
        const tabSessionId = sessionStorage.getItem('verity_tab_session_id') || '';
        localStorage.setItem(sKey, JSON.stringify({
          studentId: curSId,
          assignmentId: curAId,
          classroomId: curCId,
          tabId: tabSessionId,
          lastHeartbeat: Date.now(),
          cleanExit: true
        }));
      } catch (_) {}
    };
  }, [socket]);

  // Tracks text the student copied/cut from INSIDE the app (editor OR terminal),
  // so pasting that same text back into the editor doesn't get flagged.
  const copiedInternallyRef = useRef(new Set());

  // 1. I-announce ang presence ni student at i-maintain ang heartbeat
  const emitPresence = useCallback(() => {
    if (!socket || submitted) return;
    const currentCodeVal = codeRef.current || code;
    const payload = {
      studentId: studentActualId,
      id: studentActualId,
      name: studentDisplayName,
      studentName: studentDisplayName,
      email: currentUser?.email || '',
      avatar: currentUser?.avatar || '',
      code: currentCodeVal,
      classroomId: (classroom?.id != null ? String(classroom.id) : null) || (classroomId !== 'none' ? classroomId : null) || 'none',
      assignmentId: assignment?.id || assignmentId,
      logs: proctorLogsRef.current || proctorLogs,
      timestamp: Date.now()
    };

    emitToSockets('student_enter_activity', payload);
    emitToSockets('student_typing', payload);
  }, [emitToSockets, submitted, studentActualId, studentDisplayName, currentUser, classroom?.id, classroomId, assignment?.id, assignmentId, code]);

  useEffect(() => {
    const currentCodeVal = codeRef.current || code;
    setCodeHistory(prev => {
      if (Array.isArray(prev) && prev.length > 0) {
        const lastEntry = prev[prev.length - 1];
        if (lastEntry && lastEntry.code !== currentCodeVal) {
          const appended = [...prev, { time: Date.now(), code: currentCodeVal }];
          persistHistory(appended, currentCodeVal);
          return appended;
        }
        persistHistory(prev, currentCodeVal);
        return prev;
      }
      const initial = [{ time: Date.now(), code: currentCodeVal }];
      persistHistory(initial, currentCodeVal);
      return initial;
    });

    // I-broadcast agad ang presence
    emitPresence();

    // I-reconnect ang presence pag nag-reconnect ang socket
    if (socket) {
      socket.on('connect', emitPresence);
    }

    // Heartbeat para manatiling active sa live monitoring
    const heartbeatTimer = setInterval(emitPresence, 8000);

    return () => {
      if (socket) {
        socket.off('connect', emitPresence);
      }
      clearInterval(heartbeatTimer);
    };
  }, [socket, emitPresence]);

  // 2. Proctoring alerts at crash detector
  const lastTabExitLogRef = useRef(0);

  const addProctorLog = (message, color = '#ef4444', customDesc = null, isCrash = false) => {
    // Bawal mag-log o mag-alert kung submitted na
    if (submitted) return;
    const timeString = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
    const actionStr = (message || '').toLowerCase();
    const detectedCrash = isCrash || actionStr.includes('crash');
    const logColor = detectedCrash ? '#dc2626' : color;
    const actionLabel = detectedCrash ? 'System Crash' : message;

    const cId = classroom?.id != null ? String(classroom.id) : (classroomId || 'none');
    const aId = assignment?.id != null ? String(assignment.id) : (assignmentId && assignmentId !== 'none' ? String(assignmentId) : 'none');
    const sId = studentActualId || 'student';

    const newLogItem = {
      id: Date.now(),
      message: actionLabel,
      action: actionLabel,
      time: timeString,
      color: logColor,
      isCrash: detectedCrash,
      assignmentId: aId,
      classroomId: cId
    };

    setProctorLogs(prevLogs => {
      // Filter out any past logs that might belong to another assignment
      const filteredPrev = prevLogs.filter(l => !l.assignmentId || String(l.assignmentId) === aId);
      const updated = [newLogItem, ...filteredPrev];
      try {
        if (aId && aId !== 'none' && aId !== 'default' && aId !== 'undefined') {
          localStorage.setItem(`verity_proctor_logs_${cId}_${aId}_${sId}`, JSON.stringify(updated));
          if (sId !== safeUsername) {
            localStorage.setItem(`verity_proctor_logs_${cId}_${aId}_${safeUsername}`, JSON.stringify(updated));
          }
          if (cId && cId !== 'none') {
            localStorage.setItem(`verity_proctor_logs_none_${aId}_${sId}`, JSON.stringify(updated));
          }
        }
      } catch {}
      return updated;
    });

    setCodeHistory(prev => {
      const updated = [...prev, { time: Date.now(), warning: actionLabel, code: codeRef.current }];
      persistHistory(updated, codeRef.current);
      return updated;
    });

    const payload = {
      id: newLogItem.id,
      studentId: sId,
      name: studentDisplayName,
      studentName: studentDisplayName,
      email: currentUser?.email || '',
      action: actionLabel,
      message: actionLabel,
      desc: customDesc || `${actionLabel} in ${assignment?.title || 'workspace'} (classroom ${cId})`,
      time: timeString,
      color: logColor,
      isCrash: detectedCrash,
      classroomId: cId,
      assignmentId: aId
    };

    emitToSockets('proctor_alert', payload);
    const isCopyPaste = !detectedCrash && (actionStr.includes('paste') || actionStr.includes('clipboard') || actionStr.includes('copy'));
    
    // Also post directly to /audit-logs for guaranteed persistence & instant admin dashboard update
    let logType = 'Exit Tab Violation';
    let logSeverity = 'Warning';
    if (detectedCrash) {
      logType = 'System Crash Violation';
      logSeverity = 'High';
    } else if (isCopyPaste) {
      logType = 'Copy/Paste Violation';
      logSeverity = 'High';
    }

    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/audit-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: currentUser?.name || currentUser?.email || safeUsername,
        type: logType,
        severity: logSeverity,
        desc: customDesc || `${actionLabel} in ${assignment?.title || 'workspace'} (classroom ${cId})`
      })
    }).catch(() => {});
  };

  // Heartbeat session tracker and crash detector
  useEffect(() => {
    const cId = classroom?.id != null ? String(classroom.id) : (classroomId || 'none');
    const aId = assignment?.id != null ? String(assignment.id) : (assignmentId || 'none');
    const sId = studentActualId || 'student';
    const sessionKey = `verity_active_session_${cId}_${aId}_${sId}`;

    // Get or assign a persistent tab session identifier
    let tabSessionId = '';
    try {
      tabSessionId = sessionStorage.getItem('verity_tab_session_id') || '';
      if (!tabSessionId) {
        tabSessionId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('verity_tab_session_id', tabSessionId);
      }
    } catch (_) {}

    // 1. Detect if the previous session exited unexpectedly due to crash / abnormal termination
    try {
      const priorSessionRaw = localStorage.getItem(sessionKey);
      if (priorSessionRaw) {
        const prior = JSON.parse(priorSessionRaw);
        const timeSinceHeartbeat = Date.now() - (prior.lastHeartbeat || 0);
        const isSameTab = Boolean(tabSessionId && prior.tabId === tabSessionId);
        const isQuickNav = timeSinceHeartbeat < 25000; // <25s is normal page navigation or refresh, not a dead process

        // An abnormal termination (process kill / browser crash) ONLY applies if:
        // - prior.cleanExit is explicitly false AND
        // - it's NOT the same tab (which is still alive and actively running) AND
        // - it's NOT a quick in-app navigation or page reload (<25s) AND
        // - heartbeat is within 24 hours
        if (prior && prior.cleanExit === false && !isSameTab && !isQuickNav && timeSinceHeartbeat < 24 * 60 * 60 * 1000) {
          const lastCrashLogTime = Number(sessionStorage.getItem(`verity_last_crash_log_${aId}`) || 0);
          if (Date.now() - lastCrashLogTime > 15000) {
            sessionStorage.setItem(`verity_last_crash_log_${aId}`, String(Date.now()));
            addProctorLog(
              'System Crash',
              '#dc2626',
              `System Crash: Previous session terminated abnormally (unexpected crash / process kill during ${assignment?.title || 'activity'})`,
              true
            );
          }
        }
      }
    } catch (_) {}

    // Check if React ErrorBoundary or unhandled error registered a crash
    try {
      const recentCrashRaw = localStorage.getItem('verity_recent_crash');
      if (recentCrashRaw) {
        const rc = JSON.parse(recentCrashRaw);
        if (Date.now() - (rc.time || 0) < 60000) {
          localStorage.removeItem('verity_recent_crash');
          addProctorLog(
            'System Crash',
            '#dc2626',
            `System Crash: Application crashed with error: ${rc.message}`,
            true
          );
        }
      }
    } catch (_) {}

    // 2. Set continuous session heartbeat
    const recordHeartbeat = () => {
      if (isExitingCleanlyRef.current) return;
      try {
        localStorage.setItem(sessionKey, JSON.stringify({
          studentId: sId,
          assignmentId: aId,
          classroomId: cId,
          tabId: tabSessionId,
          lastHeartbeat: Date.now(),
          cleanExit: false
        }));
      } catch (_) {}
    };
    recordHeartbeat();
    const heartbeatTimer = setInterval(recordHeartbeat, 4000);

    // 3. Mark clean exit on browser back / popstate navigation
    const handlePopState = () => {
      isExitingCleanlyRef.current = true;
      try {
        localStorage.setItem(sessionKey, JSON.stringify({
          studentId: sId,
          assignmentId: aId,
          classroomId: cId,
          tabId: tabSessionId,
          lastHeartbeat: Date.now(),
          cleanExit: true
        }));
      } catch (_) {}
    };
    window.addEventListener('popstate', handlePopState);

    // 4. Global runtime error listeners to capture uncaught errors as crashes, not Alt Tab
    const handleRuntimeError = (event) => {
      if (isExitingCleanlyRef.current) return;
      if (event?.message && (
        event.message.includes('ResizeObserver') ||
        event.message.includes('Script error') ||
        event.message.includes('Canceled') ||
        event.message.includes('aborted')
      )) {
        return;
      }
      window.verityCrashTime = Date.now();
      const errorMsg = event?.error?.message || event?.message || 'Uncaught runtime exception';
      addProctorLog(
        'System Crash',
        '#dc2626',
        `System Crash: Fatal exception caught (${errorMsg})`,
        true
      );
    };

    const handleUnhandledRejection = (event) => {
      if (isExitingCleanlyRef.current) return;
      const reason = event?.reason?.message || event?.reason || 'Unhandled Promise Rejection';
      const reasonStr = String(reason);
      if (
        reasonStr.includes('ResizeObserver') ||
        reasonStr.includes('Canceled') ||
        reasonStr.includes('aborted') ||
        reasonStr.includes('disposed')
      ) return;
      window.verityCrashTime = Date.now();
      addProctorLog(
        'System Crash',
        '#dc2626',
        `System Crash: ${reason}`,
        true
      );
    };

    window.verityCrashTime = 0;
    window.addEventListener('error', handleRuntimeError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('error', handleRuntimeError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      // Mark clean exit on effect cleanup / component unmount
      try {
        localStorage.setItem(sessionKey, JSON.stringify({
          studentId: sId,
          assignmentId: aId,
          classroomId: cId,
          tabId: tabSessionId,
          lastHeartbeat: Date.now(),
          cleanExit: true
        }));
      } catch (_) {}
    };
  }, [classroom?.id, classroomId, assignment?.id, assignmentId, studentActualId, assignment?.title]);

  useEffect(() => {
    const handleTabExit = (actionLabel = "Exit tab") => {
      if (kioskRulesRef.current?.flagTabExits === false) return;
      const isRecentCrash = window.verityCrashTime && (Date.now() - window.verityCrashTime < 2500);
      if (isRecentCrash || isExitingCleanlyRef.current) return;
      const now = Date.now();
      // Debounce so blur and visibilitychange don't double fire within 1.5 seconds
      if (now - lastTabExitLogRef.current < 1500) return;
      lastTabExitLogRef.current = now;
      addProctorLog(actionLabel, "#eab308");
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleTabExit("Alt Tab");
      }
    };

    const handleWindowBlur = () => {
      if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
        return;
      }
      handleTabExit("Alt Tab");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  const resetCognitivePauseTimer = useCallback(() => {
    if (cognitivePauseTimerRef.current) {
      clearTimeout(cognitivePauseTimerRef.current);
    }
    hasLoggedPauseRef.current = false;
    const thresholdSec = Number(kioskRulesRef.current.cognitivePauseThreshold) || 45;
    if (thresholdSec <= 0) return;

    cognitivePauseTimerRef.current = setTimeout(() => {
      if (!hasLoggedPauseRef.current) {
        hasLoggedPauseRef.current = true;
        addProctorLog(`Cognitive Pause (${thresholdSec}s inactivity)`, "#f59e0b");
      }
    }, thresholdSec * 1000);
  }, []);

  // Receive live instruction updates from the teacher; ignore empty pushes so
  // the assignment's own instruction stays visible if no live one is set.
  useEffect(() => {
    socket.on('instruction_update', (text) => { if (text) setInstruction(text); });
    return () => socket.off('instruction_update');
  }, [socket]);

  // Remember anything copied or cut anywhere inside the Verity IDE (editor, terminal, instructions, extra files)
  // so internal IDE copy-paste works smoothly, while external clipboard text is strictly blocked.
  useEffect(() => {
    const captureAnyInternalCopy = () => {
      let text = "";
      if (editorRef.current) {
        const sel = editorRef.current.getSelection();
        if (sel && !sel.isEmpty()) {
          text = editorRef.current.getModel()?.getValueInRange(sel) || "";
        }
      }
      if (!text && window.getSelection) {
        text = window.getSelection().toString() || "";
      }
      const active = document.activeElement;
      if (!text && active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && typeof active.selectionStart === 'number') {
        text = active.value.substring(active.selectionStart, active.selectionEnd) || "";
      }
      const key = normalize(text);
      if (key) copiedInternallyRef.current.add(key);
    };

    window.addEventListener('copy', captureAnyInternalCopy, true);
    window.addEventListener('cut', captureAnyInternalCopy, true);
    return () => {
      window.removeEventListener('copy', captureAnyInternalCopy, true);
      window.removeEventListener('cut', captureAnyInternalCopy, true);
    };
  }, []);

  const updateEditorMarkers = (diagnostics = []) => {
    diagnosticsRef.current = diagnostics;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
      monaco.editor.setModelMarkers(model, 'csharp-compiler', []);
      return;
    }

    const markers = diagnostics.map(d => {
      const startLine = Math.max(1, Math.min(d.startLineNumber || 1, model.getLineCount()));
      const lineContent = model.getLineContent(startLine) || '';
      const startCol = Math.max(1, Math.min(d.startColumn || 1, lineContent.length + 1));

      let endCol = d.endColumn;
      if (!endCol || endCol <= startCol) {
        const remaining = lineContent.substring(startCol - 1);
        const wordMatch = remaining.match(/^[a-zA-Z0-9_]+/);
        if (wordMatch && wordMatch[0].length > 0) {
          endCol = startCol + wordMatch[0].length;
        } else {
          endCol = Math.max(startCol + 1, lineContent.length + 1);
        }
      }

      const endLine = Math.max(startLine, Math.min(d.endLineNumber || startLine, model.getLineCount()));

      return {
        severity: d.severity === 'warning'
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Error,
        message: d.message,
        startLineNumber: startLine,
        startColumn: startCol,
        endLineNumber: endLine,
        endColumn: endCol
      };
    });

    monaco.editor.setModelMarkers(model, 'csharp-compiler', markers);
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register C# snippets and keywords in Monaco
    registerMonacoSnippets(monaco);

    if (editor) {
      editor.updateOptions({
        readOnly: submitted,
        domReadOnly: submitted
      });
    }

    if (monaco) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (!submitted) {
          handleSaveCode();
        }
      });
    }

    // Capture internal copy/cut from within Monaco editor itself
    const captureInternalCopy = () => {
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) return;
      const selectedText = editor.getModel().getValueInRange(selection);
      const key = normalize(selectedText);
      if (key) copiedInternallyRef.current.add(key);
    };

    const editorDom = editor.getDomNode();
    if (editorDom) {
      editorDom.addEventListener('copy', captureInternalCopy, true);
      editorDom.addEventListener('cut', captureInternalCopy, true);

      // ANTI-CHEAT VECTOR: Intercept DOM paste event in capture phase before text touches Monaco model
      const handleEditorDomPaste = (e) => {
        if (submitted) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
        const pastedText = e.clipboardData?.getData('text/plain') || '';
        const key = normalize(pastedText);
        if (!key) return; // Allow empty paste

        // If the text was copied internally inside the IDE, allow it
        if (copiedInternallyRef.current.has(key)) return;

        // Otherwise it originated OUTSIDE the IDE -> BLOCK IT!
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        addProctorLog("Strict Clipboard: External Paste Blocked", "#ef4444");
        if (window.electronAPI?.clearClipboard) {
          window.electronAPI.clearClipboard().catch(() => {});
        }
        return false;
      };
      editorDom.addEventListener('paste', handleEditorDomPaste, true);

      // ANTI-CHEAT VECTOR: Block dragging & dropping external text into Monaco editor
      const handleEditorDrop = (e) => {
        const droppedText = e.dataTransfer?.getData('text/plain') || '';
        const key = normalize(droppedText);
        if (key && !copiedInternallyRef.current.has(key)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          addProctorLog("Strict Clipboard: External Drop Blocked", "#ef4444");
          return false;
        }
      };
      editorDom.addEventListener('drop', handleEditorDrop, true);
      editorDom.addEventListener('dragover', (e) => {
        if (submitted) e.preventDefault();
      }, true);
    }

    // Secondary defense-in-depth: Monaco-level paste interception
    editor.onDidPaste((e) => {
      if (submitted) {
        editor.trigger('keyboard', 'undo', null);
        return;
      }
      const pastedText = editor.getModel().getValueInRange(e.range);
      const key = normalize(pastedText);
      // Pasting back something copied from inside the app is allowed
      if (!key || copiedInternallyRef.current.has(key)) return;

      // Text originated outside the IDE -> immediately undo and flag
      editor.trigger('keyboard', 'undo', null);
      addProctorLog("Strict Clipboard: External Paste Blocked", "#ef4444");
      if (window.electronAPI?.clearClipboard) {
        window.electronAPI.clearClipboard().catch(() => {});
      }
    });
  };

  // 3. TERMINAL HANDLING & COMPILER DIAGNOSTICS (Mirroring to Teacher immediately)
  useEffect(() => {
    const handleOutput = (dataChunk) => {
      console.log('[SOCKET] terminal_output received:', dataChunk?.slice(0, 50));
      setOutput((prev) => {
        const newOutput = prev + dataChunk;
        // Broadcast to teacher via cloud socket
        emitToSockets('student_terminal_update', {
          studentId: studentActualId,
          id: studentActualId,
          name: studentDisplayName,
          studentName: studentDisplayName,
          output: newOutput,
          classroomId: (classroom?.id != null ? String(classroom.id) : null) || (classroomId !== 'none' ? classroomId : null) || 'none',
          assignmentId: assignment?.id || assignmentId
        });
        return newOutput;
      });
      if (terminalEndRef.current) terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    };

    const handleStarted = () => { console.log('[SOCKET] program_started'); setProgramStarted(true); };
    const handleExit = () => {
      console.log('[SOCKET] process_exit');
      setIsRunning(false);
      setProgramStarted(false);
    };
    const handleDiagnostics = (diagnostics) => {
      updateEditorMarkers(diagnostics);
    };

    const handleTestResults = (data) => {
      const results = data?.results || [];
      setTestCases(prev => prev.map(tc => {
        const res = results.find(r => String(r.id) === String(tc.id));
        if (!res) return tc;
        return {
          ...tc,
          status: res.status,
          actualOutput: res.actualOutput !== undefined ? res.actualOutput : '',
          errorMessage: res.error || ''
        };
      }));
      setIsRunningTests(false);
    };

    const handleSingleTestResult = (res) => {
      if (!res) return;
      setTestCases(prev => prev.map(tc => {
        if (String(tc.id) === String(res.id)) {
          return {
            ...tc,
            status: res.status,
            actualOutput: res.actualOutput !== undefined ? res.actualOutput : '',
            errorMessage: res.error || ''
          };
        }
        return tc;
      }));
    };

    const handleDotnetMissing = () => {
      // Handled via compiler terminal_output message
    };

    socket.on('terminal_output', handleOutput);
    socket.on('program_started', handleStarted);
    socket.on('process_exit', handleExit);
    socket.on('compiler_diagnostics', handleDiagnostics);
    socket.on('test_cases_results', handleTestResults);
    socket.on('test_case_result', handleSingleTestResult);
    socket.on('dotnet_missing', handleDotnetMissing);

    if (localSocket) {
      localSocket.on('terminal_output', handleOutput);
      localSocket.on('program_started', handleStarted);
      localSocket.on('process_exit', handleExit);
      localSocket.on('compiler_diagnostics', handleDiagnostics);
      localSocket.on('test_cases_results', handleTestResults);
      localSocket.on('test_case_result', handleSingleTestResult);
      localSocket.on('dotnet_missing', handleDotnetMissing);
    }

    return () => {
      socket.off('terminal_output', handleOutput);
      socket.off('program_started', handleStarted);
      socket.off('process_exit', handleExit);
      socket.off('compiler_diagnostics', handleDiagnostics);
      socket.off('test_cases_results', handleTestResults);
      socket.off('test_case_result', handleSingleTestResult);
      socket.off('dotnet_missing', handleDotnetMissing);
      if (localSocket) {
        localSocket.off('terminal_output', handleOutput);
        localSocket.off('program_started', handleStarted);
        localSocket.off('process_exit', handleExit);
        localSocket.off('compiler_diagnostics', handleDiagnostics);
        localSocket.off('test_cases_results', handleTestResults);
        localSocket.off('test_case_result', handleSingleTestResult);
        localSocket.off('dotnet_missing', handleDotnetMissing);
      }
    };
  }, [socket, localSocket, safeUsername, classroom, assignment]);

  // Verify submission status with backend and keep in sync
  useEffect(() => {
    if (!assignment?.id) return;
    const aId = assignment.id;
    let cancelled = false;

    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${aId}`)
      .then(res => res.ok ? res.json() : { submissions: [] })
      .then(data => {
        if (cancelled) return;
        const subs = data?.submissions || [];
        const mySub = subs.find(s => {
          const sName = String(s.student_name || s.studentName || '').toLowerCase();
          const sId = String(s.student_id || s.studentId || '').toLowerCase();
          const targetName = String(safeUsername || '').toLowerCase();
          const targetId = String(studentId || '').toLowerCase();
          const targetEmail = String(currentUser?.email || '').toLowerCase();
          return sName === targetName || sName === targetId || sName === targetEmail ||
                 (sId && (sId === targetName || sId === targetId || sId === targetEmail));
        });
        const isSub = !!mySub;

        if (!isSub) {
          // If server responded and definitely no submission found: check local storage before clearing
          const localSub = checkLocalSubmitted();
          if (!localSub) {
            setSubmitted(false);
            getSubKeys().forEach(k => {
              try { localStorage.removeItem(k); } catch { }
            });
          }
        } else {
          setSubmitted(true);
          if (mySub.finalCode && mySub.finalCode !== codeRef.current) {
            setCode(mySub.finalCode);
            codeRef.current = mySub.finalCode;
          }
          const sHist = mySub.codeHistory || mySub.history;
          if (Array.isArray(sHist) && sHist.length > 0) {
            setCodeHistory(prev => {
              if (sHist.length > prev.length) {
                persistHistory(sHist, mySub.finalCode || codeRef.current);
                return sHist;
              }
              return prev;
            });
          }
        }
      })
      .catch(() => {
        // Fallback to local check if backend is unreachable
        setSubmitted(checkLocalSubmitted());
      });

    return () => { cancelled = true; };
  }, [assignment?.id, safeUsername, studentId, classroomId, currentUser?.email]);

  // Synchronize Monaco editor read-only mode dynamically with submitted state
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        readOnly: submitted,
        domReadOnly: submitted
      });
    }
  }, [submitted]);

  // Sync on window storage event (e.g. unsubmitted in another tab or parent screen)
  useEffect(() => {
    const handleStorage = () => {
      setSubmitted(checkLocalSubmitted());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [classroomId, assignmentId, studentId, safeUsername]);

  // Real-time unsubmit via socket
  useEffect(() => {
    if (!socket) return;
    const handleSocketUnsubmit = (data) => {
      if (!data) return;
      const targetName = String(safeUsername || '').toLowerCase();
      const targetId = String(studentId || '').toLowerCase();
      const eventName = String(data.studentName || '').toLowerCase();
      const eventId = String(data.studentId || '').toLowerCase();

      if (eventName === targetName || eventName === targetId || eventId === targetName || eventId === targetId) {
        // Retain codeHistory in state and persistent storage
        if (codeHistoryRef.current && codeHistoryRef.current.length > 0) {
          persistHistory(codeHistoryRef.current, codeRef.current);
        }
        setSubmitted(false);
        getSubKeys().forEach(k => {
          try { localStorage.removeItem(k); } catch { }
        });
      }
    };

    socket.on('student_unsubmitted', handleSocketUnsubmit);
    socket.on('teacher_student_unsubmitted', handleSocketUnsubmit);
    return () => {
      socket.off('student_unsubmitted', handleSocketUnsubmit);
      socket.off('teacher_student_unsubmitted', handleSocketUnsubmit);
    };
  }, [socket, safeUsername, studentId, classroomId, assignmentId]);

  const handleRunCode = () => {
    if (submitted) return;
    if (isDesktopWeb) {
      setBottomTab('terminal');
      setOutput("⚠️ ACCESS DENIED: Running exams in a desktop web browser is prohibited in the Computer Laboratory.\nPlease launch The Verity using The Verity.exe desktop application.\n");
      return;
    }
    if (vmDetected && kioskRules.blockVirtualMachine !== false) {
      setBottomTab('terminal');
      setOutput("⚠️ ACCESS DENIED: Exam code execution is prohibited inside a Virtual Machine.\nPlease exit and run The Verity on a physical host computer.\n");
      return;
    }
    setBottomTab('terminal');
    updateEditorMarkers([]);
    setIsRunning(true);
    setProgramStarted(false); // hide input until compilation finishes
    setOutput("");

    // Failsafe timeout
    setTimeout(() => {
        setIsRunning((current) => {
            if (current) {
                setOutput((prev) => prev + "\n[Error: Compiler server did not respond after 15 seconds.]\n");
                setProgramStarted(false);
                return false; // Force re-enable button
            }
            return current;
        });
    }, 15000);

    const targetSocket = getCompilerSocket();
    console.log('[RUN] targetSocket:', targetSocket?.id, 'connected:', targetSocket?.connected, 'localSocket:', localSocket?.id, 'appSocket:', socket?.id);
    if (!targetSocket || !targetSocket.connected) {
      setOutput("Error: No connection to compiler server. Please check your internet connection or restart the server.\n");
      setIsRunning(false);
      return;
    }

    // Tell teacher we started running
    emitToSockets('student_terminal_update', {
      studentId: safeUsername,
      output: "Compiling...\n",
      classroomId: classroom?.id,
      assignmentId: assignment?.id
    });

    const token = localStorage.getItem('verity_token') || localStorage.getItem('token');
    console.log('[RUN] emitting compile_code on socket:', targetSocket.id);
    targetSocket.emit('compile_code', {
      code: code,
      extraFiles: extraFiles.map(f => ({ name: f.name + '.cs', code: f.code })),
      token: token,
      user: currentUser
    });
  };

  const handleStopCode = () => {
    const targetSocket = getCompilerSocket();
    if (targetSocket) {
      targetSocket.emit('stop_code');
    }
    emitToSockets('student_terminal_update', {
      studentId: safeUsername,
      output: "[Process stopped by user]\n",
      classroomId: classroom?.id,
      assignmentId: assignment?.id
    });
    setIsRunning(false);
    setProgramStarted(false);
  };  const handleSubmit = () => {
    if (submitted) return;
    if (isDesktopWeb) {
      alert("Submission blocked: Desktop web browser cannot be used in the Computer Laboratory. Please launch The Verity.exe desktop application.");
      return;
    }
    if (vmDetected && kioskRules.blockVirtualMachine !== false) {
      alert("Submission is blocked: Running The Verity inside a Virtual Machine is not permitted during exams.");
      return;
    }
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = () => {
    if (submitted) return;
    setShowSubmitModal(false);

    if (isRunning) {
      handleStopCode();
    }

    setSubmitted(true);
    if (editorRef.current) {
      editorRef.current.updateOptions({
        readOnly: true,
        domReadOnly: true
      });
    }

    const aId = assignment?.id ?? 'default';
    const subHistory = codeHistoryRef.current?.length > 0 ? codeHistoryRef.current : codeHistory;
    persistHistory(subHistory, code);

    const subRecord = {
      studentName: safeUsername,
      studentId: studentId,
      assignmentId: assignment?.id ?? null,
      classroomId: classroom?.id ?? null,
      finalCode: code,
      codeHistory: subHistory,
      submittedAt: new Date().toISOString()
    };
    getSubKeys().forEach(k => {
      try { localStorage.setItem(k, JSON.stringify(subRecord)); } catch { }
    });
    if (currentUser?.id) {
      try {
        localStorage.setItem(`verity_sub_${classroomId}_${assignmentId}_id_${currentUser.id}`, JSON.stringify(subRecord));
      } catch { }
    }

    // Save to backend database
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${aId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: safeUsername,
        studentId: studentId,
        finalCode: code,
        codeHistory: subHistory,
        classroomId: classroom?.id ?? null
      })
    }).catch(() => {});

    // I-notify si teacher at tanggalin si student sa live roster
    if (socket) {
      emitToSockets('student_leave_workspace', {
        assignmentId: assignment?.id ?? aId,
        classroomId: classroom?.id,
        studentId: studentId,
        name: safeUsername,
        reason: 'submitted'
      });
      emitToSockets('submit_exam', {
        studentName: safeUsername,
        studentId: studentId,
        assignmentId: assignment?.id ?? null,
        finalCode: code,
        logs: proctorLogs,
        codeHistory: subHistory,
        classroomId: classroom?.id,
        submitted: true
      });
    }

    try {
      window.dispatchEvent(new CustomEvent('verity:submission-updated', {
        detail: {
          assignmentId: assignment?.id ?? aId,
          classroomId: classroom?.id ?? 'default',
          submitted: true
        }
      }));
    } catch {}
  };

  const handleUnsubmit = () => {
    setShowUnsubmitModal(true);
  };

  const handleConfirmUnsubmit = () => {
    setShowUnsubmitModal(false);

    // CRITICAL: Ensure codeHistory is preserved and NOT reset when unsubmitting!
    const curHist = codeHistoryRef.current?.length > 0 ? codeHistoryRef.current : codeHistory;
    persistHistory(curHist, code);

    setSubmitted(false);
    if (editorRef.current) {
      editorRef.current.updateOptions({
        readOnly: false,
        domReadOnly: false
      });
    }

    getSubKeys().forEach(k => {
      try { localStorage.removeItem(k); } catch { }
    });

    const aId = assignment?.id ?? 'default';
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${aId}/${encodeURIComponent(safeUsername)}`, {
      method: 'DELETE'
    }).catch(() => {});

    if (studentId && studentId !== safeUsername) {
      apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/submissions/${aId}/${encodeURIComponent(studentId)}`, {
        method: 'DELETE'
      }).catch(() => {});
    }

    emitToSockets('unsubmit_exam', {
      studentName: safeUsername,
      studentId: studentId,
      assignmentId: aId,
      classroomId: classroom?.id ?? 'default'
    });

    try {
      window.dispatchEvent(new CustomEvent('verity:submission-updated', {
        detail: {
          assignmentId: aId,
          classroomId: classroom?.id ?? 'default',
          submitted: false
        }
      }));
    } catch {}
  };

  const handleTerminalInput = (e) => {
    if (submitted) return;
    if (e.key === 'Enter') {
      const targetSocket = getCompilerSocket();
      targetSocket.emit('terminal_input', inputValue);
      const newOutput = output + inputValue + '\n';
      setOutput(newOutput);
      emitToSockets('student_terminal_update', {
        studentId: safeUsername,
        output: newOutput,
        classroomId: classroom?.id,
        assignmentId: assignment?.id
      });
      setInputValue("");
    }
  };

  const handleClearTerminal = () => {
    setOutput("");
    emitToSockets('student_terminal_update', {
      studentId: safeUsername,
      output: "",
      classroomId: classroom?.id,
      assignmentId: assignment?.id
    });
  };

  const renderFormattedOutput = (rawText) => {
    if (!rawText) return null;
    const lines = rawText.split('\n');
    return lines.map((line, idx) => {
      let color = isDark ? '#E8EAED' : '#1f2937';
      let fontWeight = 'normal';
      let fontStyle = 'normal';

      if (/error CS\d+/i.test(line) || /The build failed/i.test(line) || /\[Process terminated/i.test(line)) {
        color = isDark ? '#f87171' : '#dc2626'; // bright red
        fontWeight = '600';
      } else if (/warning CS\d+/i.test(line)) {
        color = isDark ? '#fbbf24' : '#d97706'; // bright amber
        fontWeight = '600';
      } else if (/Initializing compiler environment/i.test(line) || /Compiling and running/i.test(line)) {
        color = isDark ? '#38bdf8' : '#0284c7'; // bright sky blue
      } else if (/\[Process exited with code 0\]/i.test(line)) {
        color = isDark ? '#34d399' : '#059669'; // bright emerald
        fontWeight = '600';
      } else if (/\[Process exited with code/i.test(line)) {
        color = isDark ? '#f87171' : '#dc2626'; // bright red
        fontWeight = '600';
      } else if (/\[Process stopped by user\]/i.test(line)) {
        color = isDark ? '#9ca3af' : '#6b7280'; // soft gray
        fontStyle = 'italic';
      }

      return (
        <div key={idx} style={{ color, fontWeight, fontStyle, minHeight: '1.25em', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {line || ' '}
        </div>
      );
    });
  };

  const activeCase = testCases.find(tc => tc.id === activeTestCaseId) || testCases[0];
  const passedTestsCount = testCases.filter(tc => tc.status === 'passed').length;
  const hasTested = testCases.some(tc => tc.status === 'passed' || tc.status === 'failed' || tc.status === 'error');

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        ...styles.container,
        ...(isDark ? { backgroundColor: '#1e1e1e' } : {}),
        flexDirection: isMobile ? 'column' : 'row'
      }}
    >
      {/* INSTRUCTION SIDEBAR (ADJUSTABLE, RESPONSIVE, COLLAPSIBLE) */}
      {!isSandbox && (
        isInstructionCollapsed ? (
          <div style={{
          width: isMobile ? '100%' : '44px',
          height: isMobile ? '44px' : '100%',
          backgroundColor: isDark ? '#252525' : '#f1f5f9',
          borderRight: isMobile ? 'none' : (isDark ? '1px solid #3c3c3c' : '1px solid #cbd5e1'),
          borderBottom: isMobile ? (isDark ? '1px solid #3c3c3c' : '1px solid #cbd5e1') : 'none',
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: isMobile ? '0 12px' : '14px 0',
          gap: '12px',
          flexShrink: 0,
          transition: 'width 0.2s ease, height 0.2s ease',
          zIndex: 5
        }}>
          <button
            onClick={toggleInstructionCollapse}
            style={{
              background: 'transparent',
              border: isDark ? '1px solid #484848' : '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: isDark ? '#10b981' : '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? '#333333' : '#ffffff',
              transition: 'all 0.15s ease'
            }}
            title="Expand Instructions (Ctrl+B)"
          >
            {isMobile ? <ChevronDown size={16} /> : <PanelLeft size={16} />}
          </button>
          {!isMobile && (
            <div
              onClick={toggleInstructionCollapse}
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)',
                color: isDark ? '#9ca3af' : '#64748b',
                fontWeight: '600',
                fontSize: '0.82rem',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                userSelect: 'none',
                marginTop: '10px'
              }}
              title="Click to expand instruction panel"
            >
              INSTRUCTIONS
            </div>
          )}
          {isMobile && (
            <span
              onClick={toggleInstructionCollapse}
              style={{
                fontSize: '0.85rem',
                fontWeight: '600',
                color: isDark ? '#9ca3af' : '#64748b',
                cursor: 'pointer'
              }}
            >
              Show Instructions
            </span>
          )}
          {proctorLogs.length > 0 && (
            <div
              style={{
                marginTop: isMobile ? '0' : 'auto',
                marginLeft: isMobile ? 'auto' : '0',
                marginBottom: isMobile ? '0' : '12px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#eab308'
              }}
              title={`${proctorLogs.length} warning(s)`}
            />
          )}
        </div>
      ) : (
        <div style={{
          ...styles.leftSidebar,
          ...(isDark ? { backgroundColor: '#282828' } : {}),
          width: isInstructionMaximized ? '100%' : (isMobile ? '100%' : `${instructionWidth}px`),
          height: isInstructionMaximized ? '100%' : (isMobile ? `${instructionHeight}px` : '100%'),
          borderRight: isMobile ? 'none' : (isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db'),
          borderBottom: isMobile ? (isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db') : 'none',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...(isInstructionMaximized ? { zIndex: 20 } : {})
        }}>
          {/* Header with Title and Collapse Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px 10px 18px',
            borderBottom: isDark ? '1px solid #333333' : '1px solid #e5e7eb',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ color: isDark ? '#E8EAED' : '#111827', margin: 0, fontSize: '1.05rem', fontWeight: '700' }}>
                Instruction
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={toggleInstructionCollapse}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '6px',
                  color: isDark ? '#9ca3af' : '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease'
                }}
                title="Collapse Instructions (Ctrl+B)"
              >
                {isMobile ? <ChevronUp size={18} /> : <PanelLeftClose size={18} />}
              </button>
              <button
                onClick={toggleInstructionMaximize}
                title={isInstructionMaximized ? 'Restore instructions' : 'Maximize instructions'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '6px',
                  color: isDark ? '#9ca3af' : '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease'
                }}
              >
                {isInstructionMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>

          {/* Scrollable Instruction Body */}
          <div style={{
            ...styles.instructionSection,
            padding: '18px',
            ...(isDark ? { backgroundColor: '#282828' } : {})
          }}>
            {instruction ? (
              <div 
                style={{
                  ...styles.instructionText,
                  whiteSpace: 'normal',
                  ...(isDark ? { color: '#d1d5db' } : {})
                }} 
                dangerouslySetInnerHTML={{ __html: instruction }} 
                onClick={handleInstructionClick}
              />
            ) : (
              <p style={{ color: isDark ? '#888888' : '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem' }}>Waiting for instructions...</p>
            )}

            {/* In the workspace, link attachments are hidden to maintain proctoring/focus, keeping only images and videos */}
            {assignment?.attachments?.filter((att) => att.type !== 'link').length > 0 && (
              <div style={styles.attachmentList}>
                {assignment.attachments
                  .filter((att) => att.type !== 'link')
                  .map((att, i) => (
                    <AttachmentCard
                      key={i}
                      att={att}
                      isDark={isDark}
                      onClick={(clickedAtt) => {
                        if (clickedAtt.type === 'image') setPreviewImage(clickedAtt);
                        else if (clickedAtt.type === 'video') setPreviewVideo(clickedAtt);
                      }}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Resizable Divider between Instruction and Warning */}
          <div
            onMouseDown={handleWarningDividerMouseDown}
            style={{
              height: '7px',
              backgroundColor: isResizingWarning ? '#10b981' : (isDark ? '#2e2e2e' : '#e5e7eb'),
              borderTop: isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db',
              borderBottom: isDark ? '1px solid #222222' : '1px solid #e5e7eb',
              cursor: 'row-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              userSelect: 'none',
              transition: 'background-color 0.15s ease'
            }}
            title="Drag up/down to adjust Warning panel height"
          >
            <div style={{
              width: '32px',
              height: '2px',
              backgroundColor: isDark ? '#666666' : '#9ca3af',
              borderRadius: '2px'
            }} />
          </div>

          {/* Warning Section */}
          <div style={{
            ...styles.warningSection,
            height: isWarningCollapsed ? '42px' : isWarningMaximized ? '100%' : `${warningHeight}px`,
            minHeight: isWarningCollapsed ? '42px' : '70px',
            maxHeight: isWarningCollapsed ? '42px' : isWarningMaximized ? '100%' : '450px',
            padding: isWarningCollapsed ? '10px 18px' : '14px 18px',
            ...(isDark ? { backgroundColor: '#222222' } : {}),
            transition: isResizingWarning ? 'none' : 'height 0.2s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isWarningCollapsed ? 0 : '10px' }}>
              <div
                onClick={() => setIsWarningCollapsed(prev => !prev)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}
                title={isWarningCollapsed ? "Expand warnings" : "Collapse warnings"}
              >
                <span style={{ fontSize: '0.95rem', color: isDark ? '#E8EAED' : '#1f2937', fontWeight: 'bold' }}>Warnings</span>
                {proctorLogs.length > 0 && (
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    backgroundColor: '#eab308',
                    color: '#000',
                    fontWeight: 'bold'
                  }}>
                    {proctorLogs.length}
                  </span>
                )}
                {isWarningCollapsed ? <ChevronDown size={14} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronUp size={14} color={isDark ? '#9ca3af' : '#6b7280'} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {!isWarningCollapsed && (
                  <span style={{ fontSize: '0.85rem', color: isDark ? '#9ca3af' : '#6b7280', fontWeight: '600' }}>Time</span>
                )}
                <button
                  onClick={toggleWarningMaximize}
                  title={isWarningMaximized ? 'Restore' : 'Maximize warnings'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', borderRadius: '4px', display: 'flex', alignItems: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}
                  onMouseEnter={e => e.currentTarget.style.color = isDark ? '#e8eaed' : '#374151'}
                  onMouseLeave={e => e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af'}
                >
                  {isWarningMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>
            </div>
            {!isWarningCollapsed && (
              <div style={styles.logContainer}>
                {proctorLogs.length === 0 ? (
                  <span style={{ color: isDark ? '#888888' : '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem' }}>Monitoring active...</span>
                ) : (
                  proctorLogs.map(log => {
                    const isCrash = Boolean(log.isCrash || (log.action && log.action.toLowerCase().includes('crash')) || (log.message && log.message.toLowerCase().includes('crash')));
                    const text = isCrash ? 'System Crash' : log.message;
                    const textColor = isCrash ? '#dc2626' : (log.color || '#ef4444');
                    return (
                      <div
                        key={log.id}
                        style={{
                          ...styles.logRow,
                          fontSize: '0.88rem',
                          marginBottom: '8px'
                        }}
                      >
                        <span style={{ color: textColor, fontWeight: 'bold', paddingRight: '12px', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                          {text}
                        </span>
                        <span style={{ color: isDark ? '#a3a3a3' : '#6b7280', background: 'none', backgroundColor: 'transparent', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {log.time}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* DRAG HANDLE BETWEEN INSTRUCTION SIDEBAR AND MAIN AREA */}
      {!isSandbox && !isInstructionCollapsed && (
        <div
          onMouseDown={handleSidebarDividerMouseDown}
          onDoubleClick={() => setInstructionWidth(320)}
          style={{
            width: isMobile ? '100%' : '7px',
            height: isMobile ? '7px' : '100%',
            backgroundColor: isResizingSidebar ? '#10b981' : (isDark ? '#2e2e2e' : '#e2e8f0'),
            cursor: isMobile ? 'row-resize' : 'col-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            userSelect: 'none',
            zIndex: 10,
            transition: 'background-color 0.15s ease',
            borderRight: !isMobile ? (isDark ? '1px solid #3c3c3c' : '1px solid #cbd5e1') : 'none',
            borderBottom: isMobile ? (isDark ? '1px solid #3c3c3c' : '1px solid #cbd5e1') : 'none'
          }}
          title={isMobile ? "Drag up or down to adjust instruction height" : "Drag left or right to adjust instruction width (Double-click to reset)"}
        >
          <div style={{
            width: isMobile ? '36px' : '2px',
            height: isMobile ? '2px' : '36px',
            backgroundColor: isResizingSidebar ? '#ffffff' : (isDark ? '#555555' : '#9ca3af'),
            borderRadius: '2px'
          }} />
        </div>
      )}

      <div style={styles.mainArea}>
        <div style={{
          ...styles.toolbar,
          ...(isDark ? { backgroundColor: '#262626', borderBottom: '1px solid #3c3c3c' } : {})
        }}>
          <div style={styles.toolGroupLeft}>
            <button
              onClick={() => {
                if (isBackBlocked) {
                  return;
                }
                isExitingCleanlyRef.current = true;
                const cId = classroom?.id != null ? String(classroom.id) : (classroomId || 'none');
                const aId = assignment?.id != null ? String(assignment.id) : (assignmentId || 'none');
                const sId = studentActualId;
                if (socket) {
                  socket.emit('student_leave_workspace', {
                    assignmentId: aId,
                    classroomId: cId,
                    studentId: sId,
                    name: studentDisplayName
                  });
                }
                try {
                  const tabSessionId = sessionStorage.getItem('verity_tab_session_id') || '';
                  const sKey = `verity_active_session_${cId}_${aId}_${sId}`;
                  localStorage.setItem(sKey, JSON.stringify({
                    studentId: sId,
                    assignmentId: aId,
                    classroomId: cId,
                    tabId: tabSessionId,
                    lastHeartbeat: Date.now(),
                    cleanExit: true
                  }));
                } catch (_) {}
                onBack();
              }}
              disabled={isBackBlocked}
              title={isBackBlocked ? "Workspace exit is locked until submitted" : "Back"}
              style={{
                ...styles.backButton,
                ...(isDark ? { backgroundColor: '#333333', borderColor: '#484848', color: '#E8EAED' } : {}),
                ...(isBackBlocked ? { opacity: 0.4, cursor: 'not-allowed' } : {})
              }}
            >
              {isBackBlocked ? <Lock size={15} /> : <ArrowLeft size={18} />} Back
            </button>
            <button
              onClick={handleSaveCode}
              disabled={submitted}
              style={{
                ...styles.iconButton,
                ...(isDark ? { backgroundColor: '#333333', borderColor: '#484848', color: '#E8EAED' } : {}),
                ...(submitted ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                ...(saveStatus ? styles.iconButtonSaved : {})
              }}
              title={submitted ? "Workspace is locked — saving is disabled" : "Save draft (Ctrl+S)"}
            >
              {saveStatus ? (
                <>
                  <Check size={18} color="#059669" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#059669', marginLeft: '4px' }}>Saved</span>
                </>
              ) : (
                <Save size={18} />
              )}
            </button>
            <button 
              onClick={handleRunCode} 
              disabled={isRunning || isRunningTests || submitted}
              style={{ 
                ...styles.runButton, 
                ...(isDark ? { backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' } : {}),
                opacity: (isRunning || isRunningTests || submitted) ? 0.45 : 1,
                cursor: (isRunning || isRunningTests || submitted) ? 'not-allowed' : 'pointer'
              }}
              title={submitted ? "Workspace is locked — execution is disabled" : "Run code"}
            >
              <Play size={16} fill="currentColor" /> Run
            </button>
            <button onClick={handleStopCode} disabled={!isRunning || submitted} style={{ ...styles.stopButton, ...(isDark ? { backgroundColor: 'rgba(248, 113, 113, 0.15)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)' } : {}), opacity: (isRunning && !submitted) ? 1 : 0.45, cursor: (isRunning && !submitted) ? 'pointer' : 'not-allowed' }}><Square size={14} fill="currentColor" /> Stop</button>

            {strictCompiler && (
              <div
                style={{
                  ...styles.strictBadge,
                  ...(isDark ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' } : {})
                }}
                title="Strict Compiler Mode: Compiler warnings are treated as errors and will block execution."
              >
                <AlertTriangle size={13} style={{ marginRight: '5px', flexShrink: 0 }} />
                <span>Strict: Warnings = Errors</span>
              </div>
            )}
          </div>

          <div style={styles.toolGroupRight}>
            {!isSandbox && (
              submitted ? (
                <button
                  onClick={handleUnsubmit}
                  style={{
                    ...styles.unsubmitBtn,
                    ...(isDark ? { backgroundColor: '#333333', borderColor: '#484848', color: '#E8EAED' } : {})
                  }}
                  title="Unsubmit to edit and re-submit your code"
                >
                  Unsubmit
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  style={{
                    ...styles.submitButton,
                    ...(isDark ? { backgroundColor: 'rgba(34, 211, 238, 0.15)', color: '#22d3ee', border: '1px solid rgba(34, 211, 238, 0.3)' } : {})
                  }}
                >
                  Submit
                </button>
              )
            )}
            {!isSandbox && (
              <div
                className="recording-dot-blink"
                style={styles.recordingDot}
                title="Recording active: Your workspace activity is being recorded and proctored"
              />
            )}
            <button
              onClick={() => setShowSettingsModal(true)}
              style={styles.gearIcon}
              title="Settings"
            >
              <Settings size={22} color={isDark ? '#d4d4d4' : '#6b7280'} />
            </button>
          </div>
        </div>

        <div style={styles.editorWrapper}>
          {/* ── File Tabs ────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            height: '28px',
            backgroundColor: isDark ? '#252526' : '#f3f4f6',
            borderBottom: isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db',
            overflowX: 'auto',
            flexShrink: 0,
            userSelect: 'none',
          }}>
            {/* Program.cs (main) tab */}
            <div
              onClick={() => setActiveFileId('main')}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '0 10px', height: '100%', cursor: 'pointer',
                borderRight: isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db',
                backgroundColor: activeFileId === 'main'
                  ? (isDark ? '#1e1e1e' : '#ffffff')
                  : 'transparent',
                color: activeFileId === 'main'
                  ? (isDark ? '#e8eaed' : '#111827')
                  : (isDark ? '#9ca3af' : '#6b7280'),
                fontSize: '0.75rem', fontWeight: activeFileId === 'main' ? '600' : '400',
                borderBottom: activeFileId === 'main' ? '2px solid #10b981' : '2px solid transparent',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{'{ }'}</span>
              Program.cs
            </div>

            {/* Extra file tabs */}
            {extraFiles.map(f => (
              <div
                key={f.id}
                onDoubleClick={() => { if (!submitted) { setRenamingFileId(f.id); setRenameValue(f.name); } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '3px',
                  padding: '0 6px 0 10px', height: '100%',
                  borderRight: isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db',
                  backgroundColor: activeFileId === f.id
                    ? (isDark ? '#1e1e1e' : '#ffffff')
                    : 'transparent',
                  color: activeFileId === f.id
                    ? (isDark ? '#e8eaed' : '#111827')
                    : (isDark ? '#9ca3af' : '#6b7280'),
                  fontSize: '0.75rem', fontWeight: activeFileId === f.id ? '600' : '400',
                  borderBottom: activeFileId === f.id ? '2px solid #10b981' : '2px solid transparent',
                  whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
                }}
              >
                {renamingFileId === f.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameFile(f.id, renameValue)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameFile(f.id, renameValue);
                      if (e.key === 'Escape') setRenamingFileId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      width: '80px', fontSize: '0.75rem', padding: '1px 4px',
                      border: '1px solid #10b981', borderRadius: '3px', outline: 'none',
                      backgroundColor: isDark ? '#333' : '#fff',
                      color: isDark ? '#e8eaed' : '#111827',
                    }}
                  />
                ) : (
                  <span
                    onClick={() => setActiveFileId(f.id)}
                    title="Double-click to rename"
                  >
                    <span style={{ fontSize: '0.65rem', opacity: 0.6, marginRight: '3px' }}>{'{ }'}</span>
                    {f.name}.cs
                  </span>
                )}
                {!submitted && renamingFileId !== f.id && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteFile(f.id); }}
                    title="Delete file"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '1px', display: 'flex', alignItems: 'center',
                      color: isDark ? '#555' : '#bbb',
                      marginLeft: '1px', borderRadius: '2px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = isDark ? '#555' : '#bbb'}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}

            {/* Add file button */}
            {!submitted && (
              <button
                onClick={handleAddFile}
                title="Add new file"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0 10px', height: '100%',
                  display: 'flex', alignItems: 'center',
                  color: isDark ? '#6b7280' : '#9ca3af',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#10b981'; e.currentTarget.style.backgroundColor = isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Plus size={13} />
              </button>
            )}
          </div>

          {/* ── Monaco Editor ──────────────────────────────────── */}
          <div style={{ flex: 1, minHeight: 0, pointerEvents: isResizingTerminal ? 'none' : 'auto' }}>
          <Editor
            height="100%"
            language="csharp"
            theme={isDark ? "vs-dark" : "light"}
            value={activeCode}
            onChange={(newCode) => {
              if (submitted) {
                if (editorRef.current && editorRef.current.getValue() !== activeCode) {
                  editorRef.current.setValue(activeCode);
                }
                return;
              }
              resetCognitivePauseTimer();
              if (activeFileId === 'main') {
                if (diagnosticsRef.current?.length > 0) updateEditorMarkers([]);
                setCode(newCode);
                codeRef.current = newCode;
                try {
                  localStorage.setItem(draftKey, newCode);
                  if (studentId !== safeUsername) {
                    localStorage.setItem(`verity_code_${assignmentId}_${safeUsername}`, newCode);
                  }
                } catch { /* ignore */ }
                const newEntry = { time: Date.now(), code: newCode };
                setCodeHistory(prev => {
                  const nextHist = [...prev, newEntry];
                  persistHistory(nextHist, newCode);
                  return nextHist;
                });
                emitToSockets('student_typing', {
                  studentId: studentActualId,
                  id: studentActualId,
                  name: studentDisplayName,
                  studentName: studentDisplayName,
                  email: currentUser?.email || '',
                  avatar: currentUser?.avatar || '',
                  code: newCode,
                  classroomId: (classroom?.id != null ? String(classroom.id) : null) || (classroomId !== 'none' ? classroomId : null) || 'none',
                  assignmentId: assignment?.id || assignmentId,
                  logs: proctorLogsRef.current || proctorLogs
                });
              } else {
                handleExtraFileCodeChange(activeFileId, newCode);
              }
            }}
            onMount={handleEditorDidMount}
            options={{
              fontSize: editorFontSize,
              minimap: { enabled: false },
              readOnly: submitted,
              domReadOnly: submitted,
              readOnlyMessage: { value: 'Work submitted — editing is disabled.' },
              contextmenu: !submitted,
              // Monaco Snippets & IntelliSense
              snippetSuggestions: 'top',
              tabCompletion: 'on',
              quickSuggestions: { other: true, comments: false, strings: false },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'on',
              wordBasedSuggestions: 'currentDocument',
              suggest: {
                snippetsPreventQuickSuggestions: false,
                localityBonus: true,
                showSnippets: true,
                showWords: true,
                showKeywords: true
              },
              // Anti-cheat protections
              dragAndDrop: false,
              dropIntoEditor: { enabled: false }
            }}
          />
          </div>
        </div>

        {isResizingTerminal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              cursor: 'row-resize',
              userSelect: 'none'
            }}
          />
        )}

        <div
          style={{
            ...styles.resizeHandle,
            height: '10px',
            position: 'relative',
            zIndex: 15,
            cursor: 'row-resize',
            touchAction: 'none',
            backgroundColor: isResizingTerminal ? '#10b981' : (isDark ? '#262626' : '#e5e7eb'),
            borderTop: isResizingTerminal ? '1px solid #10b981' : (isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db'),
            borderBottom: isResizingTerminal ? '1px solid #10b981' : (isDark ? '1px solid #262626' : '1px solid #e5e7eb'),
            boxShadow: isResizingTerminal ? '0 0 10px rgba(16, 185, 129, 0.45)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
          }}
          onMouseDown={handleDividerMouseDown}
          onTouchStart={handleDividerMouseDown}
          title="Drag up or down to resize terminal"
        >
          <div style={{
            ...styles.resizeHandleGrip,
            width: '48px',
            height: '4px',
            borderRadius: '4px',
            backgroundColor: isResizingTerminal ? '#ffffff' : (isDark ? '#555555' : '#9ca3af')
          }} />
        </div>

        <div style={{
          ...styles.terminalWrapper,
          height: isTerminalCollapsed ? '38px' : isTerminalMaximized ? '100%' : `${terminalHeight}px`,
          minHeight: isTerminalCollapsed ? '38px' : '60px',
          transition: isResizingTerminal ? 'none' : 'height 0.15s ease',
          ...(isTerminalMaximized ? { flex: 1 } : {}),
          ...(isDark ? { backgroundColor: '#1e1e1e', borderTop: '1px solid #3c3c3c' } : {})
        }}>
          {/* TABS HEADER: TERMINAL vs TEST CASES */}
          <div
            onMouseDown={(e) => {
              if (e.target.closest('button') || e.target.closest('input')) return;
              handleDividerMouseDown(e);
            }}
            onTouchStart={(e) => {
              if (e.target.closest('button') || e.target.closest('input')) return;
              handleDividerMouseDown(e);
            }}
            onDoubleClick={toggleTerminalCollapse}
            style={{
              ...styles.terminalHeader,
              cursor: 'row-resize',
              ...(isDark ? { backgroundColor: '#262626', borderBottom: '1px solid #3c3c3c' } : {})
            }}
            title="Drag up or down to resize, double-click to toggle"
          >
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <button
                type="button"
                onClick={() => setBottomTab('terminal')}
                style={{
                  ...styles.tabHeaderBtn,
                  backgroundColor: bottomTab === 'terminal' ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
                  color: bottomTab === 'terminal' ? (isDark ? '#10b981' : '#059669') : (isDark ? '#9ca3af' : '#6b7280'),
                  borderBottom: bottomTab === 'terminal' ? '2px solid #10b981' : '2px solid transparent',
                  fontWeight: bottomTab === 'terminal' ? '700' : '500'
                }}
              >
                <TerminalSquare size={15} />
                <span>TERMINAL</span>
              </button>

              <button
                type="button"
                onClick={() => setBottomTab('testcases')}
                style={{
                  ...styles.tabHeaderBtn,
                  backgroundColor: bottomTab === 'testcases' ? (isDark ? '#1e1e1e' : '#ffffff') : 'transparent',
                  color: bottomTab === 'testcases' ? (isDark ? '#10b981' : '#059669') : (isDark ? '#9ca3af' : '#6b7280'),
                  borderBottom: bottomTab === 'testcases' ? '2px solid #10b981' : '2px solid transparent',
                  fontWeight: bottomTab === 'testcases' ? '700' : '500'
                }}
              >
                <CheckSquare size={15} />
                <span>TEST CASES</span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: (hasTested && passedTestsCount === testCases.length && testCases.length > 0)
                    ? '#10b981'
                    : (testCases.some(t => t.status === 'failed') ? '#ef4444' : (isDark ? '#374151' : '#e5e7eb')),
                  color: (hasTested || testCases.some(t => t.status === 'failed')) ? '#ffffff' : (isDark ? '#d1d5db' : '#4b5563'),
                  fontWeight: 'bold',
                  marginLeft: '4px'
                }}>
                  {hasTested ? `${passedTestsCount}/${testCases.length}` : testCases.length}
                </span>
              </button>
            </div>

              {/* ACTION CONTROLS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {bottomTab === 'terminal' ? (
                <button
                  type="button"
                  onClick={handleClearTerminal}
                  style={{
                    ...styles.terminalActionBtn,
                    ...(isDark ? { backgroundColor: '#333333', borderColor: '#484848', color: '#E8EAED' } : {})
                  }}
                  title="Clear Terminal Output"
                >
                  <Trash2 size={13} style={{ marginRight: '4px' }} />
                  <span>Clear</span>
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleAddTestCase}
                    disabled={submitted}
                    style={{
                      ...styles.terminalActionBtn,
                      backgroundColor: isDark ? '#1e1e1e' : '#f0fdf4',
                      borderColor: isDark ? '#10b981' : '#bbf7d0',
                      color: isDark ? '#10b981' : '#16a34a',
                      fontWeight: '600',
                      opacity: submitted ? 0.5 : 1,
                      cursor: submitted ? 'not-allowed' : 'pointer'
                    }}
                    title={submitted ? "Disabled after submission" : "Add a new test case"}
                  >
                    <Plus size={13} style={{ marginRight: '3px' }} />
                    <span>Add Test Case</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunTestCase()}
                    disabled={isRunningTests || isRunning || submitted}
                    style={{
                      ...styles.terminalActionBtn,
                      backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : '#ecfdf5',
                      borderColor: isDark ? 'rgba(52, 211, 153, 0.3)' : '#10b981',
                      color: isDark ? '#34d399' : '#065f46',
                      fontWeight: '600',
                      opacity: (isRunningTests || isRunning || submitted) ? 0.45 : 1,
                      cursor: (isRunningTests || isRunning || submitted) ? 'not-allowed' : 'pointer'
                    }}
                    title={submitted ? "Disabled after submission" : "Run selected test case"}
                  >
                    <Play size={11} fill="currentColor" style={{ marginRight: '4px' }} />
                    <span>Run Case</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRunAllTestCases}
                    disabled={isRunningTests || isRunning || submitted}
                    style={{
                      ...styles.terminalActionBtn,
                      backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : '#10b981',
                      borderColor: isDark ? 'rgba(52, 211, 153, 0.3)' : '#10b981',
                      color: isDark ? '#34d399' : '#ffffff',
                      fontWeight: '700',
                      opacity: (isRunningTests || isRunning || submitted) ? 0.45 : 1,
                      cursor: (isRunningTests || isRunning || submitted) ? 'not-allowed' : 'pointer'
                    }}
                    title={submitted ? "Disabled after submission" : "Run all test cases"}
                  >
                    <PlayCircle size={13} style={{ marginRight: '4px' }} />
                    <span>Run All</span>
                  </button>
                </div>
              )}

              {/* Hide / Maximize panel buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '6px', borderLeft: isDark ? '1px solid #3c3c3c' : '1px solid #e5e7eb', paddingLeft: '8px' }}>
                <button
                  type="button"
                  onClick={toggleTerminalMaximize}
                  title={isTerminalMaximized ? 'Restore panel' : 'Maximize panel'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}
                  onMouseEnter={e => e.currentTarget.style.color = isDark ? '#e8eaed' : '#374151'}
                  onMouseLeave={e => e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af'}
                >
                  {isTerminalMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
                <button
                  type="button"
                  onClick={toggleTerminalCollapse}
                  title={isTerminalCollapsed ? 'Show panel' : 'Hide panel'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}
                  onMouseEnter={e => e.currentTarget.style.color = isDark ? '#e8eaed' : '#374151'}
                  onMouseLeave={e => e.currentTarget.style.color = isDark ? '#6b7280' : '#9ca3af'}
                >
                  {isTerminalCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>
          </div>

          {/* TAB CONTENT */}
          {bottomTab === 'terminal' ? (
            <div ref={terminalBodyRef} style={{
              ...styles.terminalBody,
              ...(isDark ? { backgroundColor: '#1e1e1e', color: '#E8EAED' } : {})
            }}>
              {renderFormattedOutput(output)}
              {isRunning && programStarted && (
                <div style={{
                  ...styles.terminalInputRow,
                  ...(isDark ? { backgroundColor: '#252525', borderColor: '#3c3c3c' } : {})
                }}>
                  <span style={{ marginRight: '8px', color: submitted ? '#9ca3af' : '#10b981', fontWeight: 'bold' }}>{'>'}</span>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleTerminalInput}
                    onPaste={(e) => {
                      const pasted = e.clipboardData?.getData('text/plain') || '';
                      const key = normalize(pasted);
                      if (key && !copiedInternallyRef.current.has(key)) {
                        e.preventDefault();
                        e.stopPropagation();
                        addProctorLog("Strict Clipboard: External Paste in Terminal Blocked", "#ef4444");
                        if (window.electronAPI?.clearClipboard) {
                          window.electronAPI.clearClipboard().catch(() => {});
                        }
                      }
                    }}
                    autoFocus={!submitted}
                    disabled={submitted}
                    style={{
                      ...styles.terminalInput,
                      ...(isDark ? { color: '#E8EAED' } : {}),
                      ...(submitted ? { opacity: 0.6, cursor: 'not-allowed' } : {})
                    }}
                    placeholder={submitted ? "Workspace is locked — execution is disabled" : "Type input here and press Enter..."}
                  />
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
              overflow: 'hidden',
              minHeight: 0
            }}>
              {/* Test Case Tabs Ribbon */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 12px',
                borderBottom: isDark ? '1px solid #2e2e2e' : '1px solid #e5e7eb',
                backgroundColor: isDark ? '#222222' : '#f9fafb',
                gap: '6px',
                overflowX: 'auto',
                flexShrink: 0
              }}>
                {testCases.map((tc, idx) => {
                  const isActive = tc.id === activeTestCaseId;
                  return (
                    <button
                      key={tc.id}
                      type="button"
                      onClick={() => setActiveTestCaseId(tc.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: isActive
                          ? (isDark ? '1px solid #10b981' : '1px solid #059669')
                          : (isDark ? '1px solid #383838' : '1px solid #d1d5db'),
                        backgroundColor: isActive
                          ? (isDark ? '#064e3b' : '#ecfdf5')
                          : (isDark ? '#2a2a2a' : '#ffffff'),
                        color: isActive
                          ? (isDark ? '#6ee7b7' : '#065f46')
                          : (isDark ? '#d1d5db' : '#4b5563'),
                        fontSize: '0.8rem',
                        fontWeight: isActive ? '700' : '500',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tc.status === 'running' && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                      {tc.status === 'passed' && <CheckCircle2 size={13} color="#10b981" />}
                      {tc.status === 'failed' && <XCircle size={13} color="#ef4444" />}
                      {tc.status === 'error' && <AlertTriangle size={13} color="#f59e0b" />}
                      {tc.status === 'idle' && (
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isDark ? '#6b7280' : '#9ca3af' }} />
                      )}
                      <span>{tc.name || `Case ${idx + 1}`}</span>

                      {testCases.length > 1 && (
                        <span
                          onClick={(e) => handleDeleteTestCase(tc.id, e)}
                          title="Delete this test case"
                          style={{
                            marginLeft: '4px',
                            color: isDark ? '#9ca3af' : '#9ca3af',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            borderRadius: '3px',
                            padding: '1px'
                          }}
                        >
                          <X size={12} />
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={handleAddTestCase}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: isDark ? '1px dashed #4b5563' : '1px dashed #9ca3af',
                    backgroundColor: 'transparent',
                    color: isDark ? '#9ca3af' : '#6b7280',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                  title="Add a new test case"
                >
                  <Plus size={13} />
                  <span>Add Case</span>
                </button>
              </div>

              {/* Active Case Form & Details */}
              {activeCase && (
                <div style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                  padding: '12px 14px',
                  overflowY: 'auto'
                }}>


                  {/* Column 2: Expected Output */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: '700', color: isDark ? '#9ca3af' : '#4b5563', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Expected Output
                      </label>
                    </div>
                    <textarea
                      value={activeCase.expectedOutput || ''}
                      onChange={(e) => handleUpdateTestCase(activeCase.id, 'expectedOutput', e.target.value)}
                      disabled={submitted}
                      placeholder={submitted ? "Expected output (read only)" : "Expected output from your code..."}
                      style={{
                        flex: 1,
                        minHeight: '75px',
                        padding: '8px 10px',
                        backgroundColor: isDark ? '#242424' : '#f9fafb',
                        color: isDark ? '#E8EAED' : '#111827',
                        border: isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontFamily: "Consolas, 'Cascadia Code', monospace",
                        fontSize: '0.85rem',
                        resize: 'none',
                        outline: 'none',
                        opacity: submitted ? 0.7 : 1,
                        cursor: submitted ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>

                  {/* Column 3: Actual Output & Result Status */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: '700', color: isDark ? '#9ca3af' : '#4b5563', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Actual Output
                      </label>
                      {activeCase.status === 'passed' && (
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={13} /> Passed
                        </span>
                      )}
                      {activeCase.status === 'failed' && (
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={13} /> Failed
                        </span>
                      )}
                      {activeCase.status === 'error' && (
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={13} /> Error
                        </span>
                      )}
                      {activeCase.status === 'running' && (
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Running...
                        </span>
                      )}
                      {activeCase.status === 'idle' && (
                        <span style={{ fontSize: '0.72rem', color: isDark ? '#6b7280' : '#9ca3af' }}>Not run yet</span>
                      )}
                    </div>
                    <div style={{
                      flex: 1,
                      minHeight: '75px',
                      padding: '8px 10px',
                      backgroundColor: activeCase.status === 'passed'
                        ? (isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4')
                        : (activeCase.status === 'failed' ? (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2') : (isDark ? '#242424' : '#f9fafb')),
                      border: activeCase.status === 'passed'
                        ? '1px solid #10b981'
                        : (activeCase.status === 'failed' ? '1px solid #ef4444' : (isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db')),
                      borderRadius: '6px',
                      fontFamily: "Consolas, 'Cascadia Code', monospace",
                      fontSize: '0.85rem',
                      color: activeCase.errorMessage ? '#ef4444' : (isDark ? '#E8EAED' : '#111827'),
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {activeCase.status === 'running' ? (
                        <span style={{ color: '#3b82f6', fontStyle: 'italic' }}>Executing test case...</span>
                      ) : (activeCase.errorMessage ? (
                        <span style={{ color: '#ef4444' }}>{activeCase.errorMessage}</span>
                      ) : (activeCase.actualOutput ? (
                        activeCase.actualOutput
                      ) : (
                        <span style={{ color: isDark ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>
                          {activeCase.status === 'passed' ? '[Empty output produced]' : 'Click "Run Case" or "Run All" to execute test.'}
                        </span>
                      )))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            style={{
              backgroundColor: isDark ? '#2c2c2c' : '#ffffff',
              color: isDark ? '#E8EAED' : '#1e293b',
              borderRadius: '20px',
              padding: '28px',
              width: '90%',
              maxWidth: '460px',
              boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
              border: isDark ? '1px solid #484848' : '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Settings size={22} color={isDark ? '#10b981' : '#0284c7'} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Workspace Settings</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: isDark ? '#a3a3a3' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '6px',
                }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                borderRadius: '14px',
                backgroundColor: isDark ? '#222222' : '#f8fafc',
                border: isDark ? '1px solid #3c3c3c' : '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isDark ? <Moon size={22} color="#10b981" /> : <Sun size={22} color="#f59e0b" />}
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: isDark ? '#a3a3a3' : '#64748b', marginTop: '2px' }}>
                    {isDark ? 'Dark theme active' : 'Light theme active'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isDark}
                onClick={toggleDarkMode}
                style={{
                  position: 'relative',
                  width: '50px',
                  height: '28px',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: isDark ? '#10b981' : '#cbd5e1',
                  transition: 'background-color 0.25s ease',
                  padding: 0,
                  flexShrink: 0,
                }}
                title="Toggle Dark Mode"
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: isDark ? '25px' : '3px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transition: 'left 0.25s ease',
                  }}
                />
              </button>
            </div>

            {/* Font Size Selector */}
            <div
              style={{
                padding: '16px',
                borderRadius: '14px',
                backgroundColor: isDark ? '#222222' : '#f8fafc',
                border: isDark ? '1px solid #3c3c3c' : '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Editor Font Size</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#10b981' }}>{editorFontSize}px</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[13, 14, 16, 18, 20].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => {
                      setEditorFontSize(sz);
                      try { localStorage.setItem('verity_editor_font_size', String(sz)); } catch {}
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: '8px',
                      border: `1px solid ${editorFontSize === sz ? '#10b981' : (isDark ? '#484848' : '#cbd5e1')}`,
                      backgroundColor: editorFontSize === sz ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#333333' : '#ffffff'),
                      color: editorFontSize === sz ? '#10b981' : (isDark ? '#E8EAED' : '#475569'),
                      fontWeight: editorFontSize === sz ? '700' : '500',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            </div>

            {/* Done Button */}
            <button
              onClick={() => setShowSettingsModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {previewImage && (
        <ImagePreviewModal
          src={previewImage.url}
          alt={previewImage.name}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {previewVideo && (
        <VideoPreviewModal
          src={previewVideo.url}
          name={previewVideo.name}
          onClose={() => setPreviewVideo(null)}
        />
      )}

      {previewIframe && (
        <IframePreviewModal
          url={previewIframe.url}
          title={previewIframe.name}
          type={previewIframe.type}
          onClose={() => setPreviewIframe(null)}
        />
      )}

      {/* SUBMIT CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowSubmitModal(false)}
        >
          <div
            style={{
              backgroundColor: isDark ? '#242424' : '#ffffff',
              color: isDark ? '#E8EAED' : '#1e293b',
              borderRadius: '18px',
              padding: '24px 28px',
              width: '90%',
              maxWidth: '460px',
              boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: isDark ? '1px solid #3d3d3d' : '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: strictCompiler && diagnosticsRef.current?.length > 0
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {strictCompiler && diagnosticsRef.current?.length > 0 ? (
                    <AlertTriangle size={22} color="#f59e0b" />
                  ) : (
                    <CheckCircle2 size={22} color="#10b981" />
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: isDark ? '#f3f4f6' : '#0f172a' }}>
                    Submit Activity
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#9ca3af' : '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {strictCompiler && diagnosticsRef.current?.length > 0 ? (
              <div
                style={{
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                  border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  color: isDark ? '#fcd34d' : '#92400e',
                }}
              >
                <strong>Notice:</strong> Strict compiler mode is active and your code currently has compiler errors/warnings. Are you sure you want to submit anyway?
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: isDark ? '#d1d5db' : '#334155' }}>
                Are you ready to submit your work?
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #4b5563' : '1px solid #cbd5e1',
                  backgroundColor: 'transparent',
                  color: isDark ? '#d1d5db' : '#475569',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Check size={16} />
                Submit Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNSUBMIT CONFIRMATION MODAL */}
      {showUnsubmitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowUnsubmitModal(false)}
        >
          <div
            style={{
              backgroundColor: isDark ? '#242424' : '#ffffff',
              color: isDark ? '#E8EAED' : '#1e293b',
              borderRadius: '18px',
              padding: '24px 28px',
              width: '90%',
              maxWidth: '460px',
              boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: isDark ? '1px solid #3d3d3d' : '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ArrowLeft size={20} color="#3b82f6" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: isDark ? '#f3f4f6' : '#0f172a' }}>
                    Unsubmit Activity
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#64748b', marginTop: '2px' }}>
                    {assignment?.title || 'Classroom Activity'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnsubmitModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#9ca3af' : '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: isDark ? '#d1d5db' : '#334155' }}>
              Are you sure you want to unsubmit? This will unlock your workspace so you can continue editing, compiling, and re-submitting your code.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowUnsubmitModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #4b5563' : '1px solid #cbd5e1',
                  backgroundColor: 'transparent',
                  color: isDark ? '#d1d5db' : '#475569',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUnsubmit}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                Confirm Unsubmit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MULTIPLE MONITORS MODAL */}
      {multiMonitorDetected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998, backgroundColor: 'rgba(15, 23, 42, 0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff', padding: '30px', textAlign: 'center' }}>
          <div style={{ width: '76px', height: '76px', borderRadius: '22px', backgroundColor: 'rgba(217, 119, 6, 0.18)', border: '1px solid rgba(217, 119, 6, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 8px 25px rgba(217, 119, 6, 0.25)' }}>
            <Monitor size={38} color="#fbbf24" strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '12px', color: '#fbbf24' }}>Multiple Displays Detected</h2>
          <p style={{ fontSize: '1rem', maxWidth: '480px', color: '#cbd5e1', lineHeight: 1.5 }}>
            Verity Kiosk Enforcement policy requires a single active monitor during exams. Please disconnect secondary monitors to continue.
          </p>
        </div>
      )}

      {/* VIRTUAL MACHINE DETECTED BLOCKING MODAL */}
      {vmDetected && kioskRules.blockVirtualMachine !== false && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(15, 23, 42, 0.96)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff', padding: '30px', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'rgba(220, 38, 38, 0.18)', border: '1px solid rgba(220, 38, 38, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 8px 30px rgba(220, 38, 38, 0.35)' }}>
            <ShieldAlert size={42} color="#f87171" strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '12px', color: '#f87171' }}>Virtual Machine Detected — Exam Blocked</h2>
          <p style={{ fontSize: '1.05rem', maxWidth: '580px', color: '#e2e8f0', lineHeight: 1.6, marginBottom: '20px' }}>
            The Verity Exam Integrity System has detected that this session is running inside a <strong>Virtual Machine (VM)</strong>. Taking exams or executing code within virtualized environments is strictly prohibited.
          </p>
          {vmReasons.length > 0 && (
            <div style={{ maxWidth: '580px', width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(248, 113, 113, 0.3)', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fca5a5', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Hardware & Driver Indicators:
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                {vmReasons.slice(0, 4).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={() => {
              if (typeof onBack === 'function') onBack();
            }}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#b91c1c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; }}
          >
            Exit Exam Workspace
          </button>
        </div>
      )}

      {/* DESKTOP WEB BROWSER BLOCKING MODAL */}
      {isDesktopWeb && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(15, 23, 42, 0.96)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff', padding: '30px', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'rgba(220, 38, 38, 0.18)', border: '1px solid rgba(220, 38, 38, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 8px 30px rgba(220, 38, 38, 0.35)' }}>
            <MonitorX size={42} color="#f87171" strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '12px', color: '#f87171' }}>The Verity.exe Desktop Application Required</h2>
          <p style={{ fontSize: '1.05rem', maxWidth: '580px', color: '#e2e8f0', lineHeight: 1.6, marginBottom: '20px' }}>
            Taking exams or executing code in a standard desktop web browser is strictly prohibited in the Computer Laboratory. All laboratory and desktop computer examinations must be conducted through the official <strong>The Verity.exe</strong> desktop application for kiosk lockdown and exam security.
          </p>
          <button
            onClick={() => {
              if (typeof onBack === 'function') onBack();
            }}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#b91c1c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; }}
          >
            Exit Exam Workspace
          </button>
        </div>
      )}
    </motion.div>
  );
}

const styles = {
  container: { height: '100vh', width: '100%', display: 'flex', fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: '#e5e7eb', overflow: 'hidden' },
  leftSidebar: { height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #d1d5db', backgroundColor: '#f3f4f6', flexShrink: 0, minWidth: 0, overflow: 'hidden' },
  instructionSection: { flex: 1, minHeight: 0, padding: '20px', backgroundColor: '#f3f4f6', overflowY: 'auto' },
  instructionText: { color: '#1f2937', fontSize: '1rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 },
  attachmentList: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px', width: '100%' },
  attachThumb: { maxWidth: '100%', maxHeight: '120px', borderRadius: '8px', objectFit: 'cover', display: 'block' },
  attachVideo: { maxWidth: '100%', maxHeight: '140px', borderRadius: '8px', backgroundColor: '#000' },
  attachLink: { 
    display: 'inline-flex', 
    alignItems: 'center', 
    gap: '8px',
    color: '#059669', 
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '8px 14px',
    textDecoration: 'none', 
    fontSize: '0.88rem', 
    fontWeight: '500',
    maxWidth: '100%',
    wordBreak: 'break-all',
    boxSizing: 'border-box'
  },
  greyPill: { height: '30px', backgroundColor: '#d1d5db', borderRadius: '50px', marginBottom: '15px', boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.1)' },
  warningSection: { backgroundColor: '#f9fafb', padding: '16px 20px', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' },
  logContainer: { overflowY: 'auto', flex: 1, paddingRight: '5px' },
  logRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.95rem' },
  mainArea: { flex: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  toolbar: { height: '60px', minHeight: '60px', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid #d1d5db', flexShrink: 0 },
  toolGroupLeft: { display: 'flex', gap: '10px', alignItems: 'center' },
  backButton: { padding: '8px 16px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', color: '#4b5563', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' },
  iconButton: { padding: '8px 12px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', color: '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' },
  iconButtonSaved: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', color: '#059669' },
  runButton: { padding: '8px 20px', backgroundColor: '#34d399', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' },
  stopButton: { padding: '8px 20px', backgroundColor: '#f87171', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' },
  strictBadge: { display: 'inline-flex', alignItems: 'center', padding: '6px 11px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '5px', color: '#b45309', fontSize: '0.78rem', fontWeight: 'bold', userSelect: 'none' },
  toolGroupRight: { display: 'flex', gap: '15px', alignItems: 'center' },
  submitButton: { padding: '8px 20px', backgroundColor: '#22d3ee', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
  unsubmitBtn: { padding: '8px 20px', backgroundColor: 'white', color: '#475569', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', transition: 'all 0.15s ease' },
  recordingDot: { width: '12px', height: '12px', backgroundColor: '#dc2626', borderRadius: '50%', boxShadow: '0 0 8px rgba(220, 38, 38, 0.8)' },
  gearIcon: { backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' },
  editorWrapper: { flex: 1, minHeight: 0, backgroundColor: '#1e1e1e', position: 'relative', display: 'flex', flexDirection: 'column' },
  resizeHandle: {
    height: '6px',
    backgroundColor: '#e5e7eb',
    cursor: 'row-resize',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background-color 0.15s ease',
    borderTop: '1px solid #d1d5db',
    borderBottom: '1px solid #e5e7eb',
    userSelect: 'none',
  },
  resizeHandleGrip: {
    width: '36px',
    height: '2px',
    backgroundColor: '#9ca3af',
    borderRadius: '2px',
  },
  terminalWrapper: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #d1d5db',
    flexShrink: 0,
    minHeight: '100px',
    maxHeight: '75vh',
    overflow: 'hidden',
  },
  terminalHeader: {
    height: '36px',
    minHeight: '36px',
    padding: '0 14px',
    backgroundColor: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  tabHeaderBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 14px',
    height: '36px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.82rem',
    letterSpacing: '0.04em',
    transition: 'all 0.15s ease',
    userSelect: 'none'
  },
  testButton: {
    padding: '8px 16px',
    border: '1px solid #10b981',
    color: '#059669',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s ease'
  },
  terminalActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    color: '#4b5563',
    fontSize: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  statusBadgeRunning: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '2px 8px',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '12px',
    color: '#059669',
    fontSize: '0.72rem',
    fontWeight: '600',
  },
  statusBadgeIdle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '2px 8px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    color: '#6b7280',
    fontSize: '0.72rem',
    fontWeight: '500',
  },
  statusDotRunning: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 4px #10b981',
  },
  statusDotIdle: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#9ca3af',
  },
  terminalBody: {
    flex: 1,
    padding: '12px 16px',
    overflowY: 'auto',
    fontFamily: "Consolas, 'Cascadia Code', 'Courier New', monospace",
    fontSize: '0.92rem',
    lineHeight: 1.5,
    color: '#111827',
    backgroundColor: '#ffffff',
    textAlign: 'left',
  },
  terminalInputRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '6px',
    backgroundColor: '#f9fafb',
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #e5e7eb',
  },
  terminalInput: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#111827',
    outline: 'none',
    width: '100%',
    fontFamily: "Consolas, 'Cascadia Code', 'Courier New', monospace",
    fontSize: '0.92rem',
  }
};