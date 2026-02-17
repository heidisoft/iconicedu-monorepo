import React from 'react';
import { StyledView, StyledText } from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export type BadgeProps = {
  count?: number;
  label?: string;
  variant?: BadgeVariant;
  maxCount?: number;
  dot?: boolean;
  className?: string;
};

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-600',
  success: 'bg-green-600',
  warning: 'bg-yellow-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
};

export const Badge: React.FC<BadgeProps> = ({
  count,
  label,
  variant = 'default',
  maxCount = 99,
  dot = false,
  className,
}) => {
  if (dot) {
    return (
      <StyledView
        className={cn(
          'h-2 w-2 rounded-full',
          variantStyles[variant],
          className,
        )}
        accessibilityLabel="New notification"
      />
    );
  }

  const displayText =
    label ??
    (count !== undefined
      ? count > maxCount
        ? `${maxCount}+`
        : String(count)
      : undefined);

  if (displayText === undefined) return null;

  return (
    <StyledView
      className={cn(
        'items-center justify-center rounded-full px-2 py-0.5',
        variantStyles[variant],
        className,
      )}
      accessibilityLabel={`${displayText} notifications`}
    >
      <StyledText className="text-[10px] font-bold text-white">
        {displayText}
      </StyledText>
    </StyledView>
  );
};
