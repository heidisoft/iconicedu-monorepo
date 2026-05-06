import React from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';
import {
  cardClasses,
  typography,
  DENSITY_CARD_CLASS,
  useDensity,
} from '@iconicedu/ui-native/theme';

export type CardProps = ViewProps & {
  spacing?: 'compact' | 'default' | 'comfortable';
  className?: string;
  children: React.ReactNode;
};

export type CardHeaderProps = ViewProps & {
  className?: string;
  children: React.ReactNode;
};

export type CardTitleProps = {
  className?: string;
  children: React.ReactNode;
};

export type CardDescriptionProps = {
  className?: string;
  children: React.ReactNode;
};

export type CardContentProps = ViewProps & {
  className?: string;
  children: React.ReactNode;
};

export type CardFooterProps = ViewProps & {
  className?: string;
  children: React.ReactNode;
};

export const Card: React.FC<CardProps> = ({ spacing, className, children, ...rest }) => {
  const contextDensity = useDensity();
  const resolvedClass = spacing
    ? cardClasses[spacing]
    : DENSITY_CARD_CLASS[contextDensity];
  return (
    <View
      className={cn('border border-border bg-card', resolvedClass, className)}
      {...rest}
    >
      {children}
    </View>
  );
};

export const CardHeader: React.FC<CardHeaderProps> = ({
  className,
  children,
  ...rest
}) => (
  <View className={cn('gap-1.5 pb-3', className)} {...rest}>
    {children}
  </View>
);

export const CardTitle: React.FC<CardTitleProps> = ({ className, children }) => (
  <Text className={cn('text-headline font-semibold text-card-foreground', className)}>
    {children}
  </Text>
);

export const CardDescription: React.FC<CardDescriptionProps> = ({
  className,
  children,
}) => (
  <Text className={cn(typography.meta, 'text-muted-foreground', className)}>
    {children}
  </Text>
);

export const CardContent: React.FC<CardContentProps> = ({
  className,
  children,
  ...rest
}) => (
  <View className={className} {...rest}>
    {children}
  </View>
);

export const CardFooter: React.FC<CardFooterProps> = ({
  className,
  children,
  ...rest
}) => (
  <View className={cn('flex-row items-center pt-3', className)} {...rest}>
    {children}
  </View>
);
