import React from 'react';
import { Text, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

/** Local preview identity, including shared-device display names. */
export function NativePreviewAvatar({ name }: { name: string }) {
  const { colors } = useTheme();
  const initials = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '&')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name.trim() || 'Participant'} avatar, camera off`}
      style={{
        flex: 1,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: colors.actionSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {initials ? (
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: '600' }}>
            {initials}
          </Text>
        ) : (
          <UserRound size={44} color={colors.text} />
        )}
      </View>
    </View>
  );
}
