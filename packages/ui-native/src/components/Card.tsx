import React from 'react';
import { type ViewProps } from 'react-native';
import { StyledView, StyledText } from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

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
  <StyledView
    className={cn(
      'rounded-2xl border border-slate-800 bg-slate-900 p-4',
      className,
    )}
    {...rest}
  >
    {children}
  </StyledView>
);

export const CardHeader: React.FC<CardHeaderProps> = ({
  className,
  children,
  ...rest
}) => (
  <StyledView className={cn('gap-1.5 pb-3', className)} {...rest}>
    {children}
  </StyledView>
);

export const CardTitle: React.FC<CardTitleProps> = ({
  className,
  children,
}) => (
  <StyledText className={cn('text-lg font-semibold text-white', className)}>
    {children}
  </StyledText>
);

export const CardDescription: React.FC<CardDescriptionProps> = ({
  className,
  children,
}) => (
  <StyledText className={cn('text-sm text-slate-400', className)}>
    {children}
  </StyledText>
);

export const CardContent: React.FC<CardContentProps> = ({
  className,
  children,
  ...rest
}) => (
  <StyledView className={className} {...rest}>
    {children}
  </StyledView>
);

export const CardFooter: React.FC<CardFooterProps> = ({
  className,
  children,
  ...rest
}) => (
  <StyledView
    className={cn('flex-row items-center pt-3', className)}
    {...rest}
  >
    {children}
  </StyledView>
);
