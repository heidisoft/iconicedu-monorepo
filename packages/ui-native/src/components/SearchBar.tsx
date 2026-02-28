import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, type TextInputProps } from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { Search, X } from 'lucide-react-native';

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
    <View className={cn('flex-row items-center gap-2', className)}>
      <View className="flex-1 flex-row items-center rounded-xl bg-muted px-3 py-2.5">
        <Search size={16} color="#a1a1aa" style={{ marginRight: 8 }} />
        <TextInput
          className="flex-1 text-sm text-foreground"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#a1a1aa"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={placeholder}
          {...rest}
        />
        {value.length > 0 && (
          <Pressable
            onPress={() => onChangeText('')}
            accessibilityLabel="Clear search"
          >
            <X size={16} color="#a1a1aa" />
          </Pressable>
        )}
      </View>
      {(showCancel || focused) && onCancel && (
        <Pressable
          onPress={handleCancel}
          accessibilityLabel="Cancel search"
        >
          <Text className="text-sm text-primary">Cancel</Text>
        </Pressable>
      )}
    </View>
  );
};
