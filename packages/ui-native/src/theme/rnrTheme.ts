type SemanticTheme = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;
};

export const THEME = {
  light: {
    background: '#ffffff',
    foreground: '#0a0a0a',
    card: '#ffffff',
    cardForeground: '#0a0a0a',
    popover: '#ffffff',
    popoverForeground: '#0a0a0a',
    primary: '#007a55',
    primaryForeground: '#ecfdf5',
    secondary: '#f4f4f5',
    secondaryForeground: '#18181b',
    muted: '#f5f5f5',
    mutedForeground: '#737373',
    accent: '#f5f5f5',
    accentForeground: '#171717',
    destructive: '#e7000b',
    destructiveForeground: '#fafafa',
    border: '#e5e5e5',
    input: '#e5e5e5',
    ring: '#a1a1a1',
    success: '#16a34a',
    successForeground: '#f0fdf4',
    warning: '#d97706',
    warningForeground: '#fffbeb',
    info: '#2563eb',
    infoForeground: '#eff6ff',
  },
  dark: {
    background: '#0a0a0a',
    foreground: '#fafafa',
    card: '#171717',
    cardForeground: '#fafafa',
    popover: '#171717',
    popoverForeground: '#fafafa',
    primary: '#006045',
    primaryForeground: '#ecfdf5',
    secondary: '#27272a',
    secondaryForeground: '#fafafa',
    muted: '#262626',
    mutedForeground: '#a1a1a1',
    accent: '#262626',
    accentForeground: '#fafafa',
    destructive: '#ff6467',
    destructiveForeground: '#ffffff',
    border: 'rgba(255, 255, 255, 0.1)',
    input: 'rgba(255, 255, 255, 0.15)',
    ring: '#737373',
    success: '#22c55e',
    successForeground: '#052e16',
    warning: '#f59e0b',
    warningForeground: '#422006',
    info: '#3b82f6',
    infoForeground: '#eff6ff',
  },
} as const satisfies Record<'light' | 'dark', SemanticTheme>;

export const RNR_THEME = THEME;

function toNavTheme(theme: SemanticTheme) {
  return {
    background: theme.background,
    foreground: theme.foreground,
    card: theme.card,
    cardForeground: theme.cardForeground,
    primary: theme.primary,
    primaryForeground: theme.primaryForeground,
    secondary: theme.secondary,
    secondaryForeground: theme.secondaryForeground,
    muted: theme.muted,
    mutedForeground: theme.mutedForeground,
    accent: theme.accent,
    accentForeground: theme.accentForeground,
    destructive: theme.destructive,
    destructiveForeground: theme.destructiveForeground,
    border: theme.border,
    input: theme.input,
    ring: theme.ring,
    success: theme.success,
    successForeground: theme.successForeground,
    warning: theme.warning,
    warningForeground: theme.warningForeground,
    info: theme.info,
    infoForeground: theme.infoForeground,
  };
}

export const NAV_THEME = {
  light: toNavTheme(THEME.light),
  dark: toNavTheme(THEME.dark),
} as const;

export const APP_COLOR_THEME = {
  light: {
    pageBg: THEME.light.background,
    bg: THEME.light.background,
    card: THEME.light.card,
    text: THEME.light.foreground,
    textMuted: THEME.light.mutedForeground,
    textFaint: '#a1a1a1',
    border: THEME.light.border,
    inputBg: THEME.light.card,
    teal: THEME.light.primary,
    tealFg: THEME.light.primaryForeground,
    tealBg: '#f0fdf9',
    red: THEME.light.destructive,
    tabBg: THEME.light.background,
    tabBorder: THEME.light.border,
    tabActive: THEME.light.primary,
    tabInactive: '#a1a1a1',
    switchTrackOff: THEME.light.border,
    modalOverlay: 'rgba(0,0,0,0.4)',
  },
  dark: {
    pageBg: THEME.dark.background,
    bg: THEME.dark.background,
    card: THEME.dark.card,
    text: THEME.dark.foreground,
    textMuted: '#8e8e93',
    textFaint: '#48484a',
    border: '#38383a',
    inputBg: THEME.dark.card,
    teal: THEME.dark.primary,
    tealFg: THEME.dark.primaryForeground,
    tealBg: '#0d2b22',
    red: THEME.dark.destructive,
    tabBg: THEME.dark.background,
    tabBorder: '#38383a',
    tabActive: THEME.dark.primary,
    tabInactive: '#636366',
    switchTrackOff: '#39393d',
    modalOverlay: 'rgba(0,0,0,0.6)',
  },
} as const;

export type AppColorTheme = {
  [Key in keyof typeof APP_COLOR_THEME.light]: string;
};
