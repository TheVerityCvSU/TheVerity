// Video title helpers: turn a video filename or lesson title into a readable title.

/**
 * Cleans a video filename or raw title into a human-readable title.
 * Strips file extensions, timestamp prefixes, splits camelCase, and cleans delimiters.
 */
export const cleanVideoFilename = (filename) => {
  if (!filename || typeof filename !== 'string') return '';
  // Strip file extension
  let name = filename.replace(/\.(mp4|webm|mov|m4v|mkv|avi|flv|wmv)$/i, '');
  // Strip leading upload timestamp prefix (e.g. 1792768564903_ or 1792768564903-)
  name = name.replace(/^\d{10,}[-_]/, '');
  // If camelCase / PascalCase without spaces/underscores (e.g. BigBuckBunny -> Big Buck Bunny)
  if (!name.includes(' ') && !name.includes('_') && !name.includes('-')) {
    name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  // Replace underscores and consecutive hyphens with space
  name = name.replace(/[-_]+/g, ' ').trim();
  return name;
};

/**
 * Checks if a title is a generic placeholder or obsolete hardcoded mockup string.
 */
export const isGenericPlaceholder = (title) => {
  if (!title || typeof title !== 'string') return true;
  return /^(methods\s*&\s*parameters|methods\s*and\s*parameters|untitled|sample\s*video|c#\s*programming)$/i.test(title.trim());
};

/**
 * Checks if a filename is overly generic (e.g., "video", "lesson", "output").
 */
export const isGenericFilename = (title) => {
  if (!title || typeof title !== 'string') return true;
  return /^(video|output|recording|lesson|sample|material|file|mov\s*bbb)$/i.test(title.trim());
};

/**
 * Resolves the genuine title of a video lesson, prioritizing specific video filenames
 * or meaningful activity titles while guaranteeing that placeholder strings like
 * "Methods & parameters" are never displayed.
 */
export const extractVideoTitle = (src, videoAttachment, itemTitle) => {
  // 1. Video attachment name / title if available
  const attachmentName = videoAttachment?.name || videoAttachment?.title;
  if (attachmentName) {
    const clean = cleanVideoFilename(attachmentName);
    if (clean && !isGenericFilename(clean) && !isGenericPlaceholder(clean)) {
      return clean;
    }
  }

  // 2. Video src URL filename if available
  if (src && typeof src === 'string') {
    try {
      const pathname = src.split('?')[0].split('#')[0];
      const rawFilename = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (rawFilename && rawFilename.includes('.')) {
        const clean = cleanVideoFilename(decodeURIComponent(rawFilename));
        if (clean && !isGenericFilename(clean) && !isGenericPlaceholder(clean)) {
          return clean;
        }
      }
    } catch {}
  }

  // 3. Activity / Classwork item title if descriptive
  if (itemTitle && typeof itemTitle === 'string') {
    const trimmed = itemTitle.trim();
    if (trimmed && !isGenericPlaceholder(trimmed) && !/^(lesson|material|activity)$/i.test(trimmed)) {
      return trimmed;
    }
  }

  // 4. Fallback to cleaned filename even if generic
  if (attachmentName) {
    const clean = cleanVideoFilename(attachmentName);
    if (clean && !isGenericPlaceholder(clean)) return clean;
  }
  if (src && typeof src === 'string') {
    try {
      const pathname = src.split('?')[0].split('#')[0];
      const rawFilename = pathname.substring(pathname.lastIndexOf('/') + 1);
      const clean = cleanVideoFilename(decodeURIComponent(rawFilename));
      if (clean && !isGenericPlaceholder(clean)) return clean;
    } catch {}
  }

  // 5. Fallback to item title if present and not placeholder
  if (itemTitle && typeof itemTitle === 'string' && !isGenericPlaceholder(itemTitle)) {
    return itemTitle.trim();
  }

  return 'Video Lesson';
};
