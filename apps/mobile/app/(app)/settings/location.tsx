import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function MapPinIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe:         { flex: 1, backgroundColor: C.pageBg },
    nav:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
    navBack:      { padding: 8, borderRadius: 8 },
    navTitle:     { flex: 1, fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center', marginRight: 40 },
    scroll:       { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 6 },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 4, paddingTop: 14, paddingBottom: 6 },
    card:         { borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, overflow: 'hidden' },
    divider:      { height: 1, backgroundColor: C.border, marginLeft: 60 },
    valueText:    { fontSize: 13, color: C.textMuted, maxWidth: 160, textAlign: 'right' },
    emptyValue:   { fontSize: 13, color: C.textFaint, fontStyle: 'italic' },
    emptyCard:    { padding: 24, alignItems: 'center', gap: 8 },
    emptyIcon:    { fontSize: 32 },
    emptyTitle:   { fontSize: 15, fontWeight: '600', color: C.text },
    emptyDesc:    { fontSize: 13, color: C.textMuted, textAlign: 'center' },
  });
}

function Val({ value, s }: { value?: string | null; s: ReturnType<typeof makeStyles> }) {
  if (!value) return <Text style={s.emptyValue}>Not set</Text>;
  return <Text style={s.valueText} numberOfLines={1}>{value}</Text>;
}

export default function LocationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: profile } = useProfile();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const prof = profile as Record<string, unknown> | undefined;
  const hasAnyLocation =
    prof?.country_name || prof?.country_code || prof?.region || prof?.city || prof?.postal_code;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Location</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionLabel}>Address</Text>

        {!hasAnyLocation ? (
          <View style={[s.card, s.emptyCard]}>
            <Text style={s.emptyIcon}>📍</Text>
            <Text style={s.emptyTitle}>No location set</Text>
            <Text style={s.emptyDesc}>Location details appear here once your profile is updated.</Text>
          </View>
        ) : (
          <View style={s.card}>
            <SettingsRow
              icon={<MapPinIcon color={colors.textMuted} />}
              label="Country"
              labelColor={colors.text}
              hideChevron
              trailing={
                <Val value={(prof?.country_name as string) ?? (prof?.country_code as string)} s={s} />
              }
            />
            <View style={s.divider} />
            <SettingsRow
              icon={<MapPinIcon color={colors.textMuted} />}
              label="Region / State"
              labelColor={colors.text}
              hideChevron
              trailing={<Val value={prof?.region as string} s={s} />}
            />
            <View style={s.divider} />
            <SettingsRow
              icon={<MapPinIcon color={colors.textMuted} />}
              label="City"
              labelColor={colors.text}
              hideChevron
              trailing={<Val value={prof?.city as string} s={s} />}
            />
            <View style={s.divider} />
            <SettingsRow
              icon={<MapPinIcon color={colors.textMuted} />}
              label="Postal Code"
              labelColor={colors.text}
              hideChevron
              trailing={<Val value={prof?.postal_code as string} s={s} />}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
