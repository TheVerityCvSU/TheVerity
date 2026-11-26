import { useState, useEffect } from 'react';
import { getClassroomTheme, applyClassroomThemeLocally } from '../data/classroomTheme';

export function useClassroomBannerTheme({ classroom, socket }) {
  const classroomKey = `${classroom?.id ?? ''}|${classroom?.code ?? ''}|${classroom?.section ?? ''}|${classroom?.name ?? ''}|${typeof classroom?.theme === 'string' ? classroom.theme : JSON.stringify(classroom?.theme || null)}`;
  const [prevKey, setPrevKey] = useState(classroomKey);
  const [bannerTheme, setBannerTheme] = useState(() => getClassroomTheme(classroom));

  if (classroomKey !== prevKey) {
    setPrevKey(classroomKey);
    setBannerTheme(getClassroomTheme(classroom));
  }

  useEffect(() => {
    const handleUpdate = (e) => {
      const detail = e.detail;
      if (!detail) return;
      const matches =
        (classroom?.id != null && String(detail.classroomId) === String(classroom.id)) ||
        (classroom?.code && detail.code && String(detail.code).toLowerCase() === String(classroom.code).toLowerCase()) ||
        (classroom?.section && detail.code && String(detail.code).toLowerCase() === String(classroom.section).toLowerCase()) ||
        (classroom?.name && detail.name && String(detail.name).toLowerCase() === String(classroom.name).toLowerCase()) ||
        (detail.keys && detail.keys.includes(`verity_classroom_theme_${classroom?.id}`));

      if (matches && detail.theme) {
        setBannerTheme(detail.theme);
        applyClassroomThemeLocally(classroom, detail.theme);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setBannerTheme(getClassroomTheme(classroom));
    };

    const handleSocketThemeChanged = (data) => handleUpdate({ detail: data });

    window.addEventListener('verity:banner-updated', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibility);
    if (socket) socket.on('classroom_theme_changed', handleSocketThemeChanged);

    return () => {
      window.removeEventListener('verity:banner-updated', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (socket) socket.off('classroom_theme_changed', handleSocketThemeChanged);
    };
  }, [classroom, socket]);

  return { bannerTheme };
}
