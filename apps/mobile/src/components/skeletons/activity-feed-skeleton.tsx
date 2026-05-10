import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

const ROWS = [
  {
    iconBg: '#fef3c7',
    iconFg: '#d97706',
    titleWidth: 268,
    contextWidth: 214,
    metaWidth: 128,
    previewLines: [250],
  },
  {
    iconBg: '#fef3c7',
    iconFg: '#d97706',
    titleWidth: 262,
    contextWidth: 206,
    metaWidth: 126,
    previewLines: [248],
  },
  {
    iconBg: '#dbeafe',
    iconFg: '#2563eb',
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
            <View
              style={[s.iconCircle, { backgroundColor: row.iconBg }]}
              testID="activity-skeleton-icon"
            >
              <Bell size={16} color={row.iconFg} strokeWidth={2} />
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
  sectionHeader: { paddingHorizontal: 36, paddingBottom: 18 },
  itemOuter: { paddingHorizontal: 36, marginBottom: 26 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 22 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  content: { flex: 1 },
  headlineBlock: {
    gap: 5,
    marginBottom: 8,
  },
  previewCard: {
    marginTop: 20,
    minHeight: 58,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    gap: 8,
  },
  readMore: { marginTop: 16 },
  actionButton: {
    marginTop: 18,
    width: 110,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
