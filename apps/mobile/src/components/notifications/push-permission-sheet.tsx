import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@iconicedu/ui-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function makeStyles(C: AppColors, bottomInset: number) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: 24,
      paddingBottom: Math.max(bottomInset, 24),
      alignItems: 'center',
      gap: 16,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
    },
    body: {
      fontSize: 15,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
    btnPrimary: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: C.teal,
      alignItems: 'center',
    },
    btnPrimaryLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: C.tealFg,
    },
    btnSecondary: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    btnSecondaryLabel: {
      fontSize: 15,
      color: C.textMuted,
    },
  });
}

type Props = {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
};

export function PushPermissionSheet({ visible, onEnable, onDismiss }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom]);

  return (
    <BottomSheet visible={visible} onClose={onDismiss} partialHeight={380}>
      <View style={s.content}>
        <View style={s.iconWrap}>
          <Bell size={32} color={colors.teal} />
        </View>
        <Text style={s.title}>Stay in the loop</Text>
        <Text style={s.body}>
          Get notified about class sessions, messages, homework updates, and more — right
          when they happen.
        </Text>
        <TouchableOpacity style={s.btnPrimary} onPress={onEnable} activeOpacity={0.8}>
          <Text style={s.btnPrimaryLabel}>Enable Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} onPress={onDismiss} activeOpacity={0.7}>
          <Text style={s.btnSecondaryLabel}>Not Now</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}
