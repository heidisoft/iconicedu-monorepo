import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

const ROWS = [
  {
    titleLines: [360, 172],
    metaWidth: 126,
    detail: 'completion',
  },
  {
    titleLines: [360, 360, 176],
    metaWidth: 126,
    detail: 'class-card',
  },
  {
    titleLines: [360, 360, 176],
    metaWidth: 128,
    detail: 'class-card',
  },
] as const;

export function ActivityFeedSkeleton({ count = 3 }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const rows = ROWS.slice(0, Math.max(0, Math.min(count, ROWS.length)));
  const itemInnerWidth = Math.max(168, width - 32);
  const contentWidth = Math.max(126, itemInnerWidth - 38);
  const insetContentWidth = Math.max(126, itemInnerWidth - 42);
  const clamp = (value: number) => Math.min(value, contentWidth);
  const clampInset = (value: number) => Math.min(value, insetContentWidth - 28);

  return (
    <View accessibilityLabel="Loading" style={s.wrap} testID="activity-feed-skeleton">
      <View style={s.sectionHeader}>
        <PulseBox width={92} height={12} radius={4} />
      </View>

      {rows.map((row, index) => (
        <View key={index} style={s.itemOuter} testID="activity-skeleton-row">
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
                    height={17}
                    radius={4}
                  />
                ))}
              </View>

              <PulseBox width={clamp(row.metaWidth)} height={14} radius={4} />
            </View>
          </View>

          {row.detail === 'completion' ? (
            <View
              style={[
                s.completionCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              testID="activity-skeleton-preview-card"
            >
              <PulseBox width={clampInset(202)} height={10} radius={3} />
              <View style={s.completionBody}>
                <PulseBox width={clampInset(304)} height={13} radius={4} />
                <PulseBox width={clampInset(248)} height={13} radius={4} />
              </View>
            </View>
          ) : (
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
              <PulseBox width={clampInset(304)} height={15} radius={4} />
              <PulseBox width={clampInset(128)} height={15} radius={4} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 0, paddingBottom: 24 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  itemOuter: {
    marginHorizontal: 16,
    marginBottom: 22,
    paddingBottom: 0,
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
  completionCard: {
    marginTop: 10,
    marginLeft: 42,
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  completionBody: {
    gap: 6,
  },
  previewCard: {
    marginTop: 10,
    marginLeft: 42,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'center',
    gap: 5,
  },
});
