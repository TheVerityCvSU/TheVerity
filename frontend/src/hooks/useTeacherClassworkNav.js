import { useState, useRef, useEffect } from 'react';
import { TAB_ORDER } from '../utils/teacherClassworkUtils';

export function useTeacherClassworkNav({ classroom, onEnterClassroom, activeClassrooms = [] }) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const handleExit = (action) => {
    setIsFadingOut(true);
    setTimeout(() => action(), 100);
  };

  const [indicatorStyle, setIndicatorStyle] = useState({
    top: 0,
    left: 0,
    width: 0,
    opacity: 0,
    transition: 'none'
  });
  const navRefs = useRef({});

  // Active classroom tab
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const perClassTab = sessionStorage.getItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`);
      if (perClassTab && TAB_ORDER[perClassTab] !== undefined) return perClassTab;
      const activeTabGlobal = sessionStorage.getItem('verity_teacher_classwork_tab_active');
      if (activeTabGlobal && TAB_ORDER[activeTabGlobal] !== undefined) return activeTabGlobal;
      return 'stream';
    } catch {
      return 'stream';
    }
  });

  const [tabDirection, setTabDirection] = useState(1);
  const [transitionMode, setTransitionMode] = useState('tab'); // 'classroom' | 'tab'
  const [classroomDirection, setClassroomDirection] = useState(1);
  const [prevClassroomId, setPrevClassroomId] = useState(classroom?.id);

  if (classroom?.id && prevClassroomId !== classroom?.id) {
    setPrevClassroomId(classroom.id);
    setTransitionMode('classroom');
    try {
      const savedTab =
        sessionStorage.getItem(`verity_teacher_classwork_tab_${classroom.id}`) ||
        sessionStorage.getItem('verity_teacher_classwork_tab_active');
      if (savedTab && TAB_ORDER[savedTab] !== undefined) {
        setActiveTab(savedTab);
      }
    } catch {}
  }

  useEffect(() => {
    try {
      if (activeTab) {
        sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, activeTab);
        sessionStorage.setItem('verity_teacher_classwork_tab_active', activeTab);
      }
    } catch {}
  }, [activeTab, classroom?.id]);

  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    const currentIdx = TAB_ORDER[activeTab] ?? 0;
    const newIdx = TAB_ORDER[newTab] ?? 0;
    setTabDirection(newIdx >= currentIdx ? 1 : -1);
    setTransitionMode('tab');
    setActiveTab(newTab);
    try {
      sessionStorage.setItem(`verity_teacher_classwork_tab_${classroom?.id || 'default'}`, newTab);
      sessionStorage.setItem('verity_teacher_classwork_tab_active', newTab);
    } catch {}
  };

  const handleSelectClassroom = (cls, idx) => {
    if (String(cls.id) === String(classroom?.id)) {
      if (activeTab !== 'stream') {
        handleTabChange('stream');
      }
      return;
    }
    const currentIdx = activeClassrooms.findIndex((c) => String(c.id) === String(classroom?.id));
    const targetIdx = idx;
    const dir = currentIdx === -1 || targetIdx >= currentIdx ? 1 : -1;
    setClassroomDirection(dir);
    setTransitionMode('classroom');
    if (onEnterClassroom) onEnterClassroom(cls);
  };

  return {
    activeTab,
    setActiveTab,
    handleTabChange,
    tabDirection,
    transitionMode,
    classroomDirection,
    handleSelectClassroom,
    indicatorStyle,
    setIndicatorStyle,
    navRefs,
    isFadingOut,
    handleExit
  };
}
