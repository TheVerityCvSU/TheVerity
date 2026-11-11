import { useState, useEffect } from 'react';
import { getClassroomTheme } from '../../data/classroomTheme';

export function useClassroomBannerTheme(classroom) {
  const [theme, setTheme] = useState(() => getClassroomTheme(classroom));

  useEffect(() => {
    setTheme(getClassroomTheme(classroom));
  }, [classroom?.id, classroom?.code, classroom?.section, classroom?.name, classroom?.theme]);

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
  }, [classroom?.id, classroom?.code, classroom?.section, classroom?.name, classroom?.theme]);

  return theme;
}

