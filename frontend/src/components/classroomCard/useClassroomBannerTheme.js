import { useState, useEffect } from 'react';
import { getClassroomTheme } from '../../data/classroomTheme';

export function useClassroomBannerTheme(classroom) {
  const classroomKey = `${classroom?.id ?? ''}|${classroom?.code ?? ''}|${classroom?.section ?? ''}|${classroom?.name ?? ''}|${typeof classroom?.theme === 'string' ? classroom.theme : JSON.stringify(classroom?.theme || null)}`;
  const [prevKey, setPrevKey] = useState(classroomKey);
  const [theme, setTheme] = useState(() => getClassroomTheme(classroom));

  if (classroomKey !== prevKey) {
    setPrevKey(classroomKey);
    setTheme(getClassroomTheme(classroom));
  }

  useEffect(() => {
    const handleBannerUpdate = (e) => {
      const detail = e.detail;
      if (!detail) return;
      const matches =
        (classroom?.id != null && String(detail.classroomId) === String(classroom.id)) ||
        (classroom?.code && detail.code && String(detail.code).toLowerCase() === String(classroom.code).toLowerCase()) ||
        (classroom?.section && detail.code && String(detail.code).toLowerCase() === String(classroom.section).toLowerCase()) ||
        (classroom?.name && detail.name && String(detail.name).toLowerCase() === String(classroom.name).toLowerCase()) ||
        (detail.keys && detail.keys.includes(`verity_classroom_theme_${classroom?.id}`));

      if (matches && detail.theme) {
        setTheme(detail.theme);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTheme(getClassroomTheme(classroom));
      }
    };

    window.addEventListener('verity:banner-updated', handleBannerUpdate);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('verity:banner-updated', handleBannerUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [classroom]);

  return theme;
}

