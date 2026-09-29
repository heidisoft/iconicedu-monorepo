import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';

type UpdateRequiredBannerProps = {
  visible: boolean;
  message: string;
  storeUrl: string;
  onDismiss: () => void;
};

export function UpdateRequiredBanner({
  visible,
  message,
  storeUrl,
  onDismiss,
}: UpdateRequiredBannerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { paddingTop: insets.top }]}
      testID="update-required-banner-overlay"
    >
      <View
        style={[
          styles.banner,
          { backgroundColor: colors.warningSubtle, borderColor: colors.warning },
        ]}
      >
        <View style={styles.textColumn}>
          <Text style={[styles.title, { color: colors.text }]}>Update available</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openURL(storeUrl).catch(() => null)}
            style={[styles.updateButton, { backgroundColor: colors.warning }]}
          >
            <Text style={[styles.updateButtonText, { color: colors.warningForeground }]}>
              Update
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss update notification"
            onPress={onDismiss}
            style={styles.dismissButton}
            hitSlop={8}
          >
            <Text style={[styles.dismissText, { color: colors.textMuted }]}>✕</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 900,
    pointerEvents: 'box-none',
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  updateButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  updateButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dismissButton: {
    padding: 6,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
