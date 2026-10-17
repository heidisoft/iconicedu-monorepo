import { useReducedMotion } from './use-reduced-motion';
import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { NativeParticipant } from '@/lib/classroom/meeting-controller';
import { NativeVideoView } from './native-video-view';
export function NativeFocusedVideo({
  user,
  sharing,
  onClose,
  shareContent,
}: {
  user?: NativeParticipant;
  sharing: boolean;
  onClose: () => void;
  shareContent?: (height: number) => React.ReactNode;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [contentHeight, setContentHeight] = useState(0);
  return (
    <Modal
      visible={!!user}
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View
            style={{
              flexDirection: 'row',
              padding: 12,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                sharing ? 'Collapse shared screen' : 'Close focused video'
              }
              onPress={onClose}
              style={{ padding: 12 }}
            >
              <X size={24} color={colors.text} />
            </Pressable>
            <Text accessibilityRole="header" style={{ color: colors.text }}>
              {user?.name}
              {sharing ? ' — shared screen' : ''}
            </Text>
          </View>
          {user && sharing && shareContent ? (
            <View
              testID="focused-share-content"
              style={{ flex: 1 }}
              onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
            >
              {shareContent(contentHeight)}
            </View>
          ) : user && (user.video || sharing) ? (
            <NativeVideoView userId={user.id} sharing={sharing} style={{ flex: 1 }} />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 48 }}>
                {user?.name
                  .split(/\s+/)
                  .map((name) => name[0])
                  .slice(0, 2)
                  .join('')}
              </Text>
            </View>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
