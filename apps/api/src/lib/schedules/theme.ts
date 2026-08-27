import type { ThemeKey } from '@iconicedu/shared-types';

const THEME_KEYS: ThemeKey[] = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'amber',
  'blue',
  'cyan',
  'emerald',
  'fuchsia',
  'green',
  'indigo',
  'lime',
  'orange',
  'pink',
  'purple',
  'red',
  'rose',
  'sky',
  'teal',
  'violet',
  'yellow',
];

const THEME_KEY_SET = new Set(THEME_KEYS);

export function resolveThemeKey(value: string | null): ThemeKey | null {
  if (value && THEME_KEY_SET.has(value as ThemeKey)) {
    return value as ThemeKey;
  }
  return null;
}
