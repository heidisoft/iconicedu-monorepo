import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PulseBox } from './pulse-box';

// Mirrors the real MessageItem layout:
// paddingH: 12, gap: 8, avatar: 36×36 radius 18
// Bubble: borderRadius 18, paddingH: 14 paddingV: 10 + lineHeight 22 ≈ 42px for 1 line / 64px for 2 lines
const BUBBLES: { own: boolean; width: number; height: number }[] = [
  { own: false, width: 220, height: 42 },
  { own: true, width: 160, height: 42 },
  { own: false, width: 240, height: 64 },
  { own: true, width: 120, height: 42 },
  { own: false, width: 190, height: 42 },
];

export function MessageBubblesSkeleton() {
  return (
    <View accessibilityLabel="Loading" style={s.wrap}>
      {BUBBLES.map((b, i) => (
        <View key={i} style={[s.row, b.own ? s.rowOwn : s.rowOther]}>
          {/* Avatar slot — shown for "other" messages, width: 36 matches message-item */}
          {!b.own && <PulseBox width={36} height={36} radius={18} />}
          <PulseBox width={b.width} height={b.height} radius={18} />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 12, gap: 6, paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowOther: { justifyContent: 'flex-start' },
  rowOwn: { justifyContent: 'flex-end' },
});
