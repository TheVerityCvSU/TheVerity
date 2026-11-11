import { normalize } from './studentViewUtils';

export function setupClipboardProtection({
  editorRef,
  submitted,
  addProctorLog,
  copiedInternallyRef
}) {
  const editor = editorRef.current;
  const editorDom = editor?.getDomNode();
  if (!editor || !editorDom) return () => {};

  const captureInternalCopy = () => {
    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) return;
    const selectedText = editor.getModel()?.getValueInRange(selection);
    const key = normalize(selectedText);
    if (key) copiedInternallyRef.current.add(key);
  };

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

    if (copiedInternallyRef.current.has(key)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    addProctorLog('Strict Clipboard: External Paste Blocked', '#ef4444');
    if (window.electronAPI?.clearClipboard) {
      window.electronAPI.clearClipboard().catch(() => {});
    }
    return false;
  };

  const handleEditorDrop = (e) => {
    const droppedText = e.dataTransfer?.getData('text/plain') || '';
    const key = normalize(droppedText);
    if (key && !copiedInternallyRef.current.has(key)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      addProctorLog('Strict Clipboard: External Drop Blocked', '#ef4444');
      return false;
    }
  };

  const handleEditorDragOver = (e) => {
    if (submitted) e.preventDefault();
  };

  editorDom.addEventListener('copy', captureInternalCopy, true);
  editorDom.addEventListener('cut', captureInternalCopy, true);
  editorDom.addEventListener('paste', handleEditorDomPaste, true);
  editorDom.addEventListener('drop', handleEditorDrop, true);
  editorDom.addEventListener('dragover', handleEditorDragOver, true);

  const didPasteDisposable = editor.onDidPaste((e) => {
    if (submitted) {
      editor.trigger('keyboard', 'undo', null);
      return;
    }
    const pastedText = editor.getModel()?.getValueInRange(e.range);
    const key = normalize(pastedText);
    if (!key || copiedInternallyRef.current.has(key)) return;

    editor.trigger('keyboard', 'undo', null);
    addProctorLog('Strict Clipboard: External Paste Blocked', '#ef4444');
    if (window.electronAPI?.clearClipboard) {
      window.electronAPI.clearClipboard().catch(() => {});
    }
  });

  return () => {
    editorDom.removeEventListener('copy', captureInternalCopy, true);
    editorDom.removeEventListener('cut', captureInternalCopy, true);
    editorDom.removeEventListener('paste', handleEditorDomPaste, true);
    editorDom.removeEventListener('drop', handleEditorDrop, true);
    editorDom.removeEventListener('dragover', handleEditorDragOver, true);
    didPasteDisposable.dispose();
  };
}
