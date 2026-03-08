import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

export function ChannelListSkeleton({ count = 5 }: Props) {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Loading" style={s.wrap}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={s.row}>
            {/* Avatar — 52×52 circle for DMs, matches itemAvatar */}
            <PulseBox width={52} height={52} radius={26} />

            <View style={s.content}>
              {/* Top row: name (flex) + timestamp (right) */}
              <View style={s.topRow}>
                <PulseBox width={i % 2 === 0 ? 140 : 120} height={14} radius={4} />
                <PulseBox width={36} height={11} radius={4} />
              </View>
              {/* Bottom row: preview text */}
              <PulseBox width={i % 3 === 0 ? 220 : 190} height={12} radius={4} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 10 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  content: { flex: 1, gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
