import { Platform } from 'react-native';

// md = platform body default: 17pt on iOS (Dynamic Type Body), 16sp on Android (Material bodyMedium)
export const FONT_SIZE = {
  badge: 9,
  xs: 11,
  sm: 12,
  base: 13,
  md: Platform.select({ ios: 17, android: 16, default: 16 }) as number,
  lg: 16,
  xl: 17,
  '2xl': 20,
  '3xl': 22,
};

export const LINE_HEIGHT = {
  xs: 16,
  sm: 18,
  base: 18,
  md: Platform.select({ ios: 26, android: 24, default: 24 }) as number,
  lg: 22,
  xl: 24,
  '2xl': 26,
  '3xl': 28,
};

export const TOUCH_TARGET = {
  sm: 44,
  md: 44,
  lg: 48,
  cta: 56,
} as const;

export const COMPONENT_HEIGHT = {
  inputSm: 44,
  input: 48,
  inputLg: 52,
  btnSm: 44,
  btn: 48,
  btnLg: 52,
  btnXl: 56,
  rowCompact: 48,
  row: 56,
  rowComfortable: 64,
  tab: 44,
  tabDefault: 48,
  bottomTab: 49,
  header: 56,
} as const;

export const ICON_SIZE = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
} as const;

export const SPACING = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const AVATAR_SIZE = {
  xs: 24,
  sm: 32,
  md: 36,
  lg: 44,
  xl: 56,
  '2xl': 72,
} as const;

export const HIT_SLOP = {
  icon32: { top: 6, bottom: 6, left: 6, right: 6 },
  visual36: { top: 4, bottom: 4, left: 4, right: 4 },
  loose: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;

export const APP_LAYOUT = {
  listItem: {
    listPaddingTop: SPACING[2],
    listPaddingBottom: SPACING[4],
    marginHorizontal: 0,
    marginBottom: 0,
    paddingHorizontal: SPACING[4],
    paddingVertical: 11,
    minHeight: 72,
    gap: SPACING[3],
    contentGap: 2,
    topRowGap: SPACING[2],
    metaWrapGap: SPACING[2],
    metaGroupGap: 5,
    avatarSize: 50,
    groupAvatarSize: 34,
    badgeSize: 20,
    tailWidth: 70,
  },
} as const;
