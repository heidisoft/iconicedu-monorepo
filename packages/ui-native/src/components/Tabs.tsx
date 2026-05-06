import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { useUiTracking } from '@iconicedu/ui-native/lib/tracking-context';

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

type TabPressableProps = {
  item: TabItem;
  isActive: boolean;
  onTabPress: (key: string) => void;
};

const TabPressable: React.FC<TabPressableProps> = ({ item, isActive, onTabPress }) => {
  const track = useUiTracking();

  const handlePress = useCallback(() => {
    track('tab selected', {
      tab_key: item.key,
      tab_label: item.label,
      component_type: 'tab',
    });
    onTabPress(item.key);
  }, [track, item.key, item.label, onTabPress]);

  return (
    <Pressable
      key={item.key}
      onPress={handlePress}
      className={cn(
        'min-h-[44px] flex-row items-center gap-1.5 border-b-2 px-4 pb-3 pt-2',
        isActive ? 'border-primary' : 'border-transparent',
      )}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: isActive }}
    >
      <Text
        className={cn(
          'text-[15px] font-medium',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {item.label}
      </Text>
      {item.badge !== undefined && item.badge > 0 && (
        <View className="items-center justify-center rounded-full bg-primary px-1.5 py-0.5">
          <Text className="text-[11px] font-bold text-primary-foreground">
            {item.badge > 99 ? '99+' : item.badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  onTabPress,
  scrollable = false,
  className,
}) => {
  const content = items.map((item) => (
    <TabPressable
      key={item.key}
      item={item}
      isActive={item.key === activeKey}
      onTabPress={onTabPress}
    />
  ));

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
