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
  pageBg:     '#000000',  // iOS systemGroupedBackground
  bg:         '#1C1C1E',  // iOS systemBackground
  card:       '#1C1C1E',  // iOS secondarySystemBackground
  text:       '#FFFFFF',  // iOS label
  textMuted:  '#8E8E93',  // iOS secondaryLabel
  textFaint:  '#48484A',  // iOS tertiaryLabel
  border:     '#38383A',  // iOS separator
  inputBg:    '#2C2C2E',  // iOS tertiarySystemBackground (elevated input)
  teal:       '#2dd4a8',
  tealFg:     '#042f2e',
  tealBg:     '#0d2b22',
  red:        '#f87171',
  tabBg:      '#1C1C1E',
  tabBorder:  '#38383A',
  tabActive:  '#2dd4a8',
  tabInactive:'#636366',  // iOS quaternaryLabel
  switchTrackOff: '#39393D',
  modalOverlay:   'rgba(0,0,0,0.6)',
};

export type AppColors = typeof lightColors;
export type ThemeMode = 'system' | 'light' | 'dark';
