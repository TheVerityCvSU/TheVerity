/**
 * Checks if a classroom object is a phantom/dummy classroom.
 */
export const isPhantomClassroom = (c) => {
  if (!c || !c.name) return true;
  const name = String(c.name).trim();
  const hasDummyName = /^Classroom \d+$/i.test(name);
  const hasNoDetails = (!c.section || !String(c.section).trim()) && (!c.subject || !String(c.subject).trim());
  return hasDummyName && hasNoDetails;
};

/**
 * Sorts an array of classrooms strictly alphabetically by name (case-insensitive, natural number order).
 */
export const sortClassroomsAlphabetically = (list) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const nameA = (a && a.name) ? String(a.name).trim() : '';
    const nameB = (b && b.name) ? String(b.name).trim() : '';
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
  });
};

/**
 * Merges freshly fetched server classrooms into the existing classroom list while
 * ensuring the list is strictly ordered alphabetically by name.
 */
export const mergeClassroomsPreservingOrder = (currentList, serverList) => {
  if (!Array.isArray(serverList) || serverList.length === 0) {
    const filtered = Array.isArray(currentList) ? currentList.filter(c => !isPhantomClassroom(c)) : [];
    return sortClassroomsAlphabetically(filtered);
  }
  const validServerList = serverList.filter(c => !isPhantomClassroom(c));
  if (!Array.isArray(currentList) || currentList.length === 0) {
    return sortClassroomsAlphabetically(validServerList);
  }

  const serverMap = new Map();
  validServerList.forEach(c => serverMap.set(String(c.id), c));

  const updated = currentList
    .filter(c => !isPhantomClassroom(c) && serverMap.has(String(c.id)))
    .map(c => ({
      ...c,
      ...serverMap.get(String(c.id))
    }));

  const existingIds = new Set(updated.map(c => String(c.id)));
  const newClasses = validServerList.filter(c => !existingIds.has(String(c.id)));

  return sortClassroomsAlphabetically([...updated, ...newClasses]);
};

/**
 * Generates a clean, 7-character lowercase alphanumeric class code (e.g. "g4xj7q2")
 * guaranteed to not collide with any code in the provided list/set of classrooms or codes.
 */
export const generateClassCode = (existingListOrCodes = []) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const taken = new Set();

  if (Array.isArray(existingListOrCodes)) {
    existingListOrCodes.forEach(item => {
      if (!item) return;
      if (typeof item === 'string') taken.add(item.trim().toLowerCase());
      else if (item.code) taken.add(String(item.code).trim().toLowerCase());
    });
  } else if (existingListOrCodes instanceof Set) {
    existingListOrCodes.forEach(item => {
      if (item) taken.add(String(item).trim().toLowerCase());
    });
  }

  let code = '';
  let attempts = 0;
  do {
    code = '';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (taken.has(code.toLowerCase()) && attempts < 1000);

  return code;
};

/**
 * Banner Themes Configuration (Shared across Teacher, Student & Cards)
 */
export const THEME_PRESETS = [
  {
    id: 'emerald_books',
    name: 'Emerald Books',
    primary: '#137333',
    secondary: '#1e8e3e',
    textColor: '#ffffff',
    description: 'Classic green with notebooks and stationery'
  },
  {
    id: 'ocean_academia',
    name: 'Ocean Academia',
    primary: '#1a73e8',
    secondary: '#0d47a1',
    textColor: '#ffffff',
    description: 'Scholarly blue with geometry and math graphics'
  },
  {
    id: 'royal_violet',
    name: 'Royal Violet',
    primary: '#7c3aed',
    secondary: '#581c87',
    textColor: '#ffffff',
    description: 'Vibrant purple for creative arts and design'
  },
  {
    id: 'warm_amber',
    name: 'Warm Amber',
    primary: '#ea580c',
    secondary: '#9a3412',
    textColor: '#ffffff',
    description: 'Warm harvest tone with literature aesthetics'
  },
  {
    id: 'midnight_slate',
    name: 'Midnight Tech',
    primary: '#0f172a',
    secondary: '#1e293b',
    textColor: '#ffffff',
    description: 'Sleek dark theme for programming and CS'
  }
];

import { apiFetch } from './api';

