import React from 'react';
import {
  StyledView,
  StyledText,
  StyledPressable,
  StyledScrollView,
} from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

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
      <StyledPressable
        key={item.key}
        onPress={() => onTabPress(item.key)}
        className={cn(
          'flex-row items-center gap-1.5 border-b-2 px-4 pb-3 pt-2',
          isActive ? 'border-brand-500' : 'border-transparent',
        )}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: isActive }}
      >
        <StyledText
          className={cn(
            'text-sm font-medium',
            isActive ? 'text-white' : 'text-slate-400',
          )}
        >
          {item.label}
        </StyledText>
        {item.badge !== undefined && item.badge > 0 && (
          <StyledView className="items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5">
            <StyledText className="text-[10px] font-bold text-white">
              {item.badge > 99 ? '99+' : item.badge}
            </StyledText>
          </StyledView>
        )}
      </StyledPressable>
    );
  });

  if (scrollable) {
    return (
      <StyledScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className={cn('border-b border-slate-800', className)}
        accessibilityRole="tablist"
      >
        {content}
      </StyledScrollView>
    );
  }

  return (
    <StyledView
      className={cn('flex-row border-b border-slate-800', className)}
      accessibilityRole="tablist"
    >
      {content}
    </StyledView>
  );
};
