import React from 'react';
import { type TextProps } from 'react-native';
import { StyledText } from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'label'
  | 'muted';

export type TypographyProps = TextProps & {
  variant?: TextVariant;
  className?: string;
  children: React.ReactNode;
};

const variantStyles: Record<TextVariant, string> = {
  h1: 'text-3xl font-bold text-white',
  h2: 'text-2xl font-semibold text-white',
  h3: 'text-xl font-semibold text-white',
  h4: 'text-lg font-medium text-white',
  body: 'text-base text-slate-200',
  'body-sm': 'text-sm text-slate-200',
  caption: 'text-xs text-slate-400',
  label: 'text-sm font-medium text-slate-300',
  muted: 'text-sm text-slate-500',
};

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  className,
  children,
  ...rest
}) => (
  <StyledText
    className={cn(variantStyles[variant], className)}
    accessibilityRole={variant.startsWith('h') ? 'header' : 'text'}
    {...rest}
  >
    {children}
  </StyledText>
);
