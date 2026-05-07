import React from 'react';

import { Text as PrimitiveText } from '@iconicedu/ui-native/components/ui/text';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { typography } from '@iconicedu/ui-native/theme';

const typographyVariants = {
  h1: 'text-title-lg font-bold text-foreground',
  h2: 'text-title font-semibold text-foreground',
  h3: 'text-headline font-semibold text-foreground',
  h4: `${typography.bodyLarge} font-medium text-foreground`,
  body: `${typography.body} text-foreground`,
  'body-sm': `${typography.meta} text-foreground`,
  caption: `${typography.caption} text-muted-foreground`,
  label: 'text-meta font-medium text-muted-foreground',
  muted: 'text-meta text-muted-foreground',
} as const;

export type TypographyProps = Omit<
  React.ComponentProps<typeof PrimitiveText>,
  'variant'
> & {
  variant?: keyof typeof typographyVariants;
  children: React.ReactNode;
};

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  className,
  children,
  ...rest
}) => (
  <PrimitiveText
    className={cn(typographyVariants[variant], className)}
    accessibilityRole={variant.startsWith('h') ? 'header' : 'text'}
    {...rest}
  >
    {children}
  </PrimitiveText>
);

export { typographyVariants };
