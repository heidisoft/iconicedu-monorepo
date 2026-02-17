import React from 'react';
import {
  StyledView,
  StyledText,
  StyledPressable,
} from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

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
  <StyledView
    className={cn(
      'flex-row items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 pb-3 pt-2',
      className,
    )}
  >
    {onBack && (
      <StyledPressable
        onPress={onBack}
        className="active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <StyledText className="text-2xl text-brand-500">{'‹'}</StyledText>
      </StyledPressable>
    )}
    {leading}
    <StyledView className="min-w-0 flex-1">
      <StyledText
        className="text-base font-semibold text-white"
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
  </StyledView>
);
