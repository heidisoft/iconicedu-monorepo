import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Hand, SmilePlus } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

/** Same order as web's REACTION_EMOJIS so both clients show the same picker. */
export const REACTION_EMOJIS = ['👍', '👏', '🎉', '❤️', '😂'] as const;

export function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** Web's toolbar timer and recording badge; counts from when this device connected. */
export function NativeMeetingStatus({
  recording,
  paused,
}: {
  recording: boolean;
  paused: boolean;
}) {
  const { colors } = useTheme();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text
        accessibilityLabel={`Time in class ${formatElapsed(elapsed)}`}
        style={{ color: colors.text, fontVariant: ['tabular-nums'], fontWeight: '600' }}
      >
        {formatElapsed(elapsed)}
      </Text>
      {recording && (
        <View
          accessibilityLabel={paused ? 'Recording paused' : 'Recording active'}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: colors.card,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: paused ? colors.textMuted : colors.red,
            }}
          />
          <Text style={{ color: colors.text }}>
            {paused ? 'Recording paused' : 'Recording'}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Web keeps hand raise and reactions in a dock beside the toolbar, not in More. */
export function NativeHandAndReactions({
  raised,
  onHand,
  onReact,
}: {
  raised: boolean;
  onHand: () => void;
  onReact: (emoji: string) => void;
}) {
  const { colors } = useTheme();
  const [picking, setPicking] = useState(false);
  const round = {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={raised ? 'Lower hand' : 'Raise hand'}
        accessibilityState={{ selected: raised }}
        onPress={onHand}
        style={{
          ...round,
          backgroundColor: raised ? colors.action : colors.actionSubtle,
        }}
      >
        <Hand size={22} color={raised ? colors.actionForeground : colors.text} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={picking ? 'Close reactions' : 'Open reactions'}
        accessibilityState={{ expanded: picking }}
        onPress={() => setPicking(!picking)}
        style={{ ...round, backgroundColor: colors.actionSubtle }}
      >
        <SmilePlus size={22} color={colors.text} />
      </Pressable>
      {picking && (
        <View
          accessibilityLabel="Reactions"
          style={{
            flexDirection: 'row',
            gap: 4,
            padding: 4,
            borderRadius: 16,
            backgroundColor: colors.card,
          }}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`React ${emoji}`}
              onPress={() => {
                setPicking(false);
                onReact(emoji);
              }}
              style={{ ...round, width: 40, height: 40 }}
            >
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
