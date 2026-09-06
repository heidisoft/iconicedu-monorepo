import { Platform } from 'react-native';

// ─── Platform-canonical dark surfaces ─────────────────────────────────────────
// One primary dark color per platform, applied uniformly so the nav bar,
// tab bar, and page background all share the same base tone.
//   iOS    → #1C1C1E  (UIColor.systemBackground in Dark Mode)
//   Android → #121212  (Material Design 3 dark surface)
const DARK_BASE = Platform.select({ ios: '#1C1C1E', default: '#121212' }) as string;
// Slightly elevated surface for inputs / modals (adds depth without a second "page" color)
const DARK_SURFACE = Platform.select({ ios: '#2C2C2E', default: '#1E1E1E' }) as string;

export const lightColors = {
  pageBg: '#f5f6f1',
  bg: '#f5f6f1',
  card: '#ffffff',
  text: '#1f2a26',
  textMuted: '#6b7469',
  textFaint: '#9aa39a',
  border: '#e4e6dd',
  inputBg: '#ffffff',
  // Deep pine `action` for CTAs / FAB / active nav; leaf `primary` for positive accents.
  primary: '#2f7d4a',
  primaryForeground: '#ffffff',
  primarySubtle: '#e2f0e2',
  action: '#25493c',
  actionForeground: '#ffffff',
  actionSubtle: '#e7efe9',
  ink: '#1f2a26',
  inkForeground: '#ffffff',
  inkSubtle: '#eef0ea',
  // Chat bubbles — pale leaf for the current user, pale periwinkle for everyone else.
  bubbleOwn: '#e2f0e2',
  bubbleOther: '#eceffa',
  // Semantic status tokens — the only place a "green means good" / "amber means
  // warning" value is allowed to live. Components must consume these, never a raw hex.
  success: '#16a34a',
  successForeground: '#ffffff',
  successSubtle: '#e6f4ea',
  warning: '#d97706',
  warningForeground: '#ffffff',
  warningSubtle: '#fdf0e1',
  info: '#3f6cc4',
  infoForeground: '#ffffff',
  infoSubtle: '#eef2fb',
  // Decorative pastel tiles (campaign categories, schedule card). Fills only —
  // pair with the matching *Fg for text/icons on top.
  pink: '#f3d4e6',
  pinkFg: '#6b2b52',
  peach: '#f4cba6',
  peachFg: '#7a3f1c',
  periwinkle: '#c9d4f2',
  periwinkleFg: '#2f3f77',
  lime: '#dcea7e',
  limeFg: '#40470f',
  coral: '#f0774d',
  coralFg: '#ffffff',
  // Legacy accent aliases. Historically green, briefly blue; now repointed at the
  // pine `action` tokens so every screen still reading `colors.teal*` tracks the
  // accent without a local edit. Prefer `action*` / `primary*` / status tokens in new code.
  teal: '#25493c',
  tealFg: '#ffffff',
  tealBg: '#e7efe9',
  red: '#dc2626',
  tabBg: '#ffffff',
  tabBorder: '#e4e6dd',
  tabActive: '#25493c',
  tabInactive: '#9aa39a',
  switchTrackOff: '#d5d8cf',
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
  primary: '#5fb17e',
  primaryForeground: '#08241a',
  primarySubtle: '#17301f',
  action: '#6fae8a',
  actionForeground: '#0e241c',
  actionSubtle: '#1e2a22',
  ink: '#f3f5f0',
  inkForeground: '#1f2a26',
  inkSubtle: '#262b23',
  bubbleOwn: '#17301f',
  bubbleOther: '#252a3a',
  success: '#22c55e',
  successForeground: '#052e16',
  successSubtle: '#12271a',
  warning: '#f59e0b',
  warningForeground: '#422006',
  warningSubtle: '#2e2306',
  info: '#7f9fe0',
  infoForeground: '#0b1836',
  infoSubtle: '#172554',
  pink: '#4a2a3d',
  pinkFg: '#f3d4e6',
  peach: '#4a3524',
  peachFg: '#f4cba6',
  periwinkle: '#2f3856',
  periwinkleFg: '#c9d4f2',
  lime: '#3a3f1a',
  limeFg: '#dcea7e',
  coral: '#7a3320',
  coralFg: '#f9c3ae',
  teal: '#6fae8a',
  tealFg: '#0e241c',
  tealBg: '#1e2a22',
  red: '#f87171',
  tabBg: DARK_BASE,
  tabBorder: '#38383A',
  tabActive: '#fafafa',
  tabInactive: '#636366',
  switchTrackOff: '#39393D',
  modalOverlay: 'rgba(0,0,0,0.6)',
};

export type AppColors = typeof lightColors;
export type ThemeMode = 'system' | 'light' | 'dark';
