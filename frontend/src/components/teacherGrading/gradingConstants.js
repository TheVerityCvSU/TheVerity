export const getScorePresets = (maxPoints) => {
  const list = [
    maxPoints,
    Math.round(maxPoints * 0.95),
    Math.round(maxPoints * 0.9),
    Math.round(maxPoints * 0.85),
    Math.round(maxPoints * 0.8),
    Math.round(maxPoints * 0.75),
    Math.round(maxPoints * 0.7),
    0
  ];
  return Array.from(new Set(list));
};

export const QUICK_FEEDBACK_SUGGESTIONS = [
  'Great job! Clean and well structured code.',
  'Good implementation, all requirements met.',
  'Solid attempt! Make sure to test edge cases.',
  'Check variable naming and indentation style.',
  'Needs better error handling and comments.'
];

