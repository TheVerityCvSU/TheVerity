import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { modalStyles } from './imagePreviewStyles';

export default function ImagePreviewToolbar({ scale, handleZoomIn, handleZoomOut, handleReset }) {
  return (
    <>
      <div style={modalStyles.floatingToolbar} onClick={(e) => e.stopPropagation()}>
        <button
          style={modalStyles.toolBtn}
          onClick={handleZoomOut}
          disabled={scale <= 0.5}
          title="Zoom Out (-)"
          type="button"
        >
          <ZoomOut size={18} />
        </button>

        <button
          style={modalStyles.zoomLabelBtn}
          onClick={handleReset}
          title="Click to reset (0)"
          type="button"
        >
          {Math.round(scale * 100)}%
        </button>

        <button
          style={modalStyles.toolBtn}
          onClick={handleZoomIn}
          disabled={scale >= 5}
          title="Zoom In (+)"
          type="button"
        >
          <ZoomIn size={18} />
        </button>

        <div style={modalStyles.divider} />

        <button
          style={modalStyles.toolBtn}
          onClick={handleReset}
          title="Reset Zoom & Pan"
          type="button"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Instructions pill */}
      <div style={modalStyles.hintPill} onClick={(e) => e.stopPropagation()}>
        Scroll or click buttons to zoom • Drag to pan • Double-click to toggle
      </div>
    </>
  );
}

