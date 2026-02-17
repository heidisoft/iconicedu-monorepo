import React, { useState, useCallback } from 'react';
import { type TextInputProps } from 'react-native';
import {
  StyledView,
  StyledText,
  StyledTextInput,
  StyledPressable,
} from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

export type SearchBarProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  onCancel?: () => void;
  showCancel?: boolean;
  className?: string;
};

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onCancel,
  showCancel = false,
  className,
  placeholder = 'Search...',
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  const handleCancel = useCallback(() => {
    onChangeText('');
    onCancel?.();
  }, [onChangeText, onCancel]);

  return (
    <StyledView className={cn('flex-row items-center gap-2', className)}>
      <StyledView className="flex-1 flex-row items-center rounded-xl bg-slate-800 px-3 py-2.5">
        <StyledText className="mr-2 text-slate-400">{'🔍'}</StyledText>
        <StyledTextInput
          className="flex-1 text-sm text-white"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#64748b"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={placeholder}
          {...rest}
        />
        {value.length > 0 && (
          <StyledPressable
            onPress={() => onChangeText('')}
            accessibilityLabel="Clear search"
          >
            <StyledText className="text-slate-400">{'✕'}</StyledText>
          </StyledPressable>
        )}
      </StyledView>
      {(showCancel || focused) && onCancel && (
        <StyledPressable
          onPress={handleCancel}
          accessibilityLabel="Cancel search"
        >
          <StyledText className="text-sm text-brand-500">Cancel</StyledText>
        </StyledPressable>
      )}
    </StyledView>
  );
};
