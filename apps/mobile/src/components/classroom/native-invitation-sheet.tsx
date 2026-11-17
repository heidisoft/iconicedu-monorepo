import React, { useState } from 'react';
import { NativeModules, Pressable, Share, Text, View } from 'react-native';
import { Copy, Share as ShareIcon, KeyRound, Link } from 'lucide-react-native';
import { NativeMeetingSheet } from './native-meeting-sheets';
import { useTheme } from '@/providers/theme-provider';

export function NativeInvitationSheet({
  open,
  onClose,
  title,
  link,
  passcode,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  link: string;
  passcode?: string | null;
}) {
  const { colors } = useTheme();
  const [status, setStatus] = useState('');
  const copy = async (text: string, label: string) => {
    try {
      if (!NativeModules.ClassroomControls?.copyText) throw new Error();
      await NativeModules.ClassroomControls.copyText(text);
      setStatus(`${label} copied`);
    } catch {
      setStatus('Unable to copy. Please retry.');
    }
  };
  const action = (label: string, Icon: typeof Copy, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.actionSubtle,
      }}
    >
      <Icon size={20} color={colors.text} />
      <Text style={{ color: colors.text, flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
  return (
    <NativeMeetingSheet open={open} title="Share meeting link" onClose={onClose}>
      <View style={{ padding: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Link size={20} color={colors.text} />
          <Text
            selectable
            accessibilityLabel="Meeting join link"
            style={{ color: colors.text, flex: 1 }}
          >
            {link}
          </Text>
        </View>
        {action('Copy join link', Copy, () => {
          void copy(link, 'Join link');
        })}
        {!!passcode && (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <KeyRound size={20} color={colors.text} />
              <Text
                selectable
                accessibilityLabel="Meeting passcode"
                style={{ color: colors.text }}
              >
                {passcode}
              </Text>
            </View>
            {action('Copy passcode', Copy, () => {
              void copy(passcode, 'Passcode');
            })}
          </>
        )}
        {action('Share invitation', ShareIcon, () => {
          void Share.share({
            message: [
              title,
              `Join link: ${link}`,
              passcode ? `Passcode: ${passcode}` : null,
            ]
              .filter(Boolean)
              .join('\n'),
          }).catch(() => setStatus('Unable to share. Please retry.'));
        })}
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
          {status}
        </Text>
      </View>
    </NativeMeetingSheet>
  );
}
