import { Platform } from 'react-native';
import { APP_LAYOUT, NAV_THEME, THEME } from '@iconicedu/ui-native/theme';

// ─── Platform-canonical dark surfaces ─────────────────────────────────────────
// One primary dark color per platform, applied uniformly so the nav bar,
// tab bar, and page background all share the same base tone.
//   iOS    → #1C1C1E  (UIColor.systemBackground in Dark Mode)
//   Android → #121212  (Material Design 3 dark surface)
const DARK_BASE = Platform.select({ ios: '#1C1C1E', default: '#121212' }) as string;
// Slightly elevated surface for inputs / modals (adds depth without a second "page" color)
const DARK_SURFACE = Platform.select({ ios: '#2C2C2E', default: '#1E1E1E' }) as string;

export const lightColors = {
  pageBg: '#f8fafc',
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  border: '#e2e8f0',
  inputBg: '#ffffff',
  teal: '#2dd4a8',
  tealFg: '#042f2e',
  tealBg: '#f0fdf9',
  red: '#ef4444',
  tabBg: '#f8fafc',
  tabBorder: '#e2e8f0',
  tabActive: '#2dd4a8',
  tabInactive: '#94a3b8',
  switchTrackOff: '#e2e8f0',
  modalOverlay: 'rgba(0,0,0,0.4)',
};

export const darkColors: typeof lightColors = {
  pageBg: DARK_BASE,
  bg: DARK_BASE,
  card: DARK_BASE,
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  textFaint: '#48484A',
  border: '#38383A',
  inputBg: DARK_SURFACE,
  teal: '#2dd4a8',
  tealFg: '#042f2e',
  tealBg: '#0d2b22',
  red: '#f87171',
  tabBg: DARK_BASE,
  tabBorder: '#38383A',
  tabActive: '#2dd4a8',
  tabInactive: '#636366',
  switchTrackOff: '#39393D',
  modalOverlay: 'rgba(0,0,0,0.6)',
};

export const appLayout = APP_LAYOUT;
export { NAV_THEME, THEME };

export type AppColors = typeof lightColors;
export type ThemeMode = 'system' | 'light' | 'dark';
