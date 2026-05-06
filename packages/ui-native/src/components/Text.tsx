import React, { useContext } from 'react';
import { Text, type TextProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, TextClassContext } from '@iconicedu/ui-native/lib/utils';
import { typography } from '@iconicedu/ui-native/theme';

const typographyVariants = cva('', {
  variants: {
    variant: {
      h1: 'text-title-lg font-bold text-foreground',
      h2: 'text-title font-semibold text-foreground',
      h3: 'text-headline font-semibold text-foreground',
      h4: `${typography.bodyLarge} font-medium text-foreground`,
      body: `${typography.body} text-foreground`,
      'body-sm': `${typography.meta} text-foreground`,
      caption: `${typography.caption} text-muted-foreground`,
      label: 'text-meta font-medium text-muted-foreground',
      muted: 'text-meta text-muted-foreground',
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
      className={cn(typographyVariants({ variant }), textClass, className)}
      accessibilityRole={variant?.startsWith('h') ? 'header' : 'text'}
      {...rest}
    >
      {children}
    </Text>
  );
};

export { typographyVariants };
