import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Crown, type LucideIcon } from 'lucide-react-native';

type RoleAvatarBadgeProps = {
  role?: string | null;
  size?: number;
  style?: ViewStyle;
};

function getRoleBadge(role?: string | null): {
  icon: LucideIcon;
  fg: string;
} | null {
  switch (role) {
    case 'owner':
    case 'admin':
    case 'staff':
    case 'system':
      return { icon: Crown, fg: '#b45309' };
    default:
      return null;
  }
}

export function RoleAvatarBadge({ role, size = 22, style }: RoleAvatarBadgeProps) {
  const badge = getRoleBadge(role);
  if (!badge) return null;

  const Icon = badge.icon;
  const iconSize =
    size >= 14
      ? Math.max(15, Math.round(size * 1.18))
      : Math.max(10, Math.round(size * 0.96));
  const topOffset = -Math.round(size * 0.42);

  return (
    <View
      style={[
        s.badge,
        {
          width: size,
          height: size,
          top: topOffset,
          transform: [{ translateX: -(size / 2) }],
        },
        style,
      ]}
    >
      <Icon size={iconSize} color={badge.fg} strokeWidth={2.2} />
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute',
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
