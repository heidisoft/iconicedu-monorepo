import React from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@iconicedu/ui-native/lib/utils';

const chipVariants = cva(
  'flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-80',
  {
    variants: {
      variant: {
        default: 'bg-secondary',
        active: 'bg-primary',
        outline: 'border border-border bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const chipTextVariants = cva('text-xs font-medium', {
  variants: {
    variant: {
      default: 'text-secondary-foreground',
      active: 'text-primary-foreground',
      outline: 'text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type ChipProps = PressableProps &
  VariantProps<typeof chipVariants> & {
    label: string;
    icon?: React.ReactNode;
    className?: string;
  };

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'default',
  icon,
  className,
  ...rest
}) => (
  <Pressable
    className={cn(chipVariants({ variant }), className)}
    accessibilityRole="button"
    accessibilityLabel={label}
    {...rest}
  >
    {icon}
    <Text className={cn(chipTextVariants({ variant }))}>
      {label}
    </Text>
  </Pressable>
);

export { chipVariants, chipTextVariants };
