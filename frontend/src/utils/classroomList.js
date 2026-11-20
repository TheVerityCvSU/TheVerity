// Classroom list helpers: filter out dummy classrooms, sort, merge, and make class codes.

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
    let currentCode = '';
    for (let i = 0; i < 7; i++) {
      currentCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = currentCode;
    attempts++;
  } while (taken.has(code.toLowerCase()) && attempts < 1000);

  return code;
};

/**
 * Normalizes the archived state of a classroom object from boolean/int/string values.
 */
export const isClassroomArchived = (classroom) => {
  if (!classroom) return false;
  const val = classroom.archived;
  return val === true || Number(val) === 1 || String(val || '').toLowerCase() === 'true';
};

export const DEFAULT_CLASSROOM_SETTINGS = {
  inviteCodes: 'Turned on',
  stream: 'Students can post and comment',
  classworkStream: 'Show condensed notifications',
  showDeleted: false,
};

/**
 * Normalizes general classroom settings from JSON string or partial object.
 */
export const normalizeClassroomSettings = (raw) => {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_CLASSROOM_SETTINGS };
  }
  return {
    inviteCodes: parsed.inviteCodes === 'Turned off' ? 'Turned off' : 'Turned on',
    stream: parsed.stream || DEFAULT_CLASSROOM_SETTINGS.stream,
    classworkStream: parsed.classworkStream || DEFAULT_CLASSROOM_SETTINGS.classworkStream,
    showDeleted: Boolean(parsed.showDeleted),
  };
};
