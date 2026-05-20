import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

const ROWS = [
  {
    titleLines: [250, 286],
    metaWidth: 142,
    previewLines: [278, 164],
    actionWidth: 112,
  },
  {
    titleLines: [266, 246],
    metaWidth: 142,
    previewLines: [278, 164],
    actionWidth: 112,
  },
  {
    titleLines: [238, 294],
    metaWidth: 128,
    previewLines: [262, 118],
    actionWidth: 96,
  },
] as const;

export function ActivityFeedSkeleton({ count = 3 }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const rows = ROWS.slice(0, Math.max(0, Math.min(count, ROWS.length)));
  const contentWidth = Math.max(168, width - 124);
  const clamp = (value: number) => Math.min(value, contentWidth);
  const previewWidth = Math.max(168, contentWidth - 8);

  return (
    <View accessibilityLabel="Loading" style={s.wrap} testID="activity-feed-skeleton">
      <View style={s.sectionHeader}>
        <PulseBox width={64} height={14} radius={4} />
      </View>

      {rows.map((row, index) => (
        <View key={index} style={s.itemOuter} testID="activity-skeleton-row">
          <View style={s.itemRow}>
            <View style={s.statusRail}>
              <View
                style={[
                  s.iconCircle,
                  { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
                testID="activity-skeleton-icon"
              >
                <PulseBox width={16} height={16} radius={8} />
              </View>
              <View style={s.readCheck} testID="activity-skeleton-read-indicator">
                <PulseBox width={14} height={3} radius={2} />
                <PulseBox width={10} height={3} radius={2} />
              </View>
            </View>

            <View style={s.content}>
              <View style={s.headlineBlock}>
                {row.titleLines.map((lineWidth, lineIndex) => (
                  <PulseBox
                    key={lineIndex}
                    width={clamp(lineWidth)}
                    height={24}
                    radius={5}
                  />
                ))}
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
                  <PulseBox
                    key={lineIndex}
                    width={Math.min(width, previewWidth)}
                    height={22}
                    radius={5}
                  />
                ))}
              </View>

              <View
                style={[s.actionButton, { borderColor: colors.border }]}
                testID="activity-skeleton-action"
              >
                <PulseBox width={row.actionWidth} height={18} radius={5} />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 18, paddingBottom: 24 },
  sectionHeader: { paddingHorizontal: 26, paddingTop: 18, paddingBottom: 14 },
  itemOuter: { marginHorizontal: 24, marginBottom: 20 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  statusRail: {
    width: 52,
    flexShrink: 0,
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readCheck: {
    width: 18,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    transform: [{ rotate: '-30deg' }],
  },
  content: { flex: 1 },
  headlineBlock: {
    gap: 6,
    marginBottom: 8,
  },
  previewCard: {
    marginTop: 14,
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 22,
    justifyContent: 'center',
    gap: 8,
  },
  actionButton: {
    marginTop: 20,
    alignSelf: 'flex-start',
    minWidth: 138,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
