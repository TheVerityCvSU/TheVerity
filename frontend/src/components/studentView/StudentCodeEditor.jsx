import { useRef, useEffect } from 'react';
import '../../utils/monaco/monacoConfig.js';
import Editor from '@monaco-editor/react';
import { registerMonacoSnippets } from '../../utils/monaco/registerMonacoSnippets';
import { studentViewStyles as styles } from '../../utils/studentViewStyles';

const normalize = (text) => (text || '').replace(/\s+/g, '');

export default function StudentCodeEditor({
  isDark,
  activeCode,
  submitted,
  editorFontSize,
  editorRef,
  monacoRef,
  diagnosticsRef,
  updateEditorMarkers,
  handleSaveCode,
  activeFileId,
  setCode,
  codeRef,
  draftKey,
  studentId,
  safeUsername,
  assignmentId,
  setCodeHistory,
  persistHistory,
  emitToSockets,
  studentActualId,
  studentDisplayName,
  currentUser,
  classroom,
  classroomId,
  assignment,
  proctorLogsRef: _proctorLogsRef,
  proctorLogs: _proctorLogs,
  handleExtraFileCodeChange,
  copiedInternallyRef,
  addProctorLog,
  strictClipboardBlocking = true,
  isResizingTerminal,
  handleDividerMouseDown
}) {
  const strictClipboardRef = useRef(strictClipboardBlocking);
  useEffect(() => {
    strictClipboardRef.current = strictClipboardBlocking;
  }, [strictClipboardBlocking]);

<<<<<<< HEAD
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const pendingTypingPayloadRef = useRef(null);

  useEffect(() => {
    if (submitted && typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      pendingTypingPayloadRef.current = null;
    }
  }, [submitted]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        if (pendingTypingPayloadRef.current && emitToSockets && !submitted) {
          emitToSockets('student_typing', pendingTypingPayloadRef.current);
        }
        pendingTypingPayloadRef.current = null;
      }
    };
  }, [emitToSockets, submitted]);
=======
  const TYPING_THROTTLE_MS = 500;
  const typingTimerRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const latestEmitDataRef = useRef(null);

  const flushTypingEmit = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    const pending = latestEmitDataRef.current;
    latestEmitDataRef.current = null;
    if (pending && typeof pending.emit === 'function') {
      lastTypingEmitRef.current = Date.now();
      pending.emit('student_typing', pending.payload);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      const pending = latestEmitDataRef.current;
      latestEmitDataRef.current = null;
      if (pending && typeof pending.emit === 'function') {
        pending.emit('student_typing', pending.payload);
      }
    };
  }, []);
