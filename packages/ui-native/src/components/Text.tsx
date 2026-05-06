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
      body: 'text-[15px] leading-[22px] text-foreground',
      'body-sm': 'text-[13px] leading-[18px] text-foreground',
      caption: 'text-[12px] leading-[18px] text-muted-foreground',
      label: 'text-[13px] font-medium text-muted-foreground',
      muted: 'text-[13px] text-muted-foreground',
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
