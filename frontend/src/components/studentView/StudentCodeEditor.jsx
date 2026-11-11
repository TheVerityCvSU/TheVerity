import React from 'react';
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
  resetCognitivePauseTimer,
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
  proctorLogsRef,
  proctorLogs,
  handleExtraFileCodeChange,
  copiedInternallyRef,
  addProctorLog,
  isResizingTerminal,
  handleDividerMouseDown
}) {
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
        if (!submitted) {
          handleSaveCode();
        }
      });
    }

    const captureInternalCopy = () => {
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) return;
      const selectedText = editor.getModel().getValueInRange(selection);
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
        const pastedText = e.clipboardData?.getData('text/plain') || '';
        const key = normalize(pastedText);
        if (!key) return;

        if (copiedInternallyRef.current && copiedInternallyRef.current.has(key)) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (addProctorLog) addProctorLog('Strict Clipboard: External Paste Blocked', '#ef4444');
        if (window.electronAPI?.clearClipboard) {
          window.electronAPI.clearClipboard().catch(() => {});
        }
        return false;
      };
      editorDom.addEventListener('paste', handleEditorDomPaste, true);

      const handleEditorDrop = (e) => {
        const droppedText = e.dataTransfer?.getData('text/plain') || '';
        const key = normalize(droppedText);
        if (key && copiedInternallyRef.current && !copiedInternallyRef.current.has(key)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (addProctorLog) addProctorLog('Strict Clipboard: External Drop Blocked', '#ef4444');
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
      const pastedText = editor.getModel().getValueInRange(e.range);
      const key = normalize(pastedText);
      if (!key || (copiedInternallyRef.current && copiedInternallyRef.current.has(key))) return;

      editor.trigger('keyboard', 'undo', null);
      if (addProctorLog) addProctorLog('Strict Clipboard: External Paste Blocked', '#ef4444');
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
    if (resetCognitivePauseTimer) resetCognitivePauseTimer();

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
      setCodeHistory(prev => {
        const nextHist = [...prev, newEntry];
        if (persistHistory) persistHistory(nextHist, newCode);
        return nextHist;
      });

      if (emitToSockets) {
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
          logs: proctorLogsRef?.current || proctorLogs
        });
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

