import React from 'react';

import {
  Card as PrimitiveCard,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@iconicedu/ui-native/components/ui/card';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { DENSITY_CARD_CLASS, cardClasses, useDensity } from '@iconicedu/ui-native/theme';

type PrimitiveCardProps = React.ComponentProps<typeof PrimitiveCard>;

export type CardProps = PrimitiveCardProps & {
  spacing?: 'compact' | 'default' | 'comfortable';
};

export const Card: React.FC<CardProps> = ({ spacing, className, children, ...rest }) => {
  const contextDensity = useDensity();
  const resolvedClass = spacing
    ? cardClasses[spacing]
    : DENSITY_CARD_CLASS[contextDensity];

  return (
    <PrimitiveCard className={cn(resolvedClass, className)} {...rest}>
      {children}
    </PrimitiveCard>
  );
};

export { CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
export type CardHeaderProps = React.ComponentProps<typeof CardHeader>;
export type CardTitleProps = React.ComponentProps<typeof CardTitle>;
export type CardDescriptionProps = React.ComponentProps<typeof CardDescription>;
export type CardContentProps = React.ComponentProps<typeof CardContent>;
export type CardFooterProps = React.ComponentProps<typeof CardFooter>;
