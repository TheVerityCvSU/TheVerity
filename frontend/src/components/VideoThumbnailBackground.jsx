  import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Film } from 'lucide-react';

/**
 * VideoThumbnailBackground
 * Dynamically displays the genuine thumbnail frame for any video (local MP4, remote video, or YouTube)
 * with a high-end scrim overlay and resilient fallback states.
 */
export default function VideoThumbnailBackground({
  src,
  title = 'Video lesson',
  isDark = false,
  onDurationLoaded = null,
  style = {}
}) {
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const videoRef = useRef(null);

  // Check if src is YouTube
  const youtubeId = useMemo(() => {
    if (!src || typeof src !== 'string') return null;
    const match = src.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  }, [src]);

  // Derive companion static thumbnail URL (e.g. 28KB JPEG generated on server)
  const inferredThumbUrl = useMemo(() => {
    if (!src || typeof src !== 'string') return null;
    if (src.includes('/uploads/')) {
      return src.replace(/\.[^/.]+$/, '') + '_thumb.jpg';
    }
    return null;
  }, [src]);

  const [imageThumbError, setImageThumbError] = useState(false);

  // Handle HTML5 video metadata
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      // Seek slightly into the video to avoid black introductory frames
      if (video.duration && video.duration > 2) {
        video.currentTime = Math.min(1.5, video.duration * 0.1);
      } else if (video.duration) {
        video.currentTime = 0.5;
      }

      if (onDurationLoaded && video.duration && !isNaN(video.duration)) {
        onDurationLoaded(video.duration);
      }
    } catch (e) {
      // Continue gracefully if browser limits seeking before user interaction
    }
    setMediaLoaded(true);
  };

  // Reset states when src changes
  useEffect(() => {
    setMediaLoaded(false);
    setLoadError(false);
    setImageThumbError(false);
  }, [src]);

  const activeThumbImage = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : (!imageThumbError ? inferredThumbUrl : null);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        borderRadius: '18px',
        backgroundColor: isDark ? '#0f172a' : '#1e293b',
        pointerEvents: 'none',
        ...style
      }}
    >
      {/* Background fallback gradient & pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isDark
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #022c22 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 0
        }}
      >
        {!mediaLoaded && (
          <Film size={44} color="rgba(255, 255, 255, 0.15)" />
        )}
      </div>

      {/* Lightweight Static Thumbnail Image (YouTube or Server-Generated _thumb.jpg) */}
      {activeThumbImage ? (
        <img
          src={activeThumbImage}
          alt={title}
          onLoad={() => setMediaLoaded(true)}
          onError={() => {
            if (inferredThumbUrl && !youtubeId) {
              setImageThumbError(true);
            } else {
              setLoadError(true);
            }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 1,
            opacity: mediaLoaded ? 1 : 0,
            transition: 'opacity 0.35s ease'
          }}
        />
      ) : src && !loadError ? (
        /* HTML5 Video Frame as Dynamic Fallback Thumbnail */
        <video
          ref={videoRef}
          src={`${src}#t=1`}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onSeeked={() => setMediaLoaded(true)}
          onLoadedData={() => setMediaLoaded(true)}
          onError={() => setLoadError(true)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
            zIndex: 1,
            opacity: mediaLoaded ? 1 : 0,
            transition: 'opacity 0.35s ease',
            filter: 'brightness(0.92)'
          }}
        />
      ) : null}

      {/* Modern gradient scrim / overlay to keep badges and play button ultra-readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.5) 0%, rgba(15, 23, 42, 0.1) 40%, rgba(15, 23, 42, 0.65) 100%)',
          pointerEvents: 'none',
          zIndex: 2
        }}
      />
    </div>
  );
}
