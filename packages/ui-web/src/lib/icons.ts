'use client';

import type { LucideIcon } from 'lucide-react';
import { ChefHat, Earth, Languages, Sparkles, SquarePi } from 'lucide-react';

export const LEARNING_SPACE_ICON_MAP = {
  sparkles: Sparkles,
  'square-pi': SquarePi,
  languages: Languages,
  'chef-hat': ChefHat,
  earth: Earth,
} as const;

export type LearningSpaceIconKey = keyof typeof LEARNING_SPACE_ICON_MAP;

export const DEFAULT_LEARNING_SPACE_ICON_KEY: LearningSpaceIconKey = 'sparkles';

export const LEARNING_SPACE_ICON_OPTIONS: {
  value: LearningSpaceIconKey;
  label: string;
}[] = [
  { value: 'sparkles', label: 'Sparkles' },
  { value: 'square-pi', label: 'Math' },
  { value: 'languages', label: 'Languages' },
  { value: 'chef-hat', label: 'Creative' },
  { value: 'earth', label: 'World' },
];

export function getLearningSpaceIcon(
  iconKey?: string | null,
  fallback?: LucideIcon,
): LucideIcon {
  if (iconKey && iconKey in LEARNING_SPACE_ICON_MAP) {
    return LEARNING_SPACE_ICON_MAP[iconKey as LearningSpaceIconKey];
  }

  if (fallback) {
    return fallback;
  }

  return LEARNING_SPACE_ICON_MAP[DEFAULT_LEARNING_SPACE_ICON_KEY];
}
