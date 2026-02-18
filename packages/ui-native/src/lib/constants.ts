/**
 * Navigation theme constants — hex equivalents of the web's dark-mode OKLCH colors.
 * Used for non-NativeWind contexts (tab bar style objects, StatusBar, etc.)
 */
export const NAV_THEME = {
  dark: {
    background: '#09090b', // oklch(0.145 0 0) — zinc-950
    foreground: '#fafafa', // oklch(0.985 0 0) — zinc-50
    card: '#18181b', // oklch(0.205 0 0) — zinc-900
    cardForeground: '#fafafa',
    primary: '#2dd4a8', // oklch(0.7 0.15 162) — teal-ish green
    primaryForeground: '#042f2e', // oklch(0.26 0.05 173)
    secondary: '#27272a', // oklch(0.274 0.006 286) — zinc-800
    secondaryForeground: '#fafafa',
    muted: '#27272a',
    mutedForeground: '#a1a1aa', // oklch(0.708 0 0) — zinc-400
    accent: '#3f3f46', // oklch(0.371 0 0) — zinc-700
    accentForeground: '#fafafa',
    destructive: '#dc2626', // oklch(0.704 0.191 22) — red-600
    destructiveForeground: '#fafafa',
    border: '#27272a',
    input: '#27272a',
    ring: '#2dd4a8',
    // Semantic extras (for Badge variants, etc.)
    success: '#22c55e',
    successForeground: '#052e16',
    warning: '#f59e0b',
    warningForeground: '#422006',
    info: '#3b82f6',
    infoForeground: '#eff6ff',
  },
} as const;
