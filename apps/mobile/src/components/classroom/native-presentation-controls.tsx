import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Fullscreen, Minimize, ShieldCheck, ShieldOff } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

/** Presentation actions stay beside the shared content, outside the call's More menu. */
export function NativePresentationControls({
  onFullscreen,
  expanded = false,
  annotationsEnabled,
  onToggleAnnotations,
}: {
  onFullscreen?: () => void;
  expanded?: boolean;
  annotationsEnabled?: boolean;
  onToggleAnnotations?: () => void;
}) {
  const { colors } = useTheme();
  const permissionLabel = annotationsEnabled
    ? 'Disable participant annotations'
    : 'Allow participant annotations';
  const actions = [
    ...(onToggleAnnotations
      ? [
          {
            label: permissionLabel,
            Icon: annotationsEnabled ? ShieldCheck : ShieldOff,
            onPress: onToggleAnnotations,
          },
        ]
      : []),
    ...(onFullscreen
      ? [
          {
            label: expanded
              ? 'Collapse shared screen'
              : 'Expand shared screen to full screen',
            Icon: expanded ? Minimize : Fullscreen,
            onPress: onFullscreen,
          },
        ]
      : []),
  ];
  if (!actions.length) return null;
  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Screen share controls"
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        zIndex: 20,
        flexDirection: 'row',
        gap: 8,
      }}
    >
      {actions.map(({ label, Icon, onPress }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          onLongPress={() => Alert.alert(label)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Icon size={20} color={colors.text} />
        </Pressable>
      ))}
    </View>
  );
}
