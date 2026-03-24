import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
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
  type LucideIcon,
} from 'lucide-react-native';
import {
  DEFAULT_LEARNING_SPACE_ICON_KEY,
  isLearningSpaceIconKey,
  type LearningSpaceIconKey,
} from '@iconicedu/shared-types';

export const MOBILE_LEARNING_SPACE_ICON_MAP: Record<LearningSpaceIconKey, LucideIcon> = {
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
};

export function resolveLearningSpaceIconKey(
  iconKey?: string | null,
): LearningSpaceIconKey {
  if (iconKey && isLearningSpaceIconKey(iconKey)) {
    return iconKey;
  }

  return DEFAULT_LEARNING_SPACE_ICON_KEY;
}

export function getLearningSpaceIcon(iconKey?: string | null): LucideIcon {
  return MOBILE_LEARNING_SPACE_ICON_MAP[resolveLearningSpaceIconKey(iconKey)];
}

type LearningSpaceIconBadgeProps = {
  iconKey?: string | null;
  color: string;
  backgroundColor: string;
  size?: number;
  iconSize?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function LearningSpaceIconBadge({
  iconKey,
  color,
  backgroundColor,
  size = 40,
  iconSize = 20,
  borderRadius = 12,
  style,
}: LearningSpaceIconBadgeProps) {
  const Icon = getLearningSpaceIcon(iconKey);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Icon size={iconSize} color={color} />
    </View>
  );
}
