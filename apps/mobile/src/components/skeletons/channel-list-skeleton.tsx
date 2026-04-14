import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

export function ChannelListSkeleton({ count = 5 }: Props) {
  return (
    <View accessibilityLabel="Loading" style={s.wrap}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={s.itemOuter}>
          <View style={s.row}>
            <PulseBox width={44} height={44} radius={22} />

            <View style={s.content}>
              <View style={s.topRow}>
                <PulseBox width={i % 2 === 0 ? 140 : 120} height={16} radius={4} />
              </View>
              <PulseBox width={i % 3 === 0 ? 220 : 190} height={12} radius={4} />
            </View>

            <View style={s.rowTail}>
              <PulseBox width={36} height={11} radius={4} />
              {i % 2 === 0 ? <PulseBox width={20} height={20} radius={10} /> : <View />}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingBottom: 24 },
  itemOuter: { marginHorizontal: 16, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  content: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTail: {
    width: 64,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexShrink: 0,
    alignSelf: 'stretch',
    paddingVertical: 2,
  },
});
