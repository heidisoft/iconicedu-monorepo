import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

export function ActivityFeedSkeleton({ count = 4 }: Props) {
  const { colors } = useTheme();
  const itemsPerSection = Math.ceil(count / 2);

  return (
    <View accessibilityLabel="Loading" style={s.wrap}>
      {Array.from({ length: 2 }).map((_, sectionIdx) => {
        const startIdx = sectionIdx * itemsPerSection;
        const endIdx = Math.min(startIdx + itemsPerSection, count);
        const sectionCount = endIdx - startIdx;

        if (sectionCount === 0) return null;

        return (
          <View key={sectionIdx}>
            {/* Section header */}
            <View style={s.sectionHeader}>
              <PulseBox width={72} height={13} radius={4} />
            </View>

            {/* Section items */}
            {Array.from({ length: sectionCount }).map((_, i) => {
              const itemIdx = startIdx + i;

              return (
                <View key={itemIdx} style={s.itemOuter}>
                  <View
                    style={[
                      s.card,
                      {
                        backgroundColor: colors.card,
                        borderRadius: 14,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={s.itemRow}>
                      <View style={s.avatarWrap}>
                        <PulseBox width={28} height={28} radius={14} />
                      </View>

                      {/* content — flex: 1 */}
                      <View style={s.content}>
                        {/* headlineRow — two lines for multi-line wrapping */}
                        <View style={s.headlineRow}>
                          <PulseBox width={240} height={18} radius={4} />
                          <PulseBox width={160} height={18} radius={4} />
                        </View>

                        {/* metaRow — "48 mins ago · 1 items" */}
                        <PulseBox width={120} height={18} radius={4} />
                      </View>
                    </View>

                    {/* previewCard — always show */}
                    <View
                      style={[
                        s.previewCard,
                        {
                          borderRadius: 12,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <PulseBox width={220} height={22} radius={4} />
                    </View>

                    {/* action button — on every other item */}
                    {itemIdx % 2 === 0 && (
                      <View style={s.actionButton}>
                        <PulseBox width={96} height={34} radius={17} />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 24 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  itemOuter: { marginHorizontal: 16, marginBottom: 8 },
  card: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    minHeight: 80,
    gap: 0,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatarWrap: { width: 28, height: 28, flexShrink: 0, marginTop: 2 },
  content: { flex: 1 },
  headlineRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 5,
  },
  previewCard: {
    marginTop: 10,
    marginLeft: 42,
    padding: 14,
    gap: 6,
  },
  actionButton: {
    marginTop: 10,
    marginLeft: 42,
  },
});
