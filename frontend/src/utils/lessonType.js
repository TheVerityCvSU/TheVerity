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
    if (['document', 'file', 'pdf', 'doc', 'image', 'video', 'youtube'].includes(t)) {
      return false;
    }
    const u = String(a?.url || '').toLowerCase();
    return t === 'link' || t === 'url' || (/^https?:\/\//i.test(u) && !u.includes('/uploads/'));
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
