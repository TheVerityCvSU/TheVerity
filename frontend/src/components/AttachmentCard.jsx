import React, { useState, useMemo } from 'react';
import { Play, Globe, FileText, X } from 'lucide-react';
import { resolveMediaUrl, getVideoThumbnailUrl } from '../utils/mediaUrl';

/**
 * AttachmentCard
 * Matches the Google Classroom attachment card format:
 * - Left side: Title/filename (underlined) + Type subtitle (Image, Video, URL)
 * - Right side: Visual preview thumbnail separated by a vertical divider
 * - Optional remove (X) button for creation/edit modals
 */
function AttachmentCard({
  att,
  onClick,
  onRemove,
  isDark = false,
  style = {}
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [posterError, setPosterError] = useState(false);

  const type = att?.type || 'file';
  const name = att?.name || (type === 'link' ? att?.url : 'Attachment');
  const rawUrl = att?.url || '';
  const resolvedUrl = useMemo(() => resolveMediaUrl(rawUrl), [rawUrl]);

  // Infer media type from extension if not strictly defined
  const fileExtension = useMemo(() => {
    const target = (rawUrl || att?.name || '').split('?')[0].split('#')[0];
    const match = target.match(/\.([0-9a-z]+)$/i);
    return match ? match[1].toLowerCase() : '';
  }, [rawUrl, att?.name]);

  const isImage = useMemo(() => {
    return type === 'image' || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(fileExtension);
  }, [type, fileExtension]);

  const isVideo = useMemo(() => {
    return type === 'video' || ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'avi', 'mkv'].includes(fileExtension);
  }, [type, fileExtension]);

  const isDoc = useMemo(() => {
    return type === 'document' || ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv'].includes(fileExtension);
  }, [type, fileExtension]);

  const isLink = type === 'link' && !isImage && !isVideo;
  const rawThumbnailUrl = att?.thumbnailUrl || '';

  const posterUrl = useMemo(() => {
    if (!isVideo) return null;
    if (rawThumbnailUrl) return resolveMediaUrl(rawThumbnailUrl);
    return getVideoThumbnailUrl(resolvedUrl);
  }, [isVideo, rawThumbnailUrl, resolvedUrl]);

  // Ensure link URLs always have http:// or https:// so they open external sites
  const targetUrl = useMemo(() => {
    if (!resolvedUrl) return '#';
    if (isLink) {
      return (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://'))
        ? resolvedUrl
        : `https://${resolvedUrl}`;
    }
    return resolvedUrl;
  }, [isLink, resolvedUrl]);

  if (!att) return null;

  let typeLabel = 'File';
  if (isImage) typeLabel = 'Image';
  else if (isVideo) typeLabel = 'Video';
  else if (isLink) typeLabel = rawUrl || 'Link';
  else if (fileExtension) {
    typeLabel = `${fileExtension.toUpperCase()} File`;
  }

  const handleClick = (e) => {
    if (isLink) {
      if (onClick) {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        onClick({ ...att, type: 'link' });
        return;
      }
      if (targetUrl !== '#') {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    if (onClick) {
      const normalizedAtt = {
        ...att,
        type: isImage ? 'image' : isVideo ? 'video' : isDoc ? 'document' : type
      };
      onClick(normalizedAtt);
    }
  };

  const cardStyle = {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    height: '68px',
    minHeight: '68px',
    maxHeight: '68px',
    backgroundColor: isDark ? (isHovered ? '#383838' : '#303030') : (isHovered ? '#f9fafb' : '#ffffff'),
    border: isDark ? '1px solid #4A4A4A' : '1px solid #dadce0',
    borderRadius: '10px',
    overflow: 'hidden',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.15s ease',
    boxShadow: isHovered
      ? (isDark ? '0 2px 8px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.08)')
      : 'none',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '340px',
    minWidth: '220px',
    flex: '1 1 240px',
    textDecoration: 'none',
    color: 'inherit',
    ...style
  };

  const leftContentStyle = {
    flex: 1,
    minWidth: 0,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    overflow: 'hidden'
  };

  const titleStyle = {
    fontSize: '0.86rem',
    fontWeight: '600',
    color: isDark ? '#E8EAED' : '#1f2937',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.3
  };

  const subStyle = {
    fontSize: '0.74rem',
    color: isDark ? '#9CA3AF' : '#5f6368',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: '4px',
    lineHeight: 1.2
  };

  const rightThumbBoxStyle = {
    width: '74px',
    minWidth: '74px',
    maxWidth: '74px',
    height: '100%',
    borderLeft: isDark ? '1px solid #4A4A4A' : '1px solid #dadce0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#242424' : '#f8fafc',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0
  };

  const removeBtnStyle = {
    position: 'absolute',
    top: '4px',
    right: '4px',
    zIndex: 10,
    background: isDark ? 'rgba(40,40,40,0.85)' : 'rgba(255,255,255,0.9)',
    border: isDark ? '1px solid #5A5A5A' : '1px solid #d1d5db',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: isDark ? '#e5e7eb' : '#4b5563',
    padding: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
  };

  const cardContent = (
    <>
      {/* Optional Remove Button */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(att);
          }}
          style={removeBtnStyle}
          title="Remove attachment"
        >
          <X size={12} />
        </button>
      )}

      {/* Left side: Filename / title & Type */}
      <div style={leftContentStyle}>
        <div style={titleStyle} title={name}>
          {name}
        </div>
        <div style={subStyle} title={typeLabel}>
          {typeLabel}
        </div>
      </div>

      {/* Right side: Thumbnail preview */}
      <div style={rightThumbBoxStyle}>
        {isImage && resolvedUrl && !mediaError ? (
          <img
            src={resolvedUrl}
            alt=""
            onError={() => setMediaError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : isVideo && resolvedUrl && !mediaError ? (
          <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {posterUrl && !posterError ? (
              <img
                src={posterUrl}
                alt=""
                onError={() => setPosterError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.85 }}
              />
            ) : (
              <video
                src={resolvedUrl}
                muted
                playsInline
                preload="none"
                onError={() => setMediaError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.85 }}
              />
            )}
            <div style={{
              position: 'absolute',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}>
              <Play size={13} fill="#FFFFFF" color="#FFFFFF" style={{ marginLeft: '1px' }} />
            </div>
          </div>
        ) : isLink ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#10b981' }}>
            <Globe size={26} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: isDark ? '#9CA3AF' : '#64748b' }}>
            <FileText size={26} />
          </div>
        )}
      </div>
    </>
  );

  // If link, render as card; intercept if onClick provided to open in-app preview
  if (isLink) {
    return (
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={cardStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={name}
        onClick={(e) => {
          if (onClick) {
            e.preventDefault();
            e.stopPropagation();
            onClick(att);
          }
        }}
      >
        {cardContent}
      </a>
    );
  }

  // Otherwise render clickable card for images, videos, files
  return (
    <div
      style={cardStyle}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={name}
    >
      {cardContent}
    </div>
  );
}

export default React.memo(AttachmentCard);
