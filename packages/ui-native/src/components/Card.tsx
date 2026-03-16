import React from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';

export type CardProps = ViewProps & {
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

export const Card: React.FC<CardProps> = ({ className, children, ...rest }) => (
  <View
    className={cn('rounded-2xl border border-border bg-card p-4', className)}
    {...rest}
  >
    {children}
  </View>
);

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
  <Text className={cn('text-lg font-semibold text-card-foreground', className)}>
    {children}
  </Text>
);

export const CardDescription: React.FC<CardDescriptionProps> = ({
  className,
  children,
}) => <Text className={cn('text-sm text-muted-foreground', className)}>{children}</Text>;

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
