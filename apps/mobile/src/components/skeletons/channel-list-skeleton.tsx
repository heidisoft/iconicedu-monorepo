import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

const ITEMS = [
  { nameWidth: 110, previewWidth: 200, hasBadge: true },
  { nameWidth: 220, previewWidth: 42, hasBadge: false },
  { nameWidth: 72, previewWidth: 180, hasBadge: false },
  { nameWidth: 170, previewWidth: 152, hasBadge: true },
  { nameWidth: 170, previewWidth: 152, hasBadge: false },
  { nameWidth: 164, previewWidth: 42, hasBadge: false },
  { nameWidth: 164, previewWidth: 42, hasBadge: false },
  { nameWidth: 88, previewWidth: 260, hasBadge: false },
];

export function ChannelListSkeleton({ count = 6 }: Props) {
  const items = ITEMS.slice(0, count);

  return (
    <View accessibilityLabel="Loading" style={s.wrap}>
      {items.map((item, i) => (
        <View key={i} style={s.itemOuter}>
          <View style={s.row}>
            <PulseBox width={44} height={44} radius={22} />

            <View style={s.content}>
              <View style={s.topRow}>
                <PulseBox width={item.nameWidth} height={20} radius={4} />
              </View>
              <PulseBox width={item.previewWidth} height={14} radius={4} />
            </View>

            <View style={s.rowTail}>
              <PulseBox width={36} height={14} radius={4} />
              {item.hasBadge ? <PulseBox width={20} height={20} radius={10} /> : <View />}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 16, paddingBottom: 24 },
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