/**
 * Returns all potential storage keys for a classroom object to guarantee matching
 * between teacher and student views regardless of whether classroom is identified
 * by id, code, section, or name.
 */
export const getThemeStorageKeys = (classroom) => {
  const keys = [];
  if (!classroom) return [];

  if (classroom.id !== undefined && classroom.id !== null) {
    keys.push(`verity_classroom_theme_${classroom.id}`);
  }
  if (classroom.code) {
    keys.push(`verity_classroom_theme_code_${String(classroom.code).trim().toLowerCase()}`);
  }
  if (classroom.section) {
    keys.push(`verity_classroom_theme_code_${String(classroom.section).trim().toLowerCase()}`);
  }
  if (classroom.name) {
    keys.push(`verity_classroom_theme_name_${String(classroom.name).trim().toLowerCase()}`);
  }
  return keys;
};

/**
 * Resolves the active theme for a classroom object.
 */
export const getClassroomTheme = (classroom) => {
  if (classroom?.theme) {
    if (typeof classroom.theme === 'object') return classroom.theme;
    if (typeof classroom.theme === 'string') {
      try {
        const parsed = JSON.parse(classroom.theme);
        if (parsed && (parsed.primary || parsed.customImageUrl || parsed.id)) {
          return parsed;
        }
      } catch {}
    }
  }
  const keys = getThemeStorageKeys(classroom);
  for (const key of keys) {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.primary || parsed.customImageUrl || parsed.id)) {
          return parsed;
        }
      }
    } catch {}
  }
  // Default preset based on classroom ID hash
  const idx = Math.abs(Number(classroom?.id) || 0) % THEME_PRESETS.length;
  return THEME_PRESETS[idx] || THEME_PRESETS[0];
};

/**
 * Saves classroom theme across all canonical keys, updates local caches,
 * dispatches local events, emits socket event, and updates server DB via REST API.
 */
export const saveClassroomTheme = (classroom, theme, socket = null) => {
  if (!theme) return;
  const themeJson = JSON.stringify(theme);
  const keys = getThemeStorageKeys(classroom);

  keys.forEach(key => {
    try {
      localStorage.setItem(key, themeJson);
    } catch {}
  });

  // Sync to stored classroom objects in localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('verity_teacher_classrooms') || k.startsWith('verity_student_classrooms') || k === 'verity_classrooms' || k === 'verity_global_classrooms')) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              let updatedAny = false;
              const updatedArr = arr.map(c => {
                if (
                  (classroom?.id != null && String(c.id) === String(classroom.id)) ||
                  (classroom?.code && c.code && String(c.code).toLowerCase() === String(classroom.code).toLowerCase()) ||
                  (classroom?.section && c.section && String(c.section).toLowerCase() === String(classroom.section).toLowerCase()) ||
                  (classroom?.name && c.name && String(c.name).toLowerCase() === String(classroom.name).toLowerCase())
                ) {
                  updatedAny = true;
                  return { ...c, theme };
                }
                return c;
              });
              if (updatedAny) {
                localStorage.setItem(k, JSON.stringify(updatedArr));
              }
            }
          }
        } catch {}
      }
    }
  }

  const detailPayload = {
    classroomId: classroom?.id,
    code: classroom?.code || classroom?.section,
    name: classroom?.name,
    theme,
    keys
  };

  // Dispatch custom window event
  window.dispatchEvent(new CustomEvent('verity:banner-updated', { detail: detailPayload }));

  // Emit socket event for real-time server/client propagation
  if (socket) {
    socket.emit('classroom_theme_updated', detailPayload);
  }

  // Persist to backend database via REST API
  if (classroom?.id) {
    apiFetch(`/classrooms/${classroom.id}/theme`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme })
    }).catch(err => {
      console.warn('[ClassroomTheme] Failed to save theme via API:', err?.message || err);
    });
  }
};

/**
 * Returns a primary localStorage key for user classrooms.
 * Prioritizes user?.id so the key stays constant even when email changes.
 */
