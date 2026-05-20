import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

const ROWS = [
  {
    titleLines: [232, 258],
    metaWidth: 126,
    previewLines: [242, 142],
    actionWidth: 82,
  },
  {
    titleLines: [226, 246],
    metaWidth: 126,
    previewLines: [238, 132],
    actionWidth: 82,
  },
  {
    titleLines: [238, 248],
    metaWidth: 128,
    previewLines: [248, 96],
    actionWidth: 72,
  },
] as const;

export function ActivityFeedSkeleton({ count = 3 }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const rows = ROWS.slice(0, Math.max(0, Math.min(count, ROWS.length)));
  const itemInnerWidth = Math.max(168, width - 64);
  const contentWidth = Math.max(126, itemInnerWidth - 38);
  const insetContentWidth = Math.max(126, itemInnerWidth - 42);
  const clamp = (value: number) => Math.min(value, contentWidth);
  const clampInset = (value: number) => Math.min(value, insetContentWidth - 28);

  return (
    <View accessibilityLabel="Loading" style={s.wrap} testID="activity-feed-skeleton">
      <View style={s.sectionHeader}>
        <PulseBox width={58} height={12} radius={4} />
      </View>

      {rows.map((row, index) => (
        <View key={index} style={s.itemOuter} testID="activity-skeleton-row">
          <View
            style={[
              s.itemWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={s.itemRow}>
              <View style={s.statusRail}>
                <View
                  style={[s.iconCircle, { backgroundColor: colors.inputBg }]}
                  testID="activity-skeleton-icon"
                >
                  <PulseBox width={11} height={11} radius={6} />
                </View>
                <View style={s.readCheck} testID="activity-skeleton-read-indicator">
                  <PulseBox width={14} height={2} radius={2} />
                  <PulseBox width={9} height={2} radius={2} />
                </View>
              </View>

              <View style={s.content}>
                <View style={s.headlineBlock}>
                  {row.titleLines.map((lineWidth, lineIndex) => (
                    <PulseBox
                      key={lineIndex}
                      width={clamp(lineWidth)}
                      height={22}
                      radius={5}
                    />
                  ))}
                </View>

                <PulseBox width={clamp(row.metaWidth)} height={18} radius={5} />
              </View>
            </View>

            <View
              style={[
                s.previewCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              testID="activity-skeleton-preview-card"
            >
              {row.previewLines.map((lineWidth, lineIndex) => (
                <PulseBox
                  key={lineIndex}
                  width={clampInset(lineWidth)}
                  height={20}
                  radius={5}
                />
              ))}
            </View>

            <View
              style={[s.actionButton, { borderColor: colors.border }]}
              testID="activity-skeleton-action"
            >
              <PulseBox width={row.actionWidth} height={16} radius={5} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 0, paddingBottom: 24 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  itemOuter: { marginHorizontal: 16, marginBottom: 8 },
  itemWrap: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    overflow: 'hidden',
    minHeight: 80,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusRail: {
    width: 28,
    flexShrink: 0,
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readCheck: {
    width: 18,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    transform: [{ rotate: '-30deg' }],
  },
  content: { flex: 1 },
  headlineBlock: {
    gap: 5,
    marginBottom: 5,
  },
  previewCard: {
    marginTop: 10,
    marginLeft: 42,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'center',
    gap: 8,
  },
  actionButton: {
    marginTop: 10,
    marginLeft: 42,
    alignSelf: 'flex-start',
    minWidth: 0,
    height: 36,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
