import React from 'react';
import { StyledView, StyledText } from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

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
  <StyledView
    className={cn(
      'flex-1 items-center justify-center gap-3 px-8 py-12',
      className,
    )}
    accessibilityRole="text"
  >
    {icon && <StyledView className="mb-2">{icon}</StyledView>}
    <StyledText className="text-center text-lg font-semibold text-white">
      {title}
    </StyledText>
    {description && (
      <StyledText className="text-center text-sm text-slate-400">
        {description}
      </StyledText>
    )}
    {action && <StyledView className="mt-4">{action}</StyledView>}
  </StyledView>
);
