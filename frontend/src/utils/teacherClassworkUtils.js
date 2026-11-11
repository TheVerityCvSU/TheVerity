export const EMPTY_FORM = {
  title: '',
  activityType: 'Activity',
  noDueDate: true,
  dueDate: '',
  instruction: '',
  points: '100',
  grading: 'On',
  attachments: [],
  duration: 60,
  autoSaveInterval: '30s',
  treatWarningsAsErrors: false,
  disableBack: false,
  testCases: []
};

export const isLegacyHardcoded = (item) =>
  (item?.id === 1 || item?.id === 2) &&
  (item?.title?.startsWith('Activity 1:') || item?.title?.startsWith('Activity 2:'));

export const TAB_ORDER = { stream: 0, classwork: 1, materials: 2, people: 3, grades: 4 };

export const tabSlideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { type: 'spring', stiffness: 350, damping: 30 },
      opacity: { duration: 0.18 }
    }
  },
  exit: (direction) => ({
    x: direction > 0 ? -50 : 50,
    opacity: 0,
    transition: {
      duration: 0.12,
      ease: 'easeIn'
    }
  })
};

export const classroomSlideVariants = {
  enter: (direction) => ({
    y: direction > 0 ? 35 : -35,
    opacity: 0
  }),
  center: {
    y: 0,
    opacity: 1,
    transition: {
      y: { type: 'spring', stiffness: 350, damping: 30 },
      opacity: { duration: 0.18 }
    }
  },
  exit: (direction) => ({
    y: direction > 0 ? -35 : 35,
    opacity: 0,
    transition: {
      duration: 0.12,
      ease: 'easeIn'
    }
  })
};
