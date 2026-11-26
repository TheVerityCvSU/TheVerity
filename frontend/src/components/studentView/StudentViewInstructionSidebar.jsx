import { useMemo } from 'react';
import { PanelLeftClose, Maximize2, Minimize2 } from 'lucide-react';
import AttachmentCard from '../AttachmentCard';
import RichInstruction from '../RichInstruction';
import StudentViewInstructionRail from './StudentViewInstructionRail';
import StudentViewWarningDrawer from './StudentViewWarningDrawer';
import { studentViewStyles as styles } from '../../utils/studentViewStyles';

export default function StudentViewInstructionSidebar({
  isSandbox,
  layout = {},
  isMobile,
  isDark,
  proctorLogs = [],
  instruction,
  handleInstructionClick,
  assignment,
  setPreviewImage,
  setPreviewVideo,
  setPreviewIframe,
  ...props
}) {
  const isInstructionCollapsed = props.isInstructionCollapsed ?? layout.isInstructionCollapsed;
  const toggleInstructionCollapse = props.toggleInstructionCollapse ?? layout.toggleInstructionCollapse;
  const isInstructionMaximized = props.isInstructionMaximized ?? layout.isInstructionMaximized;
  const toggleInstructionMaximize = props.toggleInstructionMaximize ?? layout.toggleInstructionMaximize;
  const instructionWidth = props.instructionWidth ?? layout.instructionWidth;
  const instructionHeight = props.instructionHeight ?? layout.instructionHeight;
  const handleWarningDividerMouseDown = props.handleWarningDividerMouseDown ?? layout.handleWarningDividerMouseDown;
  const isResizingWarning = props.isResizingWarning ?? layout.isResizingWarning;
  const warningHeight = props.warningHeight ?? layout.warningHeight;
  const isWarningCollapsed = props.isWarningCollapsed ?? layout.isWarningCollapsed;
  const setIsWarningCollapsed = props.setIsWarningCollapsed ?? layout.setIsWarningCollapsed;
  const isWarningMaximized = props.isWarningMaximized ?? layout.isWarningMaximized;
  const toggleWarningMaximize = props.toggleWarningMaximize ?? layout.toggleWarningMaximize;
  const handleSidebarDividerMouseDown = props.handleSidebarDividerMouseDown ?? layout.handleSidebarDividerMouseDown;
  const setInstructionWidth = props.setInstructionWidth ?? layout.setInstructionWidth;
  const isResizingSidebar = props.isResizingSidebar ?? layout.isResizingSidebar;

  const filteredProctorLogs = useMemo(() => {
    return (Array.isArray(proctorLogs) ? proctorLogs : []).filter((l) => {
      const text = `${l?.action || ''} ${l?.message || ''}`.toLowerCase();
      return !text.includes('cognitive pause') && !text.includes('inactivity');
    });
  }, [proctorLogs]);

  if (isSandbox) return null;

  if (isInstructionCollapsed) {
    return (
      <StudentViewInstructionRail
        isMobile={isMobile}
        isDark={isDark}
        proctorLogsLength={filteredProctorLogs.length}
        onExpand={toggleInstructionCollapse}
      />
    );
  }

  return (
    <>
      <div
        style={{
          ...styles.leftSidebar,
          ...(isDark ? { backgroundColor: '#282828' } : {}),
          width: isInstructionMaximized ? '100%' : isMobile ? '100%' : `${instructionWidth}px`,
          height: isInstructionMaximized ? '100%' : isMobile ? `${instructionHeight}px` : '100%',
          borderRight: isMobile ? 'none' : isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db',
          borderBottom: isMobile ? (isDark ? '1px solid #3c3c3c' : '1px solid #d1d5db') : 'none',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...(isInstructionMaximized ? { zIndex: 20 } : {})
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            borderBottom: isDark ? '1px solid #333333' : '1px solid #e5e7eb',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Principle 8: Widow prevention on heading */}
            <h2
              style={{
                color: isDark ? '#E8EAED' : '#111827',
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: '700',
                textWrap: 'balance',
                lineHeight: 1.2
              }}
              className="heading-balanced"
            >
              Instruction
            </h2>
          </div>
          {/* Principle 10: Enforce 44px x 44px touch targets on mobile toolbar buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={toggleInstructionCollapse}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                padding: '10px',
                borderRadius: '8px',
                color: isDark ? '#9ca3af' : '#6b7280',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease, background-color 0.15s ease'
              }}
              className="touch-target-44 clickable-affordance"
              title="Collapse Instructions (Ctrl+B)"
              aria-label="Collapse Instructions"
            >
              <PanelLeftClose size={18} />
            </button>
            <button
              onClick={toggleInstructionMaximize}
              title={isInstructionMaximized ? 'Restore instructions' : 'Maximize instructions'}
              aria-label={isInstructionMaximized ? 'Restore instructions' : 'Maximize instructions'}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                padding: '10px',
                borderRadius: '8px',
                color: isDark ? '#9ca3af' : '#6b7280',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease, background-color 0.15s ease'
              }}
              className="touch-target-44 clickable-affordance"
            >
              {isInstructionMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Scrollable Instruction Body - Principle 9: Line Length (max-w-[65ch]) & Principle 7: Line Height (1.58) */}
        <div
          style={{
            ...styles.instructionSection,
            padding: '18px',
            ...(isDark ? { backgroundColor: '#282828' } : {})
          }}
        >
          {instruction ? (
            <div style={{ maxWidth: '65ch', width: '100%' }} className="max-w-prose">
              <RichInstruction
                html={instruction}
                style={{
                  ...styles.instructionText,
                  whiteSpace: 'normal',
                  lineHeight: 1.58,
                  textWrap: 'pretty',
                  ...(isDark ? { color: '#d1d5db' } : {})
                }}
                className="prose-pretty"
                onClick={handleInstructionClick}
              />
            </div>
          ) : (
            <p style={{ color: isDark ? '#888888' : '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem', maxWidth: '65ch', textWrap: 'pretty' }}>
              Waiting for instructions...
            </p>
          )}

          {assignment?.attachments?.length > 0 && (
            <div style={styles.attachmentList}>
              {assignment.attachments.map((att, i) => (
                <AttachmentCard
                  key={i}
                  att={att}
                  isDark={isDark}
                  onClick={(clickedAtt) => {
                    if (!clickedAtt) return;
                    const ext = (clickedAtt.url || clickedAtt.name || '').split('?')[0].split('.').pop().toLowerCase();
                    const isImg = clickedAtt.type === 'image' || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext);
                    const isVid = clickedAtt.type === 'video' || ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(ext);
                    if (isImg && setPreviewImage) setPreviewImage(clickedAtt);
                    else if (isVid && setPreviewVideo) setPreviewVideo(clickedAtt);
                    else if (setPreviewIframe) setPreviewIframe(clickedAtt);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Resizable Divider */}
        <div
          onMouseDown={handleWarningDividerMouseDown}
          style={{
            height: '7px',
            backgroundColor: isResizingWarning ? '#10b981' : isDark ? '#2e2e2e' : '#e5e7eb',
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
          <div
            style={{
              width: '32px',
              height: '2px',
              backgroundColor: isDark ? '#666666' : '#9ca3af',
              borderRadius: '2px'
            }}
          />
        </div>

        {/* Warning Section Drawer */}
        <StudentViewWarningDrawer
          isDark={isDark}
          proctorLogs={filteredProctorLogs}
          warningHeight={warningHeight}
          isWarningCollapsed={isWarningCollapsed}
          setIsWarningCollapsed={setIsWarningCollapsed}
          isWarningMaximized={isWarningMaximized}
          toggleWarningMaximize={toggleWarningMaximize}
          isResizingWarning={isResizingWarning}
        />
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={handleSidebarDividerMouseDown}
        onDoubleClick={() => setInstructionWidth(320)}
        style={{
          width: isMobile ? '100%' : '7px',
          height: isMobile ? '7px' : '100%',
          backgroundColor: isResizingSidebar ? '#10b981' : isDark ? '#2e2e2e' : '#e2e8f0',
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
        title={
          isMobile
            ? 'Drag up or down to adjust instruction height'
            : 'Drag left or right to adjust instruction width (Double-click to reset)'
        }
      >
        <div
          style={{
            width: isMobile ? '36px' : '2px',
            height: isMobile ? '2px' : '36px',
            backgroundColor: isResizingSidebar ? '#ffffff' : isDark ? '#555555' : '#9ca3af',
            borderRadius: '2px'
          }}
        />
      </div>
    </>
  );
}
