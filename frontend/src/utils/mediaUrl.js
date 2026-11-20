import { getConnectionStatus } from '../data/server/connectionStatus';
import { DEFAULT_CLOUD_API_URL, getCloudUrl, getLocalApiUrl, isPrivateHost } from '../data/server/serverUrls';

const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|mkv|avi)(\?.*)?$/i;
const OFFICE_DOC_EXT_RE = /\.(ppt|pptx|doc|docx)(\?.*)?$/i;

/**
 * Returns the active backend base URL for media uploads and /uploads playback.
 * Uses the Teacher/ComLab LAN host when in LAN/offline mode, and Cloud otherwise.
 */
export function getActiveUploadBaseUrl() {
  try {
    const status = getConnectionStatus();
    if (status.isWebHosted) {
      return (status.cloudUrl || getCloudUrl() || DEFAULT_CLOUD_API_URL).replace(/\/$/, '');
    }
    if ((status.activeMode === 'cloud' || status.userPreferredMode === 'cloud') && !status.isCloudDown) {
      return (status.cloudUrl || getCloudUrl() || DEFAULT_CLOUD_API_URL).replace(/\/$/, '');
    }
    return (status.localUrl || getLocalApiUrl()).replace(/\/$/, '');
  } catch (_) {
    return (getLocalApiUrl() || getCloudUrl() || DEFAULT_CLOUD_API_URL).replace(/\/$/, '');
  }
}

function isKnownVerityHost(hostname) {
  if (!hostname) return false;
  if (isPrivateHost(hostname)) return true;
  if (hostname === 'the-verity.onrender.com') return true;
  try {
    if (new URL(getCloudUrl()).hostname === hostname) return true;
  } catch (_) { }
  try {
    if (new URL(getLocalApiUrl()).hostname === hostname) return true;
  } catch (_) { }
  return false;
}

/**
 * Extracts a canonical `/uploads/<filename>` path if the URL belongs to a Verity server
 * (relative path, localhost, LAN IP, or Render cloud URL). Returns null for external links.
 */
export function extractUploadPath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return null;

  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }
  if (trimmed.startsWith('uploads/')) {
    return `/${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith('/uploads/')) {
        return `${parsed.pathname}${parsed.search || ''}${parsed.hash || ''}`;
      }
    } catch (_) { }
  }

  return null;
}

/**
 * Resolves any stored attachment or media URL against the currently active server
 * (LAN host in ComLab LAN mode, Cloud server in Cloud/Web mode).
 */
export function resolveMediaUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;

  const uploadPath = extractUploadPath(trimmed);
  if (uploadPath) {
    return `${getActiveUploadBaseUrl()}${uploadPath}`;
  }
  return trimmed;
}

/**
 * Derives the companion `_thumb.jpg` URL for a Verity-hosted video, or null.
 */
export function getVideoThumbnailUrl(rawUrl) {
  const uploadPath = extractUploadPath(rawUrl);
  if (!uploadPath) return null;
  const cleanPath = uploadPath.split('?')[0].split('#')[0];
  if (!VIDEO_EXT_RE.test(cleanPath)) return null;
  const thumbPath = cleanPath.replace(/\.[^/.]+$/, '_thumb.jpg');
  return `${getActiveUploadBaseUrl()}${thumbPath}`;
}

/**
 * Rewrites `/uploads/` URLs inside rich-text HTML descriptions to target the active
 * server, and enforces `preload="none"` + thumbnail `poster` on inline `<video>` tags
 * so 40 student browsers do not auto-buffer 2 GB videos when viewing instructions.
 */
export function resolveMediaUrlsInHtml(html) {
  if (!html || typeof html !== 'string') return '';

  let updated = html.replace(
    /(\b(?:src|href|poster)\s*=\s*)(["'])([^"']+)\2/gi,
    (full, prefix, quote, val) => {
      const resolved = resolveMediaUrl(val);
      return `${prefix}${quote}${resolved}${quote}`;
    }
  );

  updated = updated.replace(/<video\b([^>]*)>/gi, (full, attrs) => {
    let nextAttrs = attrs || '';
    if (/\bpreload\s*=/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\bpreload\s*=\s*(["'])[^"']*\1/gi, 'preload="none"');
    } else {
      nextAttrs += ' preload="none"';
    }

    if (!/\bposter\s*=/i.test(nextAttrs)) {
      const srcMatch = nextAttrs.match(/\bsrc\s*=\s*(["'])([^"']+)\1/i);
      if (srcMatch && srcMatch[2]) {
        const thumb = getVideoThumbnailUrl(srcMatch[2]);
        if (thumb) {
          nextAttrs += ` poster="${thumb}"`;
        }
      }
    }
    return `<video${nextAttrs}>`;
  });

  return updated;
}

export function isOfficeDocument(url = '', name = '') {
  return OFFICE_DOC_EXT_RE.test(String(name)) || OFFICE_DOC_EXT_RE.test(String(url));
}

export function isPrivateOrLocalUrl(rawUrl = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return true;
  if (rawUrl.startsWith('/') || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) return true;
  try {
    const parsed = new URL(rawUrl);
    return isPrivateHost(parsed.hostname);
  } catch (_) {
    return true;
  }
}
