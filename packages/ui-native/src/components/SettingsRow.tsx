import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export type SettingsRowProps = {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  /** Hide the default chevron. Useful when providing a custom trailing. */
  hideChevron?: boolean;
  /** Text color for the label. Pass the themed color from useTheme(). */
  labelColor?: string;
  /** Color for the default chevron icon. */
  chevronColor?: string;
};

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  onPress,
  trailing,
  hideChevron = false,
  labelColor = '#0f172a',
  chevronColor = '#94a3b8',
}) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    activeOpacity={onPress ? 0.6 : 1}
    disabled={!onPress}
    accessibilityRole={onPress ? 'button' : 'text'}
    accessibilityLabel={label}
  >
    <View style={styles.iconWrap}>{icon}</View>
    <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    <View style={styles.trailing}>
      {trailing}
      {!hideChevron && !trailing && (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 18L15 12L9 6"
            stroke={chevronColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 30,
    alignItems: 'center',
    marginRight: 14,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
