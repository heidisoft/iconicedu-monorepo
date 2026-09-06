import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
import type { ReleaseNotes } from '@/lib/release-notes';

type WhatsNewModalProps = {
  visible: boolean;
  releaseNotes: ReleaseNotes;
  onDismiss: () => void;
};

export function WhatsNewModal({ visible, releaseNotes, onDismiss }: WhatsNewModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <SafeAreaView style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onDismiss}
          testID="whats-new-backdrop"
        >
          <Pressable
            accessibilityRole="summary"
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[styles.badge, { backgroundColor: colors.tealBg }]}>
              <Text style={[styles.badgeText, { color: colors.teal }]}>Update</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {releaseNotes.title}
            </Text>
            <View style={styles.items}>
              {releaseNotes.items.map((item) => (
                <View key={item} style={styles.itemRow}>
                  <View style={[styles.bullet, { backgroundColor: colors.teal }]} />
                  <Text style={[styles.itemText, { color: colors.textMuted }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onDismiss}
              style={[styles.button, { backgroundColor: colors.action }]}
            >
              <Text style={[styles.buttonText, { color: colors.actionForeground }]}>
                Got it
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 8,
    padding: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    marginBottom: 18,
  },
  items: {
    gap: 14,
    marginBottom: 24,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 8,
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
