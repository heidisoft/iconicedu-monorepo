import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onBack?: () => void;
  className?: string;
};

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  leading,
  trailing,
  onBack,
  className,
}) => (
  <View
    className={cn(
      'flex-row items-center gap-3 border-b border-border bg-background px-4 pb-3 pt-2',
      className,
    )}
  >
    {onBack && (
      <Pressable
        onPress={onBack}
        className="active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text className="text-2xl text-primary">{'‹'}</Text>
      </Pressable>
    )}
    {leading}
    <View className="min-w-0 flex-1">
      <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
        {title}
      </Text>
      {subtitle && (
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
    {trailing && <View className="shrink-0">{trailing}</View>}
  </View>
);
