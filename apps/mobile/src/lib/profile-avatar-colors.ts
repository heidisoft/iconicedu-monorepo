// Flat, muted accent palette tuned to the forest-green + sage theme. Every hue
// is pulled to the same low-saturation mid tone so a wall of avatars / classroom
// tiles reads as one earthy system rather than a vivid rainbow.
const FALLBACK_AVATAR_COLORS = [
  '#547fb4',
  '#cf7a4e',
  '#4f9d62',
  '#8767a6',
  '#c08a3e',
  '#3f978f',
  '#bd6a8c',
];

const THEME_AVATAR_COLORS: Record<string, { bg: string; fg: string }> = {
  slate: { bg: '#667487', fg: '#ffffff' },
  gray: { bg: '#6e737a', fg: '#ffffff' },
  zinc: { bg: '#73737a', fg: '#ffffff' },
  neutral: { bg: '#75726e', fg: '#ffffff' },
  stone: { bg: '#7c756b', fg: '#ffffff' },
  red: { bg: '#cc5b52', fg: '#ffffff' },
  orange: { bg: '#cf7a4e', fg: '#1f2a26' },
  amber: { bg: '#c08a3e', fg: '#1f2a26' },
  yellow: { bg: '#b09a44', fg: '#1f2a26' },
  lime: { bg: '#86a049', fg: '#1f2a26' },
  green: { bg: '#4f9d62', fg: '#ffffff' },
  emerald: { bg: '#3a9375', fg: '#ffffff' },
  teal: { bg: '#3f978f', fg: '#ffffff' },
  cyan: { bg: '#43919e', fg: '#ffffff' },
  sky: { bg: '#5090bb', fg: '#ffffff' },
  blue: { bg: '#547fb4', fg: '#ffffff' },
  indigo: { bg: '#6266a8', fg: '#ffffff' },
  violet: { bg: '#7a6aac', fg: '#ffffff' },
  purple: { bg: '#8767a6', fg: '#ffffff' },
  fuchsia: { bg: '#a5629a', fg: '#ffffff' },
  pink: { bg: '#bd6a8c', fg: '#ffffff' },
  rose: { bg: '#c56370', fg: '#ffffff' },
};

type ClassroomAccentPalette = { surface: string; outline: string; edge: string };

const CLASSROOM_ACCENT_PALETTES: Record<
  string,
  { light: ClassroomAccentPalette; dark: ClassroomAccentPalette }
