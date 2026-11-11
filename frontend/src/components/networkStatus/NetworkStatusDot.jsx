import React from 'react';

export default function NetworkStatusDot({
  dotColor,
  tooltipText,
  isHovered,
  setIsHovered,
  onClick
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={tooltipText}
      aria-label={tooltipText}
      style={{
        width: '24px',
        height: '24px',
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        boxShadow: 'none',
        transform: isHovered ? 'scale(1.2)' : 'scale(1)',
        transition: 'transform 0.2s ease'
      }}
    >
      <span
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: dotColor,
          boxShadow: `0 0 8px ${dotColor}, 0 0 14px ${dotColor}88`,
          display: 'inline-block',
          transition: 'background-color 0.3s ease, box-shadow 0.3s ease'
        }}
      />
    </button>
  );
}

