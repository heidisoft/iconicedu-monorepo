export const FONT_SIZE = {
  badge: 9,
  xs: 11,
  sm: 12,
  base: 13,
  md: 15,
  lg: 16,
  xl: 17,
  '2xl': 20,
  '3xl': 22,
} as const;

export const LINE_HEIGHT = {
  xs: 16,
  sm: 18,
  base: 18,
  md: 22,
  lg: 22,
  xl: 24,
} as const;

export const TOUCH_TARGET = {
  sm: 36,
  md: 44,
  lg: 48,
} as const;

export const COMPONENT_HEIGHT = {
  inputSm: 44,
  input: 48,
  btnSm: 44,
  btn: 48,
  btnLg: 52,
  row: 56,
  rowCompact: 48,
  rowComfortable: 64,
  tab: 44,
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

export const typography = {
  h1: { fontSize: FONT_SIZE['3xl'], lineHeight: 28, fontWeight: '700' as const },
  h2: { fontSize: FONT_SIZE['2xl'], lineHeight: 26, fontWeight: '700' as const },
  h3: {
    fontSize: FONT_SIZE.xl,
    lineHeight: LINE_HEIGHT.xl,
    fontWeight: '600' as const,
  },
  h4: {
    fontSize: FONT_SIZE.lg,
    lineHeight: LINE_HEIGHT.lg,
    fontWeight: '600' as const,
  },
  body: { fontSize: FONT_SIZE.md, lineHeight: LINE_HEIGHT.md },
  sm: { fontSize: FONT_SIZE.base, lineHeight: LINE_HEIGHT.base },
  meta: { fontSize: FONT_SIZE.sm, lineHeight: LINE_HEIGHT.sm },
  tiny: { fontSize: FONT_SIZE.xs, lineHeight: LINE_HEIGHT.xs },
} as const;

export function hitSlop(visualSize: number, minPx = 44) {
  const inset = Math.max(0, Math.ceil((minPx - visualSize) / 2));
  return { top: inset, bottom: inset, left: inset, right: inset };
}
