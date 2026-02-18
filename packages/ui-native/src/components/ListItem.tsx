import React from 'react';
import { Pressable, View, Text, type PressableProps } from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';

export type ListItemProps = PressableProps & {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  active?: boolean;
  className?: string;
};

export const ListItem: React.FC<ListItemProps> = ({
  leading,
  title,
  subtitle,
  trailing,
  active = false,
  className,
  ...rest
}) => (
  <Pressable
    className={cn(
      'flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-accent/50',
      active && 'bg-accent',
      className,
    )}
    accessibilityRole="button"
    accessibilityLabel={title}
    accessibilityState={{ selected: active }}
    {...rest}
  >
    {leading && <View className="shrink-0">{leading}</View>}
    <View className="min-w-0 flex-1 gap-0.5">
      <Text
        className={cn(
          'text-sm font-medium',
          active ? 'text-foreground' : 'text-foreground',
        )}
        numberOfLines={1}
      >
        {title}
      </Text>
      {subtitle && (
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
    {trailing && <View className="shrink-0">{trailing}</View>}
  </Pressable>
);
