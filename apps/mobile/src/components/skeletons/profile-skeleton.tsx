import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

const PERSONAL_ROWS = 2;
const ACCOUNT_ROWS = 4;

function SettingRowSkeleton() {
  return (
    <View style={s.settingsRow}>
      <PulseBox width={20} height={20} radius={4} />
      <PulseBox width={140} height={14} radius={4} />
    </View>
  );
}

export function ProfileSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Loading" style={s.wrap}>
      {/* Profile card — matches profileCard / profileRow */}
      <View
        style={[
          s.profileCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={s.profileRow}>
          <PulseBox width={56} height={56} radius={28} />
          <View style={s.profileInfo}>
            <PulseBox width={140} height={16} radius={4} />
            <PulseBox width={180} height={12} radius={4} />
          </View>
        </View>
      </View>

      {/* Personal section card */}
      <View
        style={[
          s.sectionCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {Array.from({ length: PERSONAL_ROWS }).map((_, i) => (
          <View key={i}>
            <SettingRowSkeleton />
            {i < PERSONAL_ROWS - 1 && (
              <View style={[s.divider, { backgroundColor: colors.border }]} />
            )}
          </View>
        ))}
      </View>

      {/* Account section card */}
      <View
        style={[
          s.sectionCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {Array.from({ length: ACCOUNT_ROWS }).map((_, i) => (
          <View key={i}>
            <SettingRowSkeleton />
            {i < ACCOUNT_ROWS - 1 && (
              <View style={[s.divider, { backgroundColor: colors.border }]} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 20 },
  profileCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  profileInfo: { flex: 1, gap: 6 },
  sectionCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  divider: { height: 1, marginLeft: 60 },
});
