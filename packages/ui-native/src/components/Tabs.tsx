import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';

export type TabItem = {
  key: string;
  label: string;
  badge?: number;
};

export type TabsProps = {
  items: TabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
  scrollable?: boolean;
  className?: string;
};

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  onTabPress,
  scrollable = false,
  className,
}) => {
  const content = items.map((item) => {
    const isActive = item.key === activeKey;
    return (
      <Pressable
        key={item.key}
        onPress={() => onTabPress(item.key)}
        className={cn(
          'flex-row items-center gap-1.5 border-b-2 px-4 pb-3 pt-2',
          isActive ? 'border-primary' : 'border-transparent',
        )}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: isActive }}
      >
        <Text
          className={cn(
            'text-sm font-medium',
            isActive ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {item.label}
        </Text>
        {item.badge !== undefined && item.badge > 0 && (
          <View className="items-center justify-center rounded-full bg-primary px-1.5 py-0.5">
            <Text className="text-[10px] font-bold text-primary-foreground">
              {item.badge > 99 ? '99+' : item.badge}
            </Text>
          </View>
        )}
      </Pressable>
    );
  });

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className={cn('border-b border-border', className)}
        accessibilityRole="tablist"
      >
        {content}
      </ScrollView>
    );
  }

  return (
    <View
      className={cn('flex-row border-b border-border', className)}
      accessibilityRole="tablist"
    >
      {content}
    </View>
  );
};