export const getClassroomStorageKey = (user, role = 'student') => {
  const isTeacher = role === 'teacher' || role === 'Teacher' || role === 'instructor' || role === 'Instructor';
  const prefix = isTeacher ? 'verity_teacher_classrooms' : 'verity_student_classrooms';
  const identifier = user?.id || user?.email || (user?.name ? user.name.toLowerCase().replace(/\s+/g, '_') : null);
  return identifier ? `${prefix}_${identifier}` : `${prefix}_anon`;
};

/**
 * Safely retrieves cached classrooms from localStorage.
 * Checks user.id key, then user.email key, then username key, then default key.
 */
export const getCachedClassrooms = (user, role = 'student') => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const isTeacher = role === 'teacher' || role === 'Teacher' || role === 'instructor' || role === 'Instructor';
  const prefix = isTeacher ? 'verity_teacher_classrooms' : 'verity_student_classrooms';

  // 1. Try stable user.id key
  if (user?.id) {
    try {
      const raw = localStorage.getItem(`${prefix}_${user.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return sortClassroomsAlphabetically(parsed);
      }
    } catch {}
  }

  // 2. Try email key (legacy or previous email)
  if (user?.email) {
    try {
      const raw = localStorage.getItem(`${prefix}_${user.email}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Self-heal: copy to id-based key
          if (user?.id) {
            try { localStorage.setItem(`${prefix}_${user.id}`, raw); } catch {}
          }
          return sortClassroomsAlphabetically(parsed);
        }
      }
    } catch {}
  }

  // 3. Try name key
  if (user?.name) {
    try {
      const cleanName = user.name.toLowerCase().replace(/\s+/g, '_');
      const raw = localStorage.getItem(`${prefix}_${cleanName}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return sortClassroomsAlphabetically(parsed);
      }
    } catch {}
  }

  // 4. Try generic/default fallbacks ONLY for unauthenticated / demo users without user id or email
  if (!user?.id && !user?.email) {
    for (const fallbackKey of [`${prefix}_default`, `${prefix}_anon`, 'verity_cached_classrooms']) {
      try {
        const raw = localStorage.getItem(fallbackKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return sortClassroomsAlphabetically(parsed);
        }
      } catch {}
    }
  }

  return [];
};

/**
 * Persists classrooms to localStorage under both stable id and email keys.
 */
export const saveCachedClassrooms = (classrooms, user, role = 'student') => {
  if (typeof window === 'undefined' || !window.localStorage || !Array.isArray(classrooms)) return;
  const isTeacher = role === 'teacher' || role === 'Teacher' || role === 'instructor' || role === 'Instructor';
  const prefix = isTeacher ? 'verity_teacher_classrooms' : 'verity_student_classrooms';
  const sorted = sortClassroomsAlphabetically(classrooms);
  const json = JSON.stringify(sorted);

  if (user?.id) {
    try { localStorage.setItem(`${prefix}_${user.id}`, json); } catch {}
  }
  if (user?.email) {
    try { localStorage.setItem(`${prefix}_${user.email}`, json); } catch {}
  }
  // Only write to default if anonymous / demo user
  if (!user?.id && !user?.email) {
    try { localStorage.setItem(`${prefix}_default`, json); } catch {}
  }
};

/**
 * Migrates cached classrooms when a user verifies and switches to a new email address.
 */
export const migrateUserClassroomsOnEmailChange = (oldEmail, newEmail, userId) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const prefixes = ['verity_teacher_classrooms', 'verity_student_classrooms'];
  prefixes.forEach(prefix => {
    let existingData = null;
    if (userId) {
      existingData = localStorage.getItem(`${prefix}_${userId}`);
    }
    if (!existingData && oldEmail) {
      existingData = localStorage.getItem(`${prefix}_${oldEmail}`);
    }
    if (existingData) {
      if (newEmail) {
        try { localStorage.setItem(`${prefix}_${newEmail}`, existingData); } catch {}
      }
      if (userId) {
        try { localStorage.setItem(`${prefix}_${userId}`, existingData); } catch {}
      }
    }
  });
};

/**
 * Resolves the lesson/material format: 'video' | 'link' | 'document'
 * Inspects explicit materialType, attachments, embedded content, and titles.
 */
export const getLessonType = (item) => {
  if (!item) return 'document';

  // 1. Explicit property
  const explicit = String(item.materialType || item.lessonType || item.format || '').trim().toLowerCase();
  if (explicit === 'video' || explicit === 'youtube') return 'video';
  if (explicit === 'link' || explicit === 'url') return 'link';
  if (explicit === 'document' || explicit === 'doc' || explicit === 'file' || explicit === 'pdf') return 'document';

  // 2. Inspect attachments array
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];

  const hasVideo = attachments.some((a) => {
    const t = String(a?.type || '').toLowerCase();
    const u = String(a?.url || '').toLowerCase();
    const n = String(a?.name || '').toLowerCase();
    return (
      t === 'video' ||
      t === 'youtube' ||
      u.includes('youtube.com') ||
      u.includes('youtu.be') ||
      u.includes('vimeo.com') ||
      /\.(mp4|webm|mov|m4v|mkv|avi)(\?|$)/i.test(u) ||
      /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(n)
    );
  });
  if (hasVideo) return 'video';

  const hasLink = attachments.some((a) => {
    const t = String(a?.type || '').toLowerCase();
    const u = String(a?.url || '').toLowerCase();
    return t === 'link' || t === 'url' || /^https?:\/\//i.test(u);
  });

  const hasDoc = attachments.some((a) => {
    const t = String(a?.type || '').toLowerCase();
    const u = String(a?.url || '').toLowerCase();
    const n = String(a?.name || '').toLowerCase();
    return (
      t === 'document' ||
      t === 'file' ||
      t === 'pdf' ||
      t === 'doc' ||
      t === 'image' ||
      /\.(pdf|docx?|txt|pptx?|xlsx?|rtf|epub|png|jpe?g|gif|webp)(\?|$)/i.test(u) ||
      /\.(pdf|docx?|txt|pptx?|xlsx?|rtf|epub|png|jpe?g|gif|webp)$/i.test(n)
    );
  });

  if (hasDoc && !hasLink) return 'document';
  if (hasLink && !hasDoc) return 'link';
  if (hasLink) return 'link';
  if (hasDoc) return 'document';

  // 3. Inspect details / HTML content
  const details = String(item.details || item.instruction || '').toLowerCase();
  if (
    details.includes('<video') ||
    details.includes('youtube.com/embed') ||
    details.includes('youtube.com/watch') ||
    details.includes('youtu.be/') ||
    details.includes('vimeo.com/')
  ) {
    return 'video';
  }
  if (details.includes('<iframe') && (details.includes('video') || details.includes('player'))) {
    return 'video';
  }
  if (details.includes('<a href=') && !details.includes('<img')) {
    return 'link';
  }

  // 4. Inspect title / topic keywords
  const title = String(item.title || item.topic || '').toLowerCase();
  if (
    title.includes('video') ||
    title.includes('recording') ||
    title.includes('lecture') ||
    title.includes('watch') ||
    title.includes('webinar')
  ) {
    return 'video';
  }
  if (
    title.includes('link') ||
    title.includes('url') ||
    title.includes('website') ||
    title.includes('portal')
  ) {
    return 'link';
  }
  if (
    title.includes('doc') ||
    title.includes('pdf') ||
    title.includes('reading') ||
    title.includes('syllabus') ||
    title.includes('handout') ||
    title.includes('notes') ||
    title.includes('guide')
  ) {
    return 'document';
  }

  // Default fallback for lessons/materials: document
  return 'document';
};

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
/**
 * Formats a duration in seconds, numbers, or timestamps into standard video timestamps (e.g. 52:21, 1:04:15, 0:45)
 */
export const formatVideoTimestamp = (seconds) => {
  if (seconds == null || seconds === '') return null;
  if (typeof seconds === 'string') {
    const trimmed = seconds.trim();
    // If it's already a timestamp format like "52:21" or "00:52:21"
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const parts = trimmed.split(':');
      if (parts.length === 3 && parts[0] === '00') {
        return `${parts[1]}:${parts[2]}`;
      }
      return trimmed;
    }
    // If it's generic "25 min" / "25 mins", treat as unformatted so real timestamp is used
    if (/^\d+\s*mins?$/i.test(trimmed)) {
      return null;
    }
    const num = parseFloat(trimmed);
    if (!isNaN(num) && num > 0) seconds = num;
    else return null;
  }
  if (isNaN(seconds) || seconds <= 0) return null;
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
};
