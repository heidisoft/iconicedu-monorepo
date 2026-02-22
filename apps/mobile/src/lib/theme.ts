export const lightColors = {
  pageBg:     '#f8fafc',
  bg:         '#ffffff',
  card:       '#ffffff',
  text:       '#0f172a',
  textMuted:  '#64748b',
  textFaint:  '#94a3b8',
  border:     '#e2e8f0',
  inputBg:    '#f8fafc',
  teal:       '#2dd4a8',
  tealFg:     '#042f2e',
  tealBg:     '#f0fdf9',
  red:        '#ef4444',
  tabBg:      '#ffffff',
  tabBorder:  '#e2e8f0',
  tabActive:  '#2dd4a8',
  tabInactive:'#94a3b8',
  switchTrackOff: '#e2e8f0',
  modalOverlay:   'rgba(0,0,0,0.4)',
};

export const darkColors: typeof lightColors = {
  pageBg:     '#0f172a',
  bg:         '#1e293b',
  card:       '#1e293b',
  text:       '#f8fafc',
  textMuted:  '#94a3b8',
  textFaint:  '#64748b',
  border:     '#334155',
  inputBg:    '#1e293b',
  teal:       '#2dd4a8',
  tealFg:     '#042f2e',
  tealBg:     '#0d2b22',
  red:        '#f87171',
  tabBg:      '#0f172a',
  tabBorder:  '#1e293b',
  tabActive:  '#2dd4a8',
  tabInactive:'#64748b',
  switchTrackOff: '#334155',
  modalOverlay:   'rgba(0,0,0,0.6)',
};

export type AppColors = typeof lightColors;
export type ThemeMode = 'system' | 'light' | 'dark';
