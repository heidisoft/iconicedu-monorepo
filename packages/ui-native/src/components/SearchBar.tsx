import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  type TextInputProps,
  StyleSheet,
} from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { Search, X } from 'lucide-react-native';
import { ICON_SIZE, SPACING, inputClasses, typography } from '@iconicedu/ui-native/theme';

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
      <View className={cn('flex-1 flex-row items-center bg-muted', inputClasses.default)}>
        <Search size={ICON_SIZE.sm} color="#a1a1aa" style={styles.searchIcon} />
        <TextInput
          className={cn('flex-1 text-foreground', typography.body)}
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
          <Pressable onPress={() => onChangeText('')} accessibilityLabel="Clear search">
            <X size={ICON_SIZE.sm} color="#a1a1aa" />
          </Pressable>
        )}
      </View>
      {(showCancel || focused) && onCancel && (
        <Pressable onPress={handleCancel} accessibilityLabel="Cancel search">
          <Text className={cn(typography.body, 'text-primary')}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  searchIcon: { marginRight: SPACING[2] },
});
