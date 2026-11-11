import { PanelLeftClose, Maximize2, Minimize2 } from 'lucide-react';
import AttachmentCard from '../AttachmentCard';
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
  if (isSandbox) return null;

  if (isInstructionCollapsed) {
    return (
      <StudentViewInstructionRail
        isMobile={isMobile}
        isDark={isDark}
        proctorLogsLength={(proctorLogs || []).length}
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
            padding: '14px 18px 10px 18px',
            borderBottom: isDark ? '1px solid #333333' : '1px solid #e5e7eb',
            flexShrink: 0
          }}
        >
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
              <PanelLeftClose size={18} />
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
        <div
          style={{
            ...styles.instructionSection,
            padding: '18px',
            ...(isDark ? { backgroundColor: '#282828' } : {})
          }}
        >
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
            <p style={{ color: isDark ? '#888888' : '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem' }}>
              Waiting for instructions...
            </p>
          )}

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
          proctorLogs={proctorLogs}
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
