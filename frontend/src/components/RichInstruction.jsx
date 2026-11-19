import React, { useMemo } from 'react';
import { resolveMediaUrlsInHtml } from '../utils/mediaUrl';

/**
 * RichInstruction
 * Universal component for rendering rich instruction and material HTML safely.
 * - Rewrites relative `/uploads/` and cross-host URLs to the active reachable backend
 * - Applies standard responsive styles for videos, images, code, and text
 * - Memoized with React.memo so videos and media do not reload on parent re-renders
 */
const RichInstruction = React.memo(function RichInstruction({
  html,
  onClick,
  style,
  className = 'rich-instruction-content'
}) {
  const resolved = useMemo(() => resolveMediaUrlsInHtml(html), [html]);
  if (!html) return null;
  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: resolved }}
      onClick={onClick}
    />
  );
});

export default RichInstruction;
