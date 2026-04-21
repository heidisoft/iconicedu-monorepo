import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

const ITEMS = [
  {
    titleWidth: 154,
    metaPrimaryWidth: 0,
    metaSecondaryWidth: 0,
    timeWidth: 58,
    hasStatus: true,
  },
  {
    titleWidth: 198,
    metaPrimaryWidth: 74,
    metaSecondaryWidth: 122,
    timeWidth: 58,
    hasStatus: false,
  },
  {
    titleWidth: 198,
    metaPrimaryWidth: 92,
    metaSecondaryWidth: 122,
    timeWidth: 58,
    hasStatus: false,
  },
  {
    titleWidth: 232,
    metaPrimaryWidth: 74,
    metaSecondaryWidth: 54,
    timeWidth: 58,
    hasStatus: false,
  },
  {
    titleWidth: 188,
    metaPrimaryWidth: 74,
    metaSecondaryWidth: 54,
    timeWidth: 58,
    hasStatus: false,
  },
  {
    titleWidth: 138,
    metaPrimaryWidth: 182,
    metaSecondaryWidth: 0,
    timeWidth: 58,
    hasStatus: false,
  },
  {
    titleWidth: 192,
    metaPrimaryWidth: 88,
    metaSecondaryWidth: 54,
    timeWidth: 58,
    hasStatus: false,
  },
  {
    titleWidth: 120,
    metaPrimaryWidth: 212,
    metaSecondaryWidth: 0,
    timeWidth: 58,
    hasStatus: false,
  },
];

export function ChannelListSkeleton({ count = 6 }: Props) {
  const { colors } = useTheme();
  const items = ITEMS.slice(0, count);

  return (
    <View accessibilityLabel="Loading" style={s.wrap} testID="channel-list-skeleton">
      {items.map((item, i) => (
        <View
          key={i}
          style={[s.row, i === 0 ? undefined : { borderTopColor: colors.border }]}
          testID="channel-skeleton-row"
        >
          <View style={s.avatarWrap}>
            <PulseBox width={50} height={50} radius={25} />
            {item.hasStatus ? (
              <View
                style={[s.statusDot, { borderColor: colors.bg }]}
                testID="channel-skeleton-status-dot"
              />
            ) : null}
          </View>

          <View style={s.content}>
            <View style={s.topRow}>
              <PulseBox width={item.titleWidth} height={20} radius={6} />
            </View>
            {item.metaPrimaryWidth > 0 ? (
              <View style={s.metaRow}>
                <PulseBox width={item.metaPrimaryWidth} height={15} radius={5} />
                {item.metaSecondaryWidth > 0 ? (
                  <>
                    <View style={[s.metaDot, { backgroundColor: colors.border }]} />
                    <PulseBox width={item.metaSecondaryWidth} height={15} radius={5} />
                  </>
                ) : null}
              </View>
            ) : (
              <PulseBox width={118} height={15} radius={5} />
            )}
          </View>

          <View style={s.rowTail}>
            <PulseBox width={item.timeWidth} height={16} radius={5} />
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  avatarWrap: {
    width: 50,
    height: 50,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#6b7280',
    borderWidth: 3,
  },
  content: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 7, paddingTop: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 15 },
  metaDot: { width: 4, height: 4, borderRadius: 2 },
  rowTail: {
    width: 58,
    alignItems: 'flex-end',
    flexShrink: 0,
    paddingTop: 4,
  },
});
