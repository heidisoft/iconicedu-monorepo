import React from 'react';
import { View, type TextInputProps } from 'react-native';

import { Input as PrimitiveInput } from '@iconicedu/ui-native/components/ui/input';
import { Label } from '@iconicedu/ui-native/components/ui/label';
import { Text } from '@iconicedu/ui-native/components/ui/text';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { inputClasses } from '@iconicedu/ui-native/theme';

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  size?: 'sm' | 'default' | 'md' | 'lg';
  className?: string;
  containerClassName?: string;
};

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  size = 'default',
  className,
  containerClassName,
  ...rest
}) => (
  <View className={cn('gap-1.5', containerClassName)}>
    {label && <Label>{label}</Label>}
    <PrimitiveInput
      className={cn(inputClasses[size], error && 'border-destructive', className)}
      placeholderTextColor="#a1a1aa"
      accessibilityLabel={label}
      accessibilityState={{ disabled: rest.editable === false }}
      {...rest}
    />
    {error && <Text className="text-destructive text-[12px]">{error}</Text>}
    {helperText && !error && (
      <Text className="text-muted-foreground text-[12px]">{helperText}</Text>
    )}
  </View>
);
