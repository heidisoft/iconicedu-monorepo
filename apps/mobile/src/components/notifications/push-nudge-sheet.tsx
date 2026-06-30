import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Bell, BellOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@iconicedu/ui-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import type { NudgeVariant } from '@/hooks/use-push-nudge';

const AMBER_BG_LIGHT = '#fffbeb';
const AMBER_BG_DARK = '#2d1900';
const AMBER_ICON = '#f59e0b';

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
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
    },
    body: {
      fontSize: 16,
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
      fontSize: 17,
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
      fontSize: 16,
      color: C.textMuted,
    },
  });
}

type Props = {
  visible: boolean;
  variant: NudgeVariant;
  onEnable: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
};

export function PushNudgeSheet({
  visible,
  variant,
  onEnable,
  onOpenSettings,
  onDismiss,
}: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom]);

  const isRequestVariant = variant === 'request-permission';
  const isEnableInAppVariant = variant === 'enable-in-app';

  const iconBg = isRequestVariant
    ? colors.tealBg
    : isDark
      ? AMBER_BG_DARK
      : AMBER_BG_LIGHT;
  const iconColor = isRequestVariant ? colors.teal : AMBER_ICON;

  const iosBody =
    'To get class reminders, tutor messages, and schedule changes, go to Settings → Notifications → ICONIC Academy and turn on Allow Notifications.';
  const androidBody =
    'To get class reminders, tutor messages, and schedule changes, open Settings, find ICONIC Academy under Apps, and enable Notifications.';

  return (
    <BottomSheet
      visible={visible}
      onClose={onDismiss}
      partialHeight={isRequestVariant ? 380 : 420}
      backdropColor={colors.modalOverlay}
      sheetStyle={{ backgroundColor: colors.inputBg }}
      dragHandleStyle={{ backgroundColor: colors.border }}
    >
      <View style={s.content}>
        <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
          {isRequestVariant ? (
            <Bell size={32} color={iconColor} />
          ) : (
            <BellOff size={32} color={iconColor} />
          )}
        </View>

        <Text style={s.title}>
          {isRequestVariant
            ? 'Stay on top of classes'
            : isEnableInAppVariant
              ? 'Turn class reminders back on'
              : 'Enable notifications in Settings'}
        </Text>

        <Text style={s.body}>
          {isRequestVariant
            ? 'Get reminders before sessions, tutor messages, and schedule changes. No marketing notifications.'
            : isEnableInAppVariant
              ? 'Class reminders are allowed by your device but turned off in ICONIC Academy. Turn them back on for sessions, messages, and schedule changes.'
              : Platform.OS === 'ios'
                ? iosBody
                : androidBody}
        </Text>

        <TouchableOpacity
          style={s.btnPrimary}
          onPress={isRequestVariant || isEnableInAppVariant ? onEnable : onOpenSettings}
          activeOpacity={0.8}
        >
          <Text style={s.btnPrimaryLabel}>
            {isRequestVariant || isEnableInAppVariant
              ? 'Turn on class reminders'
              : 'Open Settings'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.btnSecondary} onPress={onDismiss} activeOpacity={0.7}>
          <Text style={s.btnSecondaryLabel}>Not Now</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}
