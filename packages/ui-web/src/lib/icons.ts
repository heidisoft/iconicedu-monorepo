'use client';

import {
  CHANNEL_TOPIC_ICON_OPTIONS,
  DEFAULT_CHANNEL_TOPIC_ICON_KEY,
  DEFAULT_LEARNING_SPACE_ICON_KEY,
  LEARNING_SPACE_ICON_OPTIONS,
  type LearningSpaceIconKey,
} from '@iconicedu/shared-types';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Briefcase,
  Calculator,
  ChefHat,
  ChessKnight,
  ClipboardCheck,
  Earth,
  Globe,
  GraduationCap,
  House,
  Languages,
  Landmark,
  LifeBuoy,
  Lock,
  Map,
  Megaphone,
  MessageSquare,
  NotebookPen,
  NotebookText,
  Paintbrush,
  Palette,
  PenTool,
  Ruler,
  Scissors,
  Sparkles,
  SquarePi,
  UserCheck,
  Users,
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

export const CHANNEL_TOPIC_ICON_MAP = {
  ...LEARNING_SPACE_ICON_MAP,
  megaphone: Megaphone,
  'life-buoy': LifeBuoy,
  users: Users,
  'message-square': MessageSquare,
  globe: Globe,
  lock: Lock,
  house: House,
  briefcase: Briefcase,
  'user-check': UserCheck,
  'book-open': BookOpen,
} as const;

export {
  CHANNEL_TOPIC_ICON_OPTIONS,
  DEFAULT_CHANNEL_TOPIC_ICON_KEY,
  DEFAULT_LEARNING_SPACE_ICON_KEY,
  LEARNING_SPACE_ICON_OPTIONS,
  type LearningSpaceIconKey,
};

export function getLearningSpaceIcon(
  iconKey?: string | null,
  fallback?: LucideIcon,
): LucideIcon {
  const iconMap = LEARNING_SPACE_ICON_MAP as Record<string, LucideIcon>;

  if (iconKey && iconKey in iconMap) {
    return iconMap[iconKey];
  }

  if (fallback) {
    return fallback;
  }

  return LEARNING_SPACE_ICON_MAP[DEFAULT_LEARNING_SPACE_ICON_KEY];
}

export function getChannelTopicIcon(
  iconKey?: string | null,
  fallback?: LucideIcon,
): LucideIcon {
  const iconMap = CHANNEL_TOPIC_ICON_MAP as Record<string, LucideIcon>;

  if (iconKey && iconKey in iconMap) {
    return iconMap[iconKey];
  }

  if (fallback) {
    return fallback;
  }

  return CHANNEL_TOPIC_ICON_MAP[DEFAULT_CHANNEL_TOPIC_ICON_KEY];
}
