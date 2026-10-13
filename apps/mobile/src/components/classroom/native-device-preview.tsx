import React from 'react';
import { Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { AudioLines, Mic, MicOff, Settings, Video, VideoOff } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

type Props = {
  children: React.ReactNode;
  displayName: string;
  sessionName: string;
  camera: boolean;
  microphone: boolean;
  joining: boolean;
  onDisplayName: (name: string) => void;
  onCamera: () => void;
  onMicrophone: () => void;
  onSettings: () => void;
  onTest: () => void;
  onJoin: () => void;
};
/** Web preview hierarchy adapted to tablet columns and native touch targets. */
export function NativeDevicePreview(props: Props) {
  const { colors } = useTheme();
  const wide = useWindowDimensions().width >= 900;
  const iconButton = (label: string, Icon: typeof Mic, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={props.joining}
      onPress={onPress}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.actionSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: props.joining ? 0.5 : 1,
      }}
    >
      <Icon size={22} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24 }}>
      <View style={{ flex: wide ? 1 : undefined, gap: 12 }}>
        {props.children}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
          {iconButton(
            props.camera ? 'Turn camera off' : 'Turn camera on',
            props.camera ? Video : VideoOff,
            props.onCamera,
          )}
          {iconButton(
            props.microphone ? 'Join muted' : 'Join with microphone',
            props.microphone ? Mic : MicOff,
            props.onMicrophone,
          )}
          {iconButton('Settings', Settings, props.onSettings)}
          {iconButton('Test audio and video', AudioLines, props.onTest)}
        </View>
      </View>
      <View style={{ width: wide ? 320 : undefined, justifyContent: 'center', gap: 16 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '600' }}>
          {props.sessionName}
        </Text>
        <Text style={{ color: colors.textMuted }}>
          Check your camera and audio before joining.
        </Text>
        <TextInput
          accessibilityLabel="Your display name"
          value={props.displayName}
          onChangeText={props.onDisplayName}
          editable={!props.joining}
          maxLength={100}
          style={{
            color: colors.text,
            backgroundColor: colors.card,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.joining ? 'Joining…' : 'Join now'}
          disabled={props.joining}
          onPress={props.onJoin}
          style={{
            minHeight: 48,
            padding: 12,
            borderRadius: 24,
            alignItems: 'center',
            backgroundColor: colors.action,
            opacity: props.joining ? 0.5 : 1,
          }}
        >
          <Text style={{ color: colors.actionForeground, fontWeight: '600' }}>
            {props.joining ? 'Joining…' : 'Join now'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
