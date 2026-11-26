import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';
import { modalStyles } from './imagePreview/imagePreviewStyles';
import ImagePreviewToolbar from './imagePreview/ImagePreviewToolbar';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { triggerDirectDownload } from '../utils/downloadFile';

/**
 * ImagePreviewModal
 * A full-featured lightbox modal with smooth zoom in / zoom out,
 * wheel zoom, click-drag panning, double-click toggle, and keyboard shortcuts.
 */
export default function ImagePreviewModal({ src, alt, onClose }) {
  const resolvedSrc = useMemo(() => resolveMediaUrl(src), [src]);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const containerRef = useRef(null);

  // Reset zoom & pan
  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Zoom In
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(Number((prev + 0.25).toFixed(2)), 5));
  }, []);

  // Zoom Out
  const handleZoomOut = useCallback(() => {
    setScale(prev => {
      const next = Math.max(Number((prev - 0.25).toFixed(2)), 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Double click toggles between 1x and 2x
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2);
    }
  };

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setScale(prev => {
      const next = Math.min(Math.max(Number((prev + delta).toFixed(2)), 0.5), 5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Pointer drag panning
  const handlePointerDown = (e) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy
    });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleReset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleZoomIn, handleZoomOut, handleReset]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Download helper
  const handleDownload = (e) => {
    e.stopPropagation();
    triggerDirectDownload(resolvedSrc || src, alt || 'image');
  };

  if (!src) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={modalStyles.overlay}
        onClick={onClose}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Top Header Bar */}
        <div style={modalStyles.headerBar} onClick={(e) => e.stopPropagation()}>
          <div style={modalStyles.headerTitle} title={alt || 'Image Preview'}>
            {alt || 'Image Preview'}
          </div>
          <div style={modalStyles.headerActions}>
            <button
              style={modalStyles.iconBtn}
              onClick={handleDownload}
              title="Download image"
              type="button"
            >
              <Download size={18} />
            </button>
            <button
              style={modalStyles.closeBtn}
              onClick={onClose}
              title="Close (Esc)"
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Center Image Container */}
        <div
          ref={containerRef}
          style={{
            ...modalStyles.imageViewport,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
          }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={resolvedSrc || src}
            alt={alt || 'Preview'}
            draggable={false}
            style={{
              ...modalStyles.image,
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
          />
        </div>

        {/* Floating Bottom Toolbar */}
        <ImagePreviewToolbar
          scale={scale}
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          handleReset={handleReset}
        />
      </motion.div>
    </AnimatePresence>
  );
}
