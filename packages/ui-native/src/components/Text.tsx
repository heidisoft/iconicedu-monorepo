import React, { useContext } from 'react';
import { Text, type TextProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, TextClassContext } from '@iconicedu/ui-native/lib/utils';

const typographyVariants = cva('', {
  variants: {
    variant: {
      h1: 'text-3xl font-bold text-foreground',
      h2: 'text-2xl font-semibold text-foreground',
      h3: 'text-xl font-semibold text-foreground',
      h4: 'text-lg font-medium text-foreground',
      body: 'text-base text-foreground',
      'body-sm': 'text-sm text-foreground',
      caption: 'text-xs text-muted-foreground',
      label: 'text-sm font-medium text-muted-foreground',
      muted: 'text-sm text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'body',
  },
});

export type TypographyProps = TextProps &
  VariantProps<typeof typographyVariants> & {
    className?: string;
    children: React.ReactNode;
  };

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  className,
  children,
  ...rest
}) => {
  const textClass = useContext(TextClassContext);

  return (
    <Text
      className={cn(
        typographyVariants({ variant }),
        textClass,
        className,
      )}
      accessibilityRole={variant?.startsWith('h') ? 'header' : 'text'}
      {...rest}
    >
      {children}
    </Text>
  );
};

export { typographyVariants };
