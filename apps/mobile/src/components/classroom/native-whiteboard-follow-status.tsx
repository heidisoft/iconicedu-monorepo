import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Binoculars, Hand } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
export function NativeWhiteboardFollowStatus({
  following,
  label,
  status,
  onExplore,
  onTutor,
}: {
  following: boolean;
  label: string;
  status: 'waiting' | 'following' | 'reconnecting';
  onExplore: () => void;
  onTutor: () => void;
}) {
  const { colors } = useTheme();
  const Icon = following ? Binoculars : Hand;
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
      }}
    >
      <Icon size={18} color={colors.text} />
      <Text
        accessibilityLiveRegion="polite"
        style={{ color: colors.text, flex: 1, minWidth: 120 }}
      >
        {following
          ? status === 'waiting'
            ? `${label} · waiting for their view`
            : status === 'reconnecting'
              ? `${label} · reconnecting`
              : label
          : 'Exploring freely'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          following ? 'Explore whiteboard freely' : 'Resume following tutor'
        }
        onPress={following ? onExplore : onTutor}
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 10,
          borderRadius: 22,
          backgroundColor: colors.actionSubtle,
        }}
      >
        {following ? (
          <Hand size={18} color={colors.text} />
        ) : (
          <Binoculars size={18} color={colors.text} />
        )}
        <Text style={{ color: colors.text }}>
          {following ? 'Explore freely' : 'Follow tutor'}
        </Text>
      </Pressable>
    </View>
  );
}
