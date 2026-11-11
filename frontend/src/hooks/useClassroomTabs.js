import { useState, useEffect, useRef } from 'react';

export const TAB_ORDER = { stream: 0, classwork: 1, people: 2, materials: 3 };

export const tabSlideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 50 : -50, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { x: { type: 'spring', stiffness: 350, damping: 30 }, opacity: { duration: 0.18 } } },
  exit: (direction) => ({ x: direction > 0 ? -50 : 50, opacity: 0, transition: { duration: 0.12, ease: 'easeIn' } }),
};

export const classroomSlideVariants = {
  enter: (direction) => ({ y: direction > 0 ? 35 : -35, opacity: 0 }),
  center: { y: 0, opacity: 1, transition: { y: { type: 'spring', stiffness: 350, damping: 30 }, opacity: { duration: 0.18 } } },
  exit: (direction) => ({ y: direction > 0 ? -35 : 35, opacity: 0, transition: { duration: 0.12, ease: 'easeIn' } }),
};

export function useClassroomTabs(classroom) {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const specific = classroom?.id ? sessionStorage.getItem(`verity_student_classroom_tab_${classroom.id}`) : null;
      if (specific && ['stream', 'classwork', 'materials'].includes(specific)) return specific;
      const generic = sessionStorage.getItem('verity_student_classroom_tab_active');
      if (generic && ['stream', 'classwork', 'materials'].includes(generic)) return generic;
    } catch {}
    return 'stream';
  });

  const [tabDirection, setTabDirection] = useState(1);
  const [transitionMode, setTransitionMode] = useState('tab');
  const prevClassroomIdRef = useRef(classroom?.id);

  useEffect(() => {
    if (classroom?.id && prevClassroomIdRef.current !== classroom?.id) {
      prevClassroomIdRef.current = classroom?.id;
      setTransitionMode('classroom');
    }
  }, [classroom?.id]);

  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    const currentIdx = TAB_ORDER[activeTab] ?? 0;
    const newIdx = TAB_ORDER[newTab] ?? 0;
    setTabDirection(newIdx >= currentIdx ? 1 : -1);
    setTransitionMode('tab');
    setActiveTab(newTab);
    try {
      if (classroom?.id) sessionStorage.setItem(`verity_student_classroom_tab_${classroom.id}`, newTab);
      sessionStorage.setItem('verity_student_classroom_tab_active', newTab);
    } catch {}
  };

  return {
    activeTab,
    tabDirection,
    transitionMode,
    handleTabChange
  };
}
