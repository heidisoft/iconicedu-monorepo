import type { ThemeKey } from '@iconicedu/shared-types';
import { getAvatarBucket } from '@iconicedu/web/lib/storage/storage-paths';

export const THEME_KEYS: ThemeKey[] = [
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

export const THEME_KEY_SET = new Set(THEME_KEYS);

export const AVATAR_BUCKET = getAvatarBucket();
export const AVATAR_SIGNED_URL_TTL = 60 * 60;

export const pickRandomThemeKey = () =>
  THEME_KEYS[Math.floor(Math.random() * THEME_KEYS.length)] ?? 'teal';
