/**
 * Navigation theme constants for non-NativeWind contexts (tab bar style objects,
 * StatusBar, etc.). Dark-mode hex equivalents of the shared forest-green palette.
 */
export const NAV_THEME = {
  dark: {
    background: '#141813',
    foreground: '#f3f5f0',
    card: '#1d221b',
    cardForeground: '#f3f5f0',
    primary: '#5fb17e',
    primaryForeground: '#08241a',
    primarySubtle: '#17301f',
    action: '#6fae8a',
    actionForeground: '#0e241c',
    actionSubtle: '#1e2a22',
    ink: '#f3f5f0',
    inkForeground: '#1f2a26',
    inkSubtle: '#262b23',
    secondary: '#262b23',
    secondaryForeground: '#f3f5f0',
    muted: '#242a22',
    mutedForeground: '#a0a89c',
    accent: '#262b23',
    accentForeground: '#f3f5f0',
    destructive: '#dc2626',
    destructiveForeground: '#fafafa',
    border: '#262b23',
    input: '#262b23',
    ring: '#5fb17e',
    // Semantic extras (for Badge variants, etc.)
    success: '#22c55e',
    successForeground: '#052e16',
    warning: '#f59e0b',
    warningForeground: '#422006',
    info: '#7f9fe0',
    infoForeground: '#0b1836',
  },
} as const;
