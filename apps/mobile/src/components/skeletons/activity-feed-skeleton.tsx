import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

// Mirrors ActivityItem's card: 40px leading visual, headline with the compact
// time pinned top-right, then an inset panel aligned under the headline.
const LEADING_SIZE = 40;
const CONTENT_GAP = 12;
const CARD_PADDING = 16;
const TIME_WIDTH = 28;

const ROWS = [
  {
    titleLines: [360, 172],
    metaWidth: 64,
    detail: 'completion',
  },
  {
    titleLines: [360, 360, 176],
    metaWidth: 56,
    detail: 'preview',
  },
  {
    titleLines: [360, 220],
    metaWidth: 64,
    detail: 'preview',
  },
] as const;

export function ActivityFeedSkeleton({ count = 3 }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const rows = ROWS.slice(0, Math.max(0, Math.min(count, ROWS.length)));
  const cardInnerWidth = Math.max(168, width - 32 - CARD_PADDING * 2);
  const bodyWidth = Math.max(126, cardInnerWidth - LEADING_SIZE - CONTENT_GAP);
  const headlineWidth = Math.max(96, bodyWidth - TIME_WIDTH - 8);
  const clamp = (value: number) => Math.min(value, headlineWidth);
  const clampInset = (value: number) => Math.min(value, bodyWidth - 24);

  return (
    <View accessibilityLabel="Loading" style={s.wrap} testID="activity-feed-skeleton">
      <View style={s.sectionHeader}>
        <PulseBox width={92} height={12} radius={4} />
      </View>

      {rows.map((row, index) => (
        <View
          key={index}
          style={[s.card, { backgroundColor: colors.card }]}
          testID="activity-skeleton-row"
        >
          <View style={s.itemRow}>
            <View
              style={[s.leading, { backgroundColor: colors.bg }]}
              testID="activity-skeleton-icon"
            />

            <View style={s.content}>
              <View style={s.topRow}>
                <View style={s.headlineBlock}>
                  {row.titleLines.map((lineWidth, lineIndex) => (
                    <PulseBox
                      key={lineIndex}
                      width={clamp(lineWidth)}
                      height={15}
                      radius={4}
                    />
                  ))}
                </View>
                <PulseBox width={TIME_WIDTH} height={12} radius={4} />
              </View>

              <PulseBox width={row.metaWidth} height={12} radius={4} />
            </View>
          </View>

          <View
            style={[
              s.inset,
              row.detail === 'completion' && s.insetCompletion,
              { backgroundColor: colors.bg },
            ]}
            testID="activity-skeleton-preview-card"
          >
            <PulseBox width={clampInset(304)} height={13} radius={4} />
            <PulseBox
              width={clampInset(row.detail === 'completion' ? 248 : 128)}
              height={13}
              radius={4}
            />
            {row.detail === 'completion' ? (
              <View style={s.pillRow}>
                <PulseBox width={132} height={36} radius={18} />
                <PulseBox width={140} height={36} radius={18} />
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 0, paddingBottom: 24 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 18,
    padding: CARD_PADDING,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: CONTENT_GAP },
  leading: {
    width: LEADING_SIZE,
    height: LEADING_SIZE,
    borderRadius: LEADING_SIZE / 2,
  },
  content: { flex: 1, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headlineBlock: { flex: 1, gap: 6 },
  inset: {
    marginTop: 12,
    marginLeft: LEADING_SIZE + CONTENT_GAP,
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 6,
  },
  insetCompletion: {
    minHeight: 112,
    gap: 8,
  },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
