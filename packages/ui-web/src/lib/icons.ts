'use client';

import {
  DEFAULT_LEARNING_SPACE_ICON_KEY,
  LEARNING_SPACE_ICON_OPTIONS,
  type LearningSpaceIconKey,
} from '@iconicedu/shared-types';
import type { LucideIcon } from 'lucide-react';
import {
  Calculator,
  ChefHat,
  ChessKnight,
  ClipboardCheck,
  Earth,
  GraduationCap,
  Languages,
  Landmark,
  Map,
  NotebookPen,
  NotebookText,
  Paintbrush,
  Palette,
  PenTool,
  Ruler,
  Scissors,
  Sparkles,
  SquarePi,
} from 'lucide-react';

export const LEARNING_SPACE_ICON_MAP = {
  sparkles: Sparkles,
  'square-pi': SquarePi,
  languages: Languages,
  'chef-hat': ChefHat,
  earth: Earth,
  'chess-knight': ChessKnight,
  palette: Palette,
  paintbrush: Paintbrush,
  scissors: Scissors,
  calculator: Calculator,
  ruler: Ruler,
  'pen-tool': PenTool,
  'notebook-pen': NotebookPen,
  'notebook-text': NotebookText,
  'clipboard-check': ClipboardCheck,
  'graduation-cap': GraduationCap,
  landmark: Landmark,
  map: Map,
} as const;

export {
  DEFAULT_LEARNING_SPACE_ICON_KEY,
  LEARNING_SPACE_ICON_OPTIONS,
  type LearningSpaceIconKey,
};

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
