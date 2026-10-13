import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
export function NativeClassroomSettings({
  open,
  tab,
  onTab,
  onClose,
  audio,
  video,
  error,
}: {
  open: boolean;
  tab: 'audio' | 'video';
  onTab: (tab: 'audio' | 'video') => void;
  onClose: () => void;
  audio: React.ReactNode;
  video: React.ReactNode;
  error?: string | null;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 16,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              alignSelf: 'center',
              width: '100%',
              maxWidth: 600,
              maxHeight: '90%',
              backgroundColor: colors.card,
              borderRadius: 24,
              padding: 20,
              gap: 16,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                accessibilityRole="header"
                style={{ color: colors.text, fontSize: 22, fontWeight: '600' }}
              >
                Settings
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close settings"
                onPress={onClose}
                style={{ padding: 12 }}
              >
                <X size={20} color={colors.text} />
              </Pressable>
            </View>
            <View
              accessibilityRole="tablist"
              style={{
                flexDirection: 'row',
                backgroundColor: colors.actionSubtle,
                borderRadius: 12,
                padding: 4,
              }}
            >
              {(['audio', 'video'] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityLabel={
                    value === 'audio' ? 'Audio settings tab' : 'Video settings tab'
                  }
                  accessibilityState={{ selected: value === tab }}
                  onPress={() => onTab(value)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: value === tab ? colors.card : undefined,
                  }}
                >
                  <Text style={{ color: colors.text }}>
                    {value === 'audio' ? 'Audio' : 'Video'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 12 }}
            >
              {error && (
                <Text accessibilityRole="alert" style={{ color: colors.red }}>
                  {error}
                </Text>
              )}
              {tab === 'audio' ? audio : video}
            </ScrollView>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
