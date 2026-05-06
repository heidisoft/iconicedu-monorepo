import { FONT_SIZE, LINE_HEIGHT } from './tokens';

export const typography = {
  caption: 'text-caption',
  meta: 'text-meta',
  bodySmall: 'text-[14px] leading-5',
  body: 'text-body',
  bodyLarge: 'text-body-lg',
  headline: 'text-headline font-semibold',
  title: 'text-title font-semibold',
  titleLarge: 'text-title-lg font-bold',
} as const;

export type TypographyVariant = keyof typeof typography;

export const typographyStyle = {
  h1: {
    fontSize: FONT_SIZE['3xl'],
    lineHeight: LINE_HEIGHT['3xl'],
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: FONT_SIZE['2xl'],
    lineHeight: LINE_HEIGHT['2xl'],
    fontWeight: '700' as const,
  },
  h3: { fontSize: FONT_SIZE.xl, lineHeight: LINE_HEIGHT.xl, fontWeight: '600' as const },
  h4: { fontSize: FONT_SIZE.lg, lineHeight: LINE_HEIGHT.lg, fontWeight: '600' as const },
  body: { fontSize: FONT_SIZE.md, lineHeight: LINE_HEIGHT.md },
  sm: { fontSize: FONT_SIZE.base, lineHeight: LINE_HEIGHT.base },
  meta: { fontSize: FONT_SIZE.sm, lineHeight: LINE_HEIGHT.sm },
  tiny: { fontSize: FONT_SIZE.xs, lineHeight: LINE_HEIGHT.xs },
} as const;

export const listTypography = {
  title: {
    fontSize: FONT_SIZE.xl,
    lineHeight: LINE_HEIGHT.xl,
    fontWeight: '600' as const,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    lineHeight: LINE_HEIGHT.md,
  },
  meta: {
    fontSize: FONT_SIZE.base,
    lineHeight: LINE_HEIGHT.base,
  },
  badge: {
    fontSize: FONT_SIZE.sm,
    lineHeight: LINE_HEIGHT.sm,
    fontWeight: '700' as const,
  },
} as const;
