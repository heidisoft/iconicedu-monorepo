import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
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
  type LucideIcon,
} from 'lucide-react-native';
import {
  DEFAULT_CHANNEL_TOPIC_ICON_KEY,
  DEFAULT_LEARNING_SPACE_ICON_KEY,
  isKnownChannelTopicIconKey,
  isLearningSpaceIconKey,
  type KnownChannelTopicIconKey,
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

export const MOBILE_CHANNEL_TOPIC_ICON_MAP: Record<KnownChannelTopicIconKey, LucideIcon> =
  {
    ...MOBILE_LEARNING_SPACE_ICON_MAP,
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

export function resolveChannelTopicIconKey(
  iconKey?: string | null,
): KnownChannelTopicIconKey {
  if (iconKey === 'support') {
    return 'life-buoy';
  }

  if (iconKey && isKnownChannelTopicIconKey(iconKey)) {
    return iconKey;
  }

  return DEFAULT_CHANNEL_TOPIC_ICON_KEY;
}

export function getChannelTopicIcon(iconKey?: string | null): LucideIcon {
  return MOBILE_CHANNEL_TOPIC_ICON_MAP[resolveChannelTopicIconKey(iconKey)];
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

type ChannelTopicIconBadgeProps = LearningSpaceIconBadgeProps;

export function ChannelTopicIconBadge({
  iconKey,
  color,
  backgroundColor,
  size = 40,
  iconSize = 20,
  borderRadius = 12,
  style,
}: ChannelTopicIconBadgeProps) {
  const Icon = getChannelTopicIcon(iconKey);

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
