import { useState, useRef, useEffect } from 'react';

export function useStudentViewLayout({ isMobile, editorRef }) {
  const [terminalHeight, setTerminalHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_terminal_height');
      if (saved) return Math.max(100, Math.min(parseInt(saved, 10), window.innerHeight * 0.75));
    } catch {}
    return 240;
  });

  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(() => {
    try { return localStorage.getItem('verity_terminal_collapsed') === 'true'; } catch { return false; }
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
      setTerminalHeight(Math.max(minHeight, Math.min(startHeightRef.current + deltaY, maxHeight)));
      if (editorRef?.current) editorRef.current.layout();
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
      setTimeout(() => editorRef?.current?.layout(), 30);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
  };

  const [instructionWidth, setInstructionWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_instruction_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 180 && val <= window.innerWidth * 0.75) return val;
      }
    } catch {}
    return 320;
  });

  const [instructionHeight, setInstructionHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_instruction_height');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 100 && val <= window.innerHeight * 0.7) return val;
      }
    } catch {}
    return Math.round(window.innerHeight * 0.35);
  });

  const [isInstructionCollapsed, setIsInstructionCollapsed] = useState(() => {
    try { return localStorage.getItem('verity_instruction_collapsed') === 'true'; } catch {}
    return false;
  });

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
        const newH = Math.max(100, Math.min(startSidebarHeightRef.current + deltaY, Math.round(window.innerHeight * 0.7)));
        setInstructionHeight(newH);
      } else {
        const deltaX = moveEvent.clientX - startSidebarXRef.current;
        const newW = Math.max(200, Math.min(startSidebarWidthRef.current + deltaX, Math.round(window.innerWidth * 0.7)));
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
        setInstructionHeight(h => {
          try { localStorage.setItem('verity_instruction_height', String(h)); } catch {}
          return h;
        });
      } else {
        setInstructionWidth(w => {
          try { localStorage.setItem('verity_instruction_width', String(w)); } catch {}
          return w;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

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
      setWarningHeight(Math.max(70, Math.min(startWarningHeightRef.current + deltaY, 450)));
    };

    const handleMouseUp = () => {
      isDraggingWarningRef.current = false;
      setIsResizingWarning(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      setWarningHeight(h => {
        try { localStorage.setItem('verity_warning_height', String(h)); } catch {}
        return h;
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (editorRef?.current) editorRef.current.layout();
    }, 20);
    return () => clearTimeout(timer);
  }, [instructionWidth, instructionHeight, isInstructionCollapsed, terminalHeight, warningHeight, isWarningCollapsed, editorRef]);

  return {
    terminalHeight,
    setTerminalHeight,
    isTerminalCollapsed,
    setIsTerminalCollapsed,
    isTerminalMaximized,
    setIsTerminalMaximized,
    toggleTerminalCollapse,
    toggleTerminalMaximize,
    isResizingTerminal,
    handleDividerMouseDown,
    instructionWidth,
    setInstructionWidth,
    instructionHeight,
    setInstructionHeight,
    isInstructionCollapsed,
    setIsInstructionCollapsed,
    toggleInstructionCollapse,
    isInstructionMaximized,
    setIsInstructionMaximized,
    toggleInstructionMaximize,
    warningHeight,
    setWarningHeight,
    isWarningCollapsed,
    setIsWarningCollapsed,
    isWarningMaximized,
    setIsWarningMaximized,
    toggleWarningMaximize,
    isResizingSidebar,
    handleSidebarDividerMouseDown,
    isResizingWarning,
    handleWarningDividerMouseDown
  };
}
