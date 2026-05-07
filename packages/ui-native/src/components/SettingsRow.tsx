import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { useUiTracking } from '@iconicedu/ui-native/lib/tracking-context';
import {
  COMPONENT_HEIGHT,
  FONT_SIZE,
  ICON_SIZE,
  SPACING,
} from '@iconicedu/ui-native/theme';

export type SettingsRowProps = {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  /** Hide the default chevron. Useful when providing a custom trailing. */
  hideChevron?: boolean;
  /**
   * Optional explicit label color override. When omitted, NativeWind `text-foreground`
   * is used, which automatically adapts to light/dark mode.
   * Pass only when you need a non-default color (destructive, accent, muted).
   */
  labelColor?: string;
  /**
   * Optional explicit chevron color override. When omitted, NativeWind
   * `text-muted-foreground` is used automatically.
   */
  chevronColor?: string;
};

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  onPress,
  trailing,
  hideChevron = false,
  labelColor,
  chevronColor,
}) => {
  const track = useUiTracking();

  const handlePress = onPress
    ? () => {
        track('settings row tapped', {
          button_name: label,
          component_type: 'settings_row',
        });
        onPress();
      }
    : undefined;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={handlePress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
    >
      <View style={styles.iconWrap}>{icon}</View>
      {labelColor ? (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      ) : (
        <Text className={cn('flex-1 text-body font-medium text-foreground')}>
          {label}
        </Text>
      )}
      <View style={styles.trailing}>
        {trailing}
        {!hideChevron &&
          !trailing &&
          (chevronColor ? (
            <ChevronRight size={ICON_SIZE.sm} color={chevronColor} />
          ) : (
            <ChevronRight size={ICON_SIZE.sm} className="text-muted-foreground" />
          ))}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: COMPONENT_HEIGHT.row,
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[4],
  },
  iconWrap: {
    width: ICON_SIZE['2xl'],
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  label: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
