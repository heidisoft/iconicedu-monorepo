import React, { useCallback } from 'react';
import {
  Pressable,
  View,
  Text,
  type PressableProps,
  type GestureResponderEvent,
} from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { useUiTracking } from '@iconicedu/ui-native/lib/tracking-context';
import {
  DENSITY_ROW_CLASS,
  type Density,
  typography,
  useDensity,
} from '@iconicedu/ui-native/theme';

export type ListItemProps = PressableProps & {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  density?: Density;
  active?: boolean;
  className?: string;
};

export const ListItem: React.FC<ListItemProps> = ({
  leading,
  title,
  subtitle,
  trailing,
  density,
  active = false,
  className,
  onPress,
  ...rest
}) => {
  const track = useUiTracking();
  const contextDensity = useDensity();
  const resolvedDensity = density ?? contextDensity;

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (onPress) {
        track('list item selected', { button_name: title, component_type: 'list_item' });
        onPress(e);
      }
    },
    [track, title, onPress],
  );

  return (
    <Pressable
      className={cn(
        'flex-row items-center gap-3 rounded-xl active:bg-accent/50',
        DENSITY_ROW_CLASS[resolvedDensity],
        active && 'bg-accent',
        className,
      )}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected: active }}
      onPress={onPress ? handlePress : undefined}
      {...rest}
    >
      {leading && <View className="shrink-0">{leading}</View>}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          className={cn(
            typography.body,
            'font-medium',
            active ? 'text-foreground' : 'text-foreground',
          )}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            className={cn(typography.meta, 'text-muted-foreground')}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {trailing && <View className="shrink-0">{trailing}</View>}
    </Pressable>
  );
};
