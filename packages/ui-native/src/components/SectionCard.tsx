import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

export type SectionCardVariant = 'white' | 'tint' | 'dark';

export type SectionCardProps = {
  children: React.ReactNode;
  variant?: SectionCardVariant;
  padding?: number;
  radius?: number;
  style?: ViewStyle;
};

const BG: Record<SectionCardVariant, string> = {
  white: '#ffffff',
  tint: '#f0fdf7',
  dark: '#0f172a',
};

const BORDER: Record<SectionCardVariant, string | undefined> = {
  white: '#e2e8f0',
  tint: '#bbf7d0',
  dark: undefined,
};

export const SectionCard: React.FC<SectionCardProps> = ({
  children,
  variant = 'white',
  padding = 16,
  radius = 16,
  style,
}) => (
  <View
    style={[
      styles.base,
      {
        backgroundColor: BG[variant],
        padding,
        borderRadius: radius,
        borderWidth: BORDER[variant] ? 1 : 0,
        borderColor: BORDER[variant] ?? 'transparent',
      },
      style,
    ]}
  >
    {children}
  </View>
);

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
