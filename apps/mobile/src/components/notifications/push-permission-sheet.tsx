import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@iconicedu/ui-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import {
  AVATAR_SIZE,
  COMPONENT_HEIGHT,
  FONT_SIZE,
  ICON_SIZE,
  LINE_HEIGHT,
  RADIUS,
  SPACING,
  typography,
} from '@/lib/typography';

function makeStyles(C: AppColors, bottomInset: number) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: SPACING[6],
      paddingBottom: Math.max(bottomInset, SPACING[6]),
      alignItems: 'center',
      gap: SPACING[4],
    },
    iconWrap: {
      width: AVATAR_SIZE['2xl'],
      height: AVATAR_SIZE['2xl'],
      borderRadius: AVATAR_SIZE['2xl'] / 2,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: FONT_SIZE['2xl'],
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
    },
    body: {
      fontSize: FONT_SIZE.md,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: LINE_HEIGHT.md,
    },
    btnPrimary: {
      width: '100%',
      minHeight: COMPONENT_HEIGHT.btnLg,
      borderRadius: RADIUS.md,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimaryLabel: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '700',
      color: C.tealFg,
    },
    btnSecondary: {
      width: '100%',
      minHeight: COMPONENT_HEIGHT.btn,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnSecondaryLabel: {
      ...typography.body,
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
    <BottomSheet
      visible={visible}
      onClose={onDismiss}
      partialHeight={380}
      backdropColor={colors.modalOverlay}
      sheetStyle={{ backgroundColor: colors.inputBg }}
      dragHandleStyle={{ backgroundColor: colors.border }}
    >
      <View style={s.content}>
        <View style={s.iconWrap}>
          <Bell size={ICON_SIZE['2xl']} color={colors.teal} />
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
