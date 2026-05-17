import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { AppColors } from '@/lib/theme';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

const ITEMS = [
  {
    titleWidth: 154,
    metaPrimaryWidth: 0,
    metaSecondaryWidth: 0,
    timeWidth: 58,
    hasStatus: false,
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
        <View key={i} style={s.row} testID="channel-skeleton-row">
          {i > 0 ? <View style={dividerStyle(colors)} /> : null}
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
              <PulseBox width={item.titleWidth} height={18} radius={6} />
            </View>
            {item.metaPrimaryWidth > 0 ? (
              <View style={s.metaRow}>
                <PulseBox width={item.metaPrimaryWidth} height={14} radius={5} />
                {item.metaSecondaryWidth > 0 ? (
                  <>
                    <View style={[s.metaDot, { backgroundColor: colors.border }]} />
                    <PulseBox width={item.metaSecondaryWidth} height={14} radius={5} />
                  </>
                ) : null}
              </View>
            ) : (
              <PulseBox width={118} height={14} radius={5} />
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

function dividerStyle(colors: AppColors) {
  return [s.divider, { backgroundColor: colors.border }];
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  row: {
    position: 'relative',
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 0,
    paddingVertical: 14,
  },
  divider: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 62,
    height: StyleSheet.hairlineWidth,
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
  content: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 3 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 18 },
  metaDot: { width: 4, height: 4, borderRadius: 2 },
  rowTail: {
    width: 58,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexShrink: 0,
    alignSelf: 'stretch',
    paddingVertical: 2,
  },
});
