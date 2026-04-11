import React from 'react';
import { View, StyleSheet } from 'react-native';

import { PulseBox } from './pulse-box';

type Props = {
  categoryCount?: number;
};

export function NotificationSettingsSkeleton({ categoryCount = 4 }: Props) {
  return (
    <View accessibilityLabel="Loading" style={s.container}>
      <View style={s.section}>
        <PulseBox width={118} height={12} radius={4} />
        <View style={s.card}>
          <SkeletonRow />
        </View>
      </View>

      <View style={s.section}>
        <PulseBox width={72} height={12} radius={4} />
        <View style={s.card}>
          {Array.from({ length: categoryCount }).map((_, index) => (
            <View key={index}>
              {index > 0 ? <View style={s.divider} /> : null}
              <SkeletonRow />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={s.row}>
      <PulseBox width={20} height={20} radius={10} />
      <View style={s.labelWrap}>
        <PulseBox width={156} height={15} radius={4} />
      </View>
      <PulseBox width={36} height={20} radius={10} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 48,
    gap: 14,
  },
  section: {
    gap: 6,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  labelWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48,
  },
});
