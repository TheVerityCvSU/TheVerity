export const cardThemes = [
  { // 0: Emerald Books
    id: 'emerald_books',
    name: 'Emerald Books',
    primary: '#137333',
    secondary: '#1e8e3e',
    gradient: 'linear-gradient(135deg, #137333 0%, #1e8e3e 100%)',
    textColor: 'white',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#ffffff',
    status: 'ACTIVE',
    statusColor: '#dcfce7',
    colSpan: 7
  },
  { // 1: Ocean Academia
    id: 'ocean_academia',
    name: 'Ocean Academia',
    primary: '#1a73e8',
    secondary: '#0d47a1',
    gradient: 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)',
    textColor: 'white',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#ffffff',
    status: 'ACTIVE',
    statusColor: '#93c5fd',
    colSpan: 5
  },
  { // 2: Royal Violet
    id: 'royal_violet',
    name: 'Royal Violet',
    primary: '#7c3aed',
    secondary: '#581c87',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #581c87 100%)',
    textColor: 'white',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#ffffff',
    status: 'ACTIVE',
    statusColor: '#f3e8ff',
    colSpan: 5
  },
  { // 3: Warm Amber
    id: 'warm_amber',
    name: 'Warm Amber',
    primary: '#ea580c',
    secondary: '#9a3412',
    gradient: 'linear-gradient(135deg, #ea580c 0%, #9a3412 100%)',
    textColor: 'white',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#ffffff',
    status: 'ACTIVE',
    statusColor: '#ffedd5',
    colSpan: 7
  },
  { // 4: Midnight Tech
    id: 'midnight_slate',
    name: 'Midnight Tech',
    primary: '#0f172a',
    secondary: '#1e293b',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    textColor: 'white',
    pillBg: 'rgba(255, 255, 255, 0.22)',
    pillText: '#ffffff',
    status: 'ACTIVE',
    statusColor: '#cbd5e1',
    colSpan: 12
  }
];

export const VIEW_ORDER = {
  classrooms: 0,
  calendar: 1,
  archived: 2,
  compiler: 3,
  settings: 4
};

export const drillVariants = {
  initial: (direction) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: 'easeOut' }
  },
  exit: (direction) => ({
    x: direction < 0 ? 40 : -40,
    opacity: 0,
    transition: { duration: 0.15, ease: 'easeIn' }
  })
};