> = {
  slate: {
    light: { surface: '#f1f1ef', outline: '#c6c8c9', edge: '#667487' },
    dark: { surface: '#242a2a', outline: '#3e474e', edge: '#8893a1' },
  },
  gray: {
    light: { surface: '#f2f1ef', outline: '#c9c8c5', edge: '#6e737a' },
    dark: { surface: '#262a27', outline: '#424748', edge: '#8e9297' },
  },
  zinc: {
    light: { surface: '#f2f1ef', outline: '#cac8c5', edge: '#73737a' },
    dark: { surface: '#272a27', outline: '#454748', edge: '#929297' },
  },
  neutral: {
    light: { surface: '#f2f1ee', outline: '#cbc8c2', edge: '#75726e' },
    dark: { surface: '#272a25', outline: '#464642', edge: '#93918e' },
  },
  stone: {
    light: { surface: '#f2f1ee', outline: '#cdc9c1', edge: '#7c756b' },
    dark: { surface: '#282a24', outline: '#494840', edge: '#99938c' },
  },
  red: {
    light: { surface: '#f7f0ec', outline: '#e3c1ba', edge: '#cc5b52' },
    dark: { surface: '#372620', outline: '#713b34', edge: '#d77f78' },
  },
  orange: {
    light: { surface: '#f7f1ec', outline: '#e4cab9', edge: '#cf7a4e' },
    dark: { surface: '#372b1f', outline: '#734a32', edge: '#da9775' },
  },
  amber: {
    light: { surface: '#f7f2eb', outline: '#e0ceb4', edge: '#c08a3e' },
    dark: { surface: '#352e1c', outline: '#6b522a', edge: '#cea468' },
  },
  yellow: {
    light: { surface: '#f6f3eb', outline: '#dbd3b6', edge: '#b09a44' },
    dark: { surface: '#32311d', outline: '#635a2d', edge: '#c1b06d' },
  },
  lime: {
    light: { surface: '#f3f4ec', outline: '#cfd5b7', edge: '#86a049' },
    dark: { surface: '#2a321e', outline: '#4e5d2f', edge: '#a1b571' },
  },
  green: {
    light: { surface: '#f0f3ed', outline: '#c0d4be', edge: '#4f9d62' },
    dark: { surface: '#203223', outline: '#335c3c', edge: '#76b385' },
  },
  emerald: {
    light: { surface: '#eef3ee', outline: '#bad1c3', edge: '#3a9375' },
    dark: { surface: '#1c3026', outline: '#285745', edge: '#65ab93' },
  },
  teal: {
    light: { surface: '#eff3f0', outline: '#bcd2cb', edge: '#3f978f' },
    dark: { surface: '#1d312b', outline: '#2b5952', edge: '#69aea8' },
  },
  cyan: {
    light: { surface: '#eff3f1', outline: '#bdd0cf', edge: '#43919e' },
    dark: { surface: '#1e2f2e', outline: '#2d565a', edge: '#6ca9b3' },
  },
  sky: {
    light: { surface: '#f0f3f2', outline: '#c0d0d7', edge: '#5090bb' },
    dark: { surface: '#202f33', outline: '#335568', edge: '#77a8ca' },
  },
  blue: {
    light: { surface: '#f0f2f2', outline: '#c1cbd5', edge: '#547fb4' },
    dark: { surface: '#212c32', outline: '#354d65', edge: '#7a9bc5' },
  },
  indigo: {
    light: { surface: '#f1f0f1', outline: '#c5c4d2', edge: '#6266a8' },
    dark: { surface: '#24282f', outline: '#3c405f', edge: '#8588bb' },
  },
  violet: {
    light: { surface: '#f2f0f2', outline: '#ccc5d3', edge: '#7a6aac' },
    dark: { surface: '#282830', outline: '#484261', edge: '#978bbe' },
  },
  purple: {
    light: { surface: '#f3f0f1', outline: '#d0c5d1', edge: '#8767a6' },
    dark: { surface: '#2a282f', outline: '#4f415e', edge: '#a188ba' },
  },
  fuchsia: {
    light: { surface: '#f5f0f0', outline: '#d8c3ce', edge: '#a5629a' },
    dark: { surface: '#30272d', outline: '#5e3e58', edge: '#b985b0' },
  },
  pink: {
    light: { surface: '#f6f0f0', outline: '#dfc5ca', edge: '#bd6a8c' },
    dark: { surface: '#34282a', outline: '#6a4251', edge: '#cc8ba5' },
  },
  rose: {
    light: { surface: '#f7f0ee', outline: '#e1c3c2', edge: '#c56370' },
    dark: { surface: '#362725', outline: '#6e3f43', edge: '#d2858f' },
  },
};

export function classroomAccentPalette(
  themeKey: string | null | undefined,
  isDark: boolean,
): ClassroomAccentPalette | null {
  const palette = themeKey ? CLASSROOM_ACCENT_PALETTES[themeKey] : undefined;
  return palette?.[isDark ? 'dark' : 'light'] ?? null;
}

function seededAvatarBg(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_AVATAR_COLORS[h % FALLBACK_AVATAR_COLORS.length]!;
}

export function profileAvatarColors(input: {
  themeKey?: string | null;
  seed: string;
  fallbackFg?: string;
}) {
  const themed = input.themeKey ? THEME_AVATAR_COLORS[input.themeKey] : undefined;
  return (
    themed ?? {
      bg: seededAvatarBg(input.seed),
      fg: input.fallbackFg ?? '#ffffff',
    }
  );
}

export function profileAvatarBg(seed: string, themeKey?: string | null): string {
  return profileAvatarColors({ seed, themeKey }).bg;
}
