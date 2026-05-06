import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  className?: string;
  containerClassName?: string;
};

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className,
  containerClassName,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  return (
    <View className={cn('gap-1.5', containerClassName)}>
      {label && (
        <Text className="text-[13px] font-medium text-muted-foreground">{label}</Text>
      )}
      <TextInput
        className={cn(
          'min-h-[48px] rounded-xl border px-4 py-3 text-[15px] text-foreground bg-card',
          focused ? 'border-ring' : 'border-input',
          error && 'border-destructive',
          className,
        )}
        placeholderTextColor="#a1a1aa"
        onFocus={handleFocus}
        onBlur={handleBlur}
        accessibilityLabel={label}
        accessibilityState={{ disabled: rest.editable === false }}
        {...rest}
      />
      {error && <Text className="text-[12px] text-destructive">{error}</Text>}
      {helperText && !error && (
        <Text className="text-[12px] text-muted-foreground">{helperText}</Text>
      )}
    </View>
  );
};
