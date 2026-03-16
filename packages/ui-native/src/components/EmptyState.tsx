import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';

export type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => (
  <View
    className={cn('flex-1 items-center justify-center gap-3 px-8 py-12', className)}
    accessibilityRole="text"
  >
    {icon && <View className="mb-2">{icon}</View>}
    <Text className="text-center text-lg font-semibold text-foreground">{title}</Text>
    {description && (
      <Text className="text-center text-sm text-muted-foreground">{description}</Text>
    )}
    {action && <View className="mt-4">{action}</View>}
  </View>
);
