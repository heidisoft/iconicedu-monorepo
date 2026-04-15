import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

// Widths vary per row so the skeleton looks like real varied content
const HEADLINE_WIDTHS = [200, 170, 220, 185, 160, 210];
const META_WIDTHS = [100, 130, 90, 115, 140, 95];

export function ActivityFeedSkeleton({ count = 4 }: Props) {
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
              const showPreview = itemIdx % 3 === 1;
              const headlineW = HEADLINE_WIDTHS[itemIdx % HEADLINE_WIDTHS.length]!;
              const metaW = META_WIDTHS[itemIdx % META_WIDTHS.length]!;

              return (
                <View key={itemIdx} style={s.itemOuter}>
                  {/* itemRow mirrors activity-item layout */}
                  <View style={[s.card, s.cardContent]}>
                    <View style={s.itemRow}>
                      <View style={s.avatarWrap}>
                        <PulseBox width={28} height={28} radius={14} />
                      </View>

                      {/* content — flex: 1 */}
                      <View style={s.content}>
                        {/* headlineRow — fontSize 15 lineHeight 22; some items also have a badge pill */}
                        <View style={s.headlineRow}>
                          <PulseBox width={headlineW} height={22} radius={4} />
                          {itemIdx % 2 === 0 && (
                            /* emphasis badge — paddingH 8, paddingV 3, borderRadius 8, ~24px tall */
                            <PulseBox width={72} height={24} radius={8} />
                          )}
                        </View>

                        {/* metaRow — "2 mins ago  •  Classes", fontSize 13 lineHeight ~18 */}
                        <PulseBox width={metaW} height={18} radius={4} />
                      </View>

                      {/* unreadDot — 9×9, right side, marginTop 8 */}
                      <PulseBox width={9} height={9} radius={5} />
                    </View>

                    {/* previewCard aligns with content indent */}
                    {showPreview && (
                      <View style={s.previewCard}>
                        <PulseBox width={220} height={22} radius={4} />
                        <PulseBox width={170} height={22} radius={4} />
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
  cardContent: {},
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatarWrap: { width: 28, height: 28, flexShrink: 0, marginTop: 2 },
  content: { flex: 1 },
  headlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  previewCard: {
    marginTop: 10,
    marginLeft: 42,
    padding: 14,
    gap: 6,
  },
});
