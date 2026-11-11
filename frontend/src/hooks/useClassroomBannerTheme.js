import { useState, useEffect } from 'react';
import { getClassroomTheme, saveClassroomTheme } from '../data/classroomTheme';

export function useClassroomBannerTheme({ classroom, socket }) {
  const [bannerTheme, setBannerTheme] = useState(() => getClassroomTheme(classroom));

  useEffect(() => {
    setBannerTheme(getClassroomTheme(classroom));
  }, [classroom?.id, classroom?.code, classroom?.section, classroom?.name, classroom?.theme]);

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
        saveClassroomTheme(classroom, detail.theme, null);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setBannerTheme(getClassroomTheme(classroom));
    };

    window.addEventListener('verity:banner-updated', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibility);
    if (socket) socket.on('classroom_theme_changed', (data) => handleUpdate({ detail: data }));

    return () => {
      window.removeEventListener('verity:banner-updated', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (socket) socket.off('classroom_theme_changed');
    };
  }, [classroom, socket]);

  return { bannerTheme };
}
