import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PulseBox } from './pulse-box';

const BUBBLES: {
  own: boolean;
  width: number;
  height: number;
  showName?: boolean;
  groupStart?: boolean;
}[] = [
  { own: false, width: 220, height: 42, showName: true, groupStart: true },
  { own: true, width: 160, height: 42 },
  { own: false, width: 240, height: 64, showName: true, groupStart: true },
  { own: true, width: 120, height: 42 },
  { own: false, width: 190, height: 42, showName: true, groupStart: true },
];

export function MessageBubblesSkeleton() {
  return (
    <View accessibilityLabel="Loading" style={s.wrap}>
      {BUBBLES.map((b, i) => (
        <View key={i} style={[s.row, b.own && s.rowOwn, b.groupStart && s.rowGroupStart]}>
          <View style={s.avatarSlot}>
            {!b.own && <PulseBox width={36} height={36} radius={18} />}
          </View>
          <View style={[s.contentCol, b.own && s.contentColOwn]}>
            {!b.own && b.showName ? <PulseBox width={72} height={14} radius={4} /> : null}
            <PulseBox width={b.width} height={b.height} radius={18} />
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexDirection: 'column-reverse',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 3 },
  rowOwn: { flexDirection: 'row-reverse' },
  rowGroupStart: { paddingTop: 12 },
  avatarSlot: { width: 36, flexShrink: 0, alignItems: 'center' },
  contentCol: { flex: 1, alignItems: 'flex-start', gap: 4 },
  contentColOwn: { alignItems: 'flex-end' },
});
