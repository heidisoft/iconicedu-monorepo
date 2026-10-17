import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { VideoOff, WifiOff } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
export function NativeConnectionHelp({
  cameraOn,
  onCameraOff,
}: {
  cameraOn: boolean;
  onCameraOff: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        gap: 4,
        padding: 10,
        borderRadius: 12,
        backgroundColor: colors.actionSubtle,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <WifiOff size={18} color={colors.text} />
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text, flex: 1 }}>
          Your connection is unstable.
        </Text>
      </View>
      <Text style={{ color: colors.textMuted }}>
        {cameraOn
          ? 'Turn off your camera to use less bandwidth. Your microphone will stay as it is.'
          : 'Your camera is off. Try a stronger Wi-Fi connection or move closer to your router.'}
      </Text>
      {cameraOn && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Turn camera off to improve connection"
          onPress={onCameraOff}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <VideoOff size={18} color={colors.text} />
          <Text style={{ color: colors.text }}>Turn camera off</Text>
        </Pressable>
      )}
    </View>
  );
}
