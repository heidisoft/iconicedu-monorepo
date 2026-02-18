import React, { useContext } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
} from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, TextClassContext } from '@iconicedu/ui-native/lib/utils';

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-2xl active:opacity-80',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        secondary: 'bg-secondary',
        ghost: 'bg-transparent',
        destructive: 'bg-destructive',
        outline: 'border border-border bg-transparent',
      },
      size: {
        sm: 'px-3 py-1.5',
        default: 'px-4 py-2.5',
        lg: 'px-6 py-3.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const buttonTextVariants = cva('font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-muted-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
    },
    size: {
      sm: 'text-xs',
      default: 'text-sm',
      lg: 'text-base',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

export type ButtonProps = PressableProps &
  VariantProps<typeof buttonVariants> & {
    /** Text label — for backward compat. Prefer children instead. */
    label?: string;
    loading?: boolean;
    disabled?: boolean;
    className?: string;
    textClassName?: string;
    children?: React.ReactNode;
  };

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'default',
  size = 'default',
  loading = false,
  disabled = false,
  className,
  textClassName,
  children,
  ...rest
}) => {
  const textClass = cn(
    buttonTextVariants({ variant, size }),
    textClassName,
  );

  return (
    <TextClassContext.Provider value={textClass}>
      <Pressable
        className={cn(
          buttonVariants({ variant, size }),
          disabled && 'opacity-50',
          className,
        )}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading }}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === 'ghost' || variant === 'outline'
                ? '#a1a1aa'
                : '#ffffff'
            }
          />
        ) : children ? (
          typeof children === 'string' ? (
            <Text className={textClass}>{children}</Text>
          ) : (
            children
          )
        ) : label ? (
          <Text className={textClass}>{label}</Text>
        ) : null}
      </Pressable>
    </TextClassContext.Provider>
  );
};

export { buttonVariants, buttonTextVariants };
