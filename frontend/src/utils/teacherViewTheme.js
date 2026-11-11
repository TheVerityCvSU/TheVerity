export function getTeacherViewTheme(isDark) {
  if (isDark) {
    return {
      bg: '#18181b',
      headerBg: '#27272a',
      sidebarBg: '#202023',
      cardBg: '#27272a',
      border: '#3f3f46',
      borderSubtle: '#27272a',
      textPrimary: '#f4f4f5',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      accent: '#10b981',
      accentBg: 'rgba(16, 185, 129, 0.12)',
      activePill: '#3f3f46',
      inactivePill: '#27272a',
      hoverPill: '#323236',
      terminalBg: '#18181b',
      terminalHeader: '#202023'
    };
  }
  return {
    bg: '#f1f5f9',
    headerBg: '#ffffff',
    sidebarBg: '#f8fafc',
    cardBg: '#ffffff',
    border: '#e2e8f0',
    borderSubtle: '#edf2f7',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    accent: '#059669',
    accentBg: 'rgba(5, 150, 105, 0.1)',
    activePill: '#e2e8f0',
    inactivePill: '#ffffff',
    hoverPill: '#f1f5f9',
    terminalBg: '#ffffff',
    terminalHeader: '#f8fafc'
  };
}
