import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { resolveMediaUrlsInHtml } from '../utils/mediaUrl';

const ALLOWED_SAFE_URI_RE = /^(?:(?:https?|mailto|blob):|\/uploads\/|\/|#)/i;

/**
 * RichInstruction
 * Universal component for rendering rich instruction and material HTML safely.
 * - Rewrites relative `/uploads/` and cross-host URLs to the active reachable backend
 * - Sanitizes HTML via DOMPurify to block XSS payloads while preserving rich instructional media
 * - Applies standard responsive styles for videos, images, code, and text
 * - Memoized with React.memo so videos and media do not reload on parent re-renders
 */
const RichInstruction = React.memo(function RichInstruction({
  html,
  onClick,
  style,
  className = 'rich-instruction-content'
}) {
  const sanitized = useMemo(() => {
    const resolved = resolveMediaUrlsInHtml(html);
    if (!resolved) return '';
    return DOMPurify.sanitize(resolved, {
      ADD_TAGS: ['video', 'source', 'iframe'],
      ADD_ATTR: ['controls', 'preload', 'poster', 'playsinline', 'allowfullscreen', 'frameborder', 'target', 'rel'],
      FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'meta', 'base'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'formaction', 'srcdoc'],
      ALLOWED_URI_REGEXP: ALLOWED_SAFE_URI_RE
    });
  }, [html]);
  if (!html) return null;
  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitized }}
      onClick={onClick}
    />
  );
});

export default RichInstruction;
