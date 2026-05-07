import { FONT_FAMILY, FONT_SIZE, LINE_HEIGHT } from './tokens';

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
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE['3xl'],
    lineHeight: LINE_HEIGHT['3xl'],
    fontWeight: '700' as const,
  },
  h2: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE['2xl'],
    lineHeight: LINE_HEIGHT['2xl'],
    fontWeight: '700' as const,
  },
  h3: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.xl,
    lineHeight: LINE_HEIGHT.xl,
    fontWeight: '600' as const,
  },
  h4: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.lg,
    lineHeight: LINE_HEIGHT.lg,
    fontWeight: '600' as const,
  },
  body: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.md,
    lineHeight: LINE_HEIGHT.md,
  },
  sm: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.base,
    lineHeight: LINE_HEIGHT.base,
  },
  meta: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.sm,
    lineHeight: LINE_HEIGHT.sm,
  },
  tiny: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.xs,
    lineHeight: LINE_HEIGHT.xs,
  },
} as const;

export const listTypography = {
  title: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.xl,
    lineHeight: LINE_HEIGHT.xl,
    fontWeight: '600' as const,
  },
  subtitle: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.md,
    lineHeight: LINE_HEIGHT.md,
  },
  meta: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.base,
    lineHeight: LINE_HEIGHT.base,
  },
  badge: {
    fontFamily: FONT_FAMILY.sans,
    fontSize: FONT_SIZE.sm,
    lineHeight: LINE_HEIGHT.sm,
    fontWeight: '700' as const,
  },
} as const;
