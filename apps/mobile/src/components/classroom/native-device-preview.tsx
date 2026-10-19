import React, { useState, useEffect } from 'react';
import {
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Check,
  Pencil,
  X,
  Mic,
  MicOff,
  Settings,
  Video,
  VideoOff,
} from 'lucide-react-native';
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
  onSettings?: () => void;
  onJoin: () => void;
  studentChoices?: React.ReactNode;
  joinDisabled?: boolean;
};
/** Web preview hierarchy adapted to tablet columns and native touch targets. */
export function NativeDevicePreview(props: Props) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.displayName);
  useEffect(() => {
    setDraft(props.displayName);
    setEditing(false);
  }, [props.displayName]);
  const saveName = () => {
    if (!draft.trim()) return;
    props.onDisplayName(draft.trim());
    setEditing(false);
    Keyboard.dismiss();
  };
  const wide = useWindowDimensions().width >= 900;
  const iconButton = (
    label: string,
    Icon: typeof Mic,
    onPress: () => void,
    disabled = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={props.joining || disabled}
      onPress={onPress}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.actionSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: props.joining || disabled ? 0.5 : 1,
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
          {props.onSettings && iconButton('Settings', Settings, props.onSettings)}
        </View>
      </View>
      <View style={{ width: wide ? 320 : undefined, justifyContent: 'center', gap: 16 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '600' }}>
          {props.sessionName}
        </Text>

        {props.studentChoices}
        {editing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              accessibilityLabel="Your display name"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveName}
              value={draft}
              onChangeText={setDraft}
              editable={!props.joining}
              maxLength={80}
              style={{
                flex: 1,
                color: colors.text,
                backgroundColor: colors.card,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
            {iconButton('Save name', Check, saveName, !draft.trim())}
            {iconButton('Cancel name change', X, () => {
              setEditing(false);
              Keyboard.dismiss();
            })}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change display name, currently ${props.displayName}`}
            disabled={props.joining}
            onPress={() => {
              setDraft(props.displayName);
              setEditing(true);
            }}
            style={{
              minHeight: 48,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              borderRadius: 24,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.text, flex: 1 }}>{props.displayName}</Text>
            <Pencil size={18} color={colors.text} />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.joining ? 'Joining…' : 'Join now'}
          disabled={props.joining || props.joinDisabled || editing}
          onPress={props.onJoin}
          style={{
            minHeight: 48,
            padding: 12,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
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
