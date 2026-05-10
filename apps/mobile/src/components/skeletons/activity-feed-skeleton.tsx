import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

const ROWS = [
  {
    titleWidth: 268,
    contextWidth: 214,
    metaWidth: 128,
    previewLines: [250],
  },
  {
    titleWidth: 262,
    contextWidth: 206,
    metaWidth: 126,
    previewLines: [248],
  },
  {
    titleWidth: 286,
    contextWidth: 244,
    metaWidth: 126,
    previewLines: [276, 92],
  },
] as const;

export function ActivityFeedSkeleton({ count = 3 }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const rows = ROWS.slice(0, Math.max(0, Math.min(count, ROWS.length)));
  const contentWidth = Math.max(168, width - 126);
  const clamp = (value: number) => Math.min(value, contentWidth);

  return (
    <View accessibilityLabel="Loading" style={s.wrap} testID="activity-feed-skeleton">
      <View style={s.sectionHeader}>
        <PulseBox width={72} height={14} radius={4} />
      </View>

      {rows.map((row, index) => (
        <View key={index} style={s.itemOuter} testID="activity-skeleton-row">
          <View style={s.itemRow}>
            <View style={s.iconCircle} testID="activity-skeleton-icon">
              <PulseBox width={28} height={28} radius={14} />
            </View>

            <View style={s.content}>
              <View style={s.headlineBlock}>
                <PulseBox width={clamp(row.titleWidth)} height={22} radius={5} />
                <PulseBox width={clamp(row.contextWidth)} height={22} radius={5} />
              </View>

              <PulseBox width={clamp(row.metaWidth)} height={20} radius={5} />

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
                {row.previewLines.map((width, lineIndex) => (
                  <PulseBox key={lineIndex} width={clamp(width)} height={22} radius={5} />
                ))}
              </View>

              <View style={s.readMore}>
                <PulseBox width={88} height={20} radius={5} />
              </View>

              <View
                style={[s.actionButton, { borderColor: colors.border }]}
                testID="activity-skeleton-action"
              >
                <PulseBox width={92} height={18} radius={5} />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 30, paddingBottom: 24 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  itemOuter: { marginHorizontal: 16, marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconCircle: {
    width: 28,
    height: 28,
    flexShrink: 0,
    marginTop: 2,
  },
  content: { flex: 1 },
  headlineBlock: {
    gap: 5,
    marginBottom: 8,
  },
  previewCard: {
    marginTop: 10,
    marginLeft: 42,
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'center',
    gap: 8,
  },
  readMore: { marginTop: 8, marginLeft: 42 },
  actionButton: {
    marginTop: 10,
    marginLeft: 42,
    width: 110,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
