import React, { useState, useCallback } from 'react';
import { type TextInputProps } from 'react-native';
import { StyledView, StyledText, StyledTextInput } from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

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
    <StyledView className={cn('gap-1.5', containerClassName)}>
      {label && (
        <StyledText className="text-sm font-medium text-slate-300">
          {label}
        </StyledText>
      )}
      <StyledTextInput
        className={cn(
          'rounded-xl border px-4 py-3 text-base text-white',
          focused ? 'border-brand-500' : 'border-slate-700',
          error ? 'border-red-500' : undefined,
          'bg-slate-900',
          className,
        )}
        placeholderTextColor="#64748b"
        onFocus={handleFocus}
        onBlur={handleBlur}
        accessibilityLabel={label}
        accessibilityState={{ disabled: rest.editable === false }}
        {...rest}
      />
      {error && (
        <StyledText className="text-xs text-red-400">{error}</StyledText>
      )}
      {helperText && !error && (
        <StyledText className="text-xs text-slate-500">{helperText}</StyledText>
      )}
    </StyledView>
  );
};
