import React from 'react';
import { type PressableProps } from 'react-native';
import {
  StyledPressable,
  StyledView,
  StyledText,
} from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

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
  <StyledPressable
    className={cn(
      'flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-slate-800/50',
      active && 'bg-slate-800',
      className,
    )}
    accessibilityRole="button"
    accessibilityLabel={title}
    accessibilityState={{ selected: active }}
    {...rest}
  >
    {leading && <StyledView className="shrink-0">{leading}</StyledView>}
    <StyledView className="min-w-0 flex-1 gap-0.5">
      <StyledText
        className={cn(
          'text-sm font-medium',
          active ? 'text-white' : 'text-slate-200',
        )}
        numberOfLines={1}
      >
        {title}
      </StyledText>
      {subtitle && (
        <StyledText className="text-xs text-slate-400" numberOfLines={1}>
          {subtitle}
        </StyledText>
      )}
    </StyledView>
    {trailing && <StyledView className="shrink-0">{trailing}</StyledView>}
  </StyledPressable>
);