>>>>>>> 3b82a0e04c7a495c9e05ceca4205e12acdacce60

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    registerMonacoSnippets(monaco);

    if (editor) {
      editor.updateOptions({
        readOnly: submitted,
        domReadOnly: submitted
      });
    }

    if (monaco) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (!submitted && typeof handleSaveCode === 'function') {
          handleSaveCode();
        }
      });
    }

    const captureInternalCopy = () => {
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) return;
      const model = editor.getModel();
      if (!model) return;
      const selectedText = model.getValueInRange(selection);
      const key = normalize(selectedText);
      if (key && copiedInternallyRef.current) {
        copiedInternallyRef.current.add(key);
      }
    };

    const editorDom = editor.getDomNode();
    if (editorDom) {
      editorDom.addEventListener('copy', captureInternalCopy, true);
      editorDom.addEventListener('cut', captureInternalCopy, true);

      const handleEditorDomPaste = (e) => {
        if (submitted) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
        if (strictClipboardRef.current === false) return;
        const pastedText = e.clipboardData?.getData('text/plain') || '';
        const key = normalize(pastedText);
        if (!key) return;

        if (copiedInternallyRef.current && copiedInternallyRef.current.has(key)) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (typeof addProctorLog === 'function') addProctorLog('Strict Clipboard: External Paste Blocked', '#ef4444');
        if (window.electronAPI?.clearClipboard) {
          window.electronAPI.clearClipboard().catch(() => {});
        }
        return false;
      };
      editorDom.addEventListener('paste', handleEditorDomPaste, true);

      const handleEditorDrop = (e) => {
        if (strictClipboardRef.current === false) return;
        const droppedText = e.dataTransfer?.getData('text/plain') || '';
        const key = normalize(droppedText);
        if (key && copiedInternallyRef.current && !copiedInternallyRef.current.has(key)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (typeof addProctorLog === 'function') addProctorLog('Strict Clipboard: External Drop Blocked', '#ef4444');
          return false;
        }
      };
      editorDom.addEventListener('drop', handleEditorDrop, true);
      editorDom.addEventListener('dragover', (e) => {
        if (submitted) e.preventDefault();
      }, true);
    }

    editor.onDidPaste((e) => {
      if (submitted) {
        editor.trigger('keyboard', 'undo', null);
        return;
      }
      if (strictClipboardRef.current === false) return;
            const model = editor.getModel();
            if (!model) return;
            const pastedText = model.getValueInRange(e.range);
            const key = normalize(pastedText);
            if (!key || (copiedInternallyRef.current && copiedInternallyRef.current.has(key))) return;

            editor.trigger('keyboard', 'undo', null);
            if (typeof addProctorLog === 'function') addProctorLog('Strict Clipboard: External Paste Blocked', '#ef4444');
            if (window.electronAPI?.clearClipboard) {
              window.electronAPI.clearClipboard().catch(() => {});
            }
          });
        };

        const handleCodeChange = (newCode) => {
          if (submitted) {
            if (editorRef.current && editorRef.current.getValue() !== activeCode) {
              editorRef.current.setValue(activeCode);
            }
            return;
          }

          if (activeFileId === 'main') {
            if (diagnosticsRef?.current?.length > 0 && updateEditorMarkers) {
              updateEditorMarkers([]);
            }
            setCode(newCode);
            codeRef.current = newCode;
            try {
              localStorage.setItem(draftKey, newCode);
              if (studentId !== safeUsername) {
                localStorage.setItem(`verity_code_${assignmentId}_${safeUsername}`, newCode);
              }
            } catch {}

            const newEntry = { time: Date.now(), code: newCode };
            if (typeof setCodeHistory === 'function') {
              setCodeHistory((prev) => {
                const nextHist = [...(prev || []), newEntry];
                if (typeof persistHistory === 'function') persistHistory(nextHist, newCode);
                return nextHist;
              });
            }

            if (emitToSockets) {
              const rawLogs = proctorLogsRef?.current || proctorLogs || [];
              const slimLogs = Array.isArray(rawLogs) ? rawLogs.slice(0, 25) : [];
              const typingPayload = {
                studentId: studentActualId,
                id: studentActualId,
                name: studentDisplayName,
                studentName: studentDisplayName,
                email: currentUser?.email || '',
                avatar: currentUser?.avatar || '',
                code: newCode,
                classroomId: (classroom?.id != null ? String(classroom.id) : null) || (classroomId !== 'none' ? classroomId : null) || 'none',
                assignmentId: assignment?.id || assignmentId,
                logs: slimLogs
              };
              const now = Date.now();
              const elapsed = now - lastTypingEmitRef.current;
              const throttleMs = 350;
              if (elapsed >= throttleMs) {
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = null;
                }
                pendingTypingPayloadRef.current = null;
                lastTypingEmitRef.current = now;
                emitToSockets('student_typing', typingPayload);
              } else {
                pendingTypingPayloadRef.current = typingPayload;
                if (!typingTimeoutRef.current) {
                  typingTimeoutRef.current = setTimeout(() => {
                    typingTimeoutRef.current = null;
                    const pending = pendingTypingPayloadRef.current;
                    pendingTypingPayloadRef.current = null;
                    if (pending && emitToSockets) {
                      lastTypingEmitRef.current = Date.now();
                      emitToSockets('student_typing', pending);
                    }
                  }, throttleMs - elapsed);
                }
              }
            }
          } else if (handleExtraFileCodeChange) {
            handleExtraFileCodeChange(activeFileId, newCode);
          }
        };

        return (
          <>
            <div style={{ flex: 1, minHeight: 0, pointerEvents: isResizingTerminal ? 'none' : 'auto' }}>
              <Editor
                height="100%"
                language="csharp"
                theme={isDark ? 'vs-dark' : 'light'}
                value={activeCode}
                onChange={handleCodeChange}
                onMount={handleEditorDidMount}
                options={{
                  fontSize: editorFontSize,
                  minimap: { enabled: false },
                  readOnly: submitted,
                  domReadOnly: submitted,
                  readOnlyMessage: { value: 'Work submitted — editing is disabled.' },
                  contextmenu: !submitted,
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
                  dragAndDrop: false,
                  dropIntoEditor: { enabled: false }
                }}
              />
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
          </>
        );
      }

<<<<<<< HEAD
=======
      if (emitToSockets) {
        const payload = {
          studentId: studentActualId,
          id: studentActualId,
          name: studentDisplayName,
          studentName: studentDisplayName,
          email: currentUser?.email || '',
          code: newCode,
          classroomId: (classroom?.id != null ? String(classroom.id) : null) || (classroomId !== 'none' ? classroomId : null) || 'none',
          assignmentId: assignment?.id || assignmentId
        };
        latestEmitDataRef.current = { emit: emitToSockets, payload };
        const elapsed = Date.now() - lastTypingEmitRef.current;
        if (elapsed >= TYPING_THROTTLE_MS) {
          flushTypingEmit();
        } else if (!typingTimerRef.current) {
          typingTimerRef.current = setTimeout(flushTypingEmit, TYPING_THROTTLE_MS - elapsed);
        }
      }
    } else if (handleExtraFileCodeChange) {
      handleExtraFileCodeChange(activeFileId, newCode);
    }
  };

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, pointerEvents: isResizingTerminal ? 'none' : 'auto' }}>
        <Editor
          height="100%"
          language="csharp"
          theme={isDark ? 'vs-dark' : 'light'}
          value={activeCode}
          onChange={handleCodeChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: editorFontSize,
            minimap: { enabled: false },
            readOnly: submitted,
            domReadOnly: submitted,
            readOnlyMessage: { value: 'Work submitted — editing is disabled.' },
            contextmenu: !submitted,
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
            dragAndDrop: false,
            dropIntoEditor: { enabled: false }
          }}
        />
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
    </>
  );
}

>>>>>>> 3b82a0e04c7a495c9e05ceca4205e12acdacce60
