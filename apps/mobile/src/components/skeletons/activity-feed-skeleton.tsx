import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type Props = { count?: number };

// Widths vary per row so the skeleton looks like real varied content
const HEADLINE_WIDTHS = [200, 170, 220, 185, 160, 210];
const META_WIDTHS = [100, 130, 90, 115, 140, 95];

export function ActivityFeedSkeleton({ count = 4 }: Props) {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Loading" style={s.wrap}>
      {Array.from({ length: count }).map((_, i) => {
        const showPreview = i % 3 === 1; // every 3rd item has a preview card (like summary text)
        const headlineW = HEADLINE_WIDTHS[i % HEADLINE_WIDTHS.length]!;
        const metaW = META_WIDTHS[i % META_WIDTHS.length]!;

        return (
          <View
            key={i}
            style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {/* itemRow — row, alignItems: flex-start, gap: 12 */}
            <View style={s.itemRow}>
              {/* avatarWrap 52×52 — icon in a colored circle */}
              <PulseBox width={52} height={52} radius={26} />

              {/* content — flex: 1, paddingTop: 2 */}
              <View style={s.content}>
                {/* headlineRow — fontSize 15 lineHeight 22; some items also have a badge pill */}
                <View style={s.headlineRow}>
                  <PulseBox width={headlineW} height={22} radius={4} />
                  {i % 2 === 0 && (
                    /* emphasis badge — paddingH 8, paddingV 3, borderRadius 8, ~24px tall */
                    <PulseBox width={72} height={24} radius={8} />
                  )}
                </View>

                {/* metaRow — "2 mins ago  •  Classes", fontSize 13 */}
                <PulseBox width={metaW} height={13} radius={4} />
              </View>

              {/* unreadDot — 9×9, right side, marginTop 8 */}
              <PulseBox width={9} height={9} radius={5} />
            </View>

            {/* previewCard — marginLeft 64, borderRadius 12, ~3 lines of text */}
            {showPreview && (
              <View
                style={[
                  s.previewCard,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <PulseBox width={220} height={13} radius={4} />
                <PulseBox width={170} height={13} radius={4} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 8 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    minHeight: 80,
    gap: 0,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  content: { flex: 1, paddingTop: 2, gap: 8 },
  headlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
    marginBottom: 0,
  },
  previewCard: {
    marginTop: 10,
    marginLeft: 64,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
});
