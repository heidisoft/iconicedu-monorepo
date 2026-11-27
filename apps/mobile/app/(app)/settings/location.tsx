import { useProfileItemEditor } from '@/components/profile/profile-item-editor';
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useSettingsProfile } from '@/hooks/use-settings-profile';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.pageBg },
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    navBack: { padding: 8, borderRadius: 8 },
    navTitle: {
      flex: 1,
      fontSize: 19,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginRight: 40,
    },
    scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 6 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 4,
      paddingTop: 14,
      paddingBottom: 6,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      overflow: 'hidden',
    },
    divider: { height: 1, backgroundColor: C.border, marginLeft: 60 },
    valueText: { fontSize: 14, color: C.textMuted, maxWidth: 160, textAlign: 'right' },
    emptyValue: { fontSize: 14, color: C.textFaint, fontStyle: 'italic' },
    emptyCard: { padding: 24, alignItems: 'center', gap: 8 },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.inputBg,
    },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
    emptyDesc: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  });
}

function Val({ value, s }: { value?: string | null; s: ReturnType<typeof makeStyles> }) {
  if (!value) return <Text style={s.emptyValue}>Not set</Text>;
  return (
    <Text style={s.valueText} numberOfLines={1}>
      {value}
    </Text>
  );
}

export default function LocationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: profile, isPending, isError, refetch } = useSettingsProfile();
  const items = useProfileItemEditor(profile?.id);
  const s = useMemo(() => makeStyles(colors), [colors]);

  const prof = profile as Record<string, unknown> | undefined;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Location</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {isPending ? (
          <Text style={s.emptyValue}>Loading…</Text>
        ) : isError ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => void refetch()}>
            <Text style={s.emptyValue}>Unable to load details. Tap to retry.</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={s.sectionLabel}>Address</Text>
            </View>

            {
              <View style={s.card}>
                <SettingsRow
                  icon={<MapPin size={20} color={colors.textMuted} />}
                  label="Country"
                  onPress={items.edit ? () => items.edit?.('country_code') : undefined}
                  labelColor={colors.text}
                  hideChevron
                  trailing={
                    <Val
                      value={
                        (prof?.country_name as string) ?? (prof?.country_code as string)
                      }
                      s={s}
                    />
                  }
                />
                <View style={s.divider} />
                <SettingsRow
                  icon={<MapPin size={20} color={colors.textMuted} />}
                  label="Region / State"
                  onPress={
                    items.edit
                      ? () => items.edit?.(prof?.country_code ? 'region' : 'country_code')
                      : undefined
                  }
                  labelColor={colors.text}
                  hideChevron
                  trailing={<Val value={prof?.region as string} s={s} />}
                />
                <View style={s.divider} />
                <SettingsRow
                  icon={<MapPin size={20} color={colors.textMuted} />}
                  label="City"
                  onPress={
                    items.edit
                      ? () => items.edit?.(prof?.country_code ? 'city' : 'country_code')
                      : undefined
                  }
                  labelColor={colors.text}
                  hideChevron
                  trailing={<Val value={prof?.city as string} s={s} />}
                />
                <View style={s.divider} />
                <SettingsRow
                  icon={<MapPin size={20} color={colors.textMuted} />}
                  label="Postal Code"
                  onPress={
                    items.edit
                      ? () =>
                          items.edit?.(
                            prof?.country_code ? 'postal_code' : 'country_code',
                          )
                      : undefined
                  }
                  labelColor={colors.text}
                  hideChevron
                  trailing={<Val value={prof?.postal_code as string} s={s} />}
                />
              </View>
            }
          </>
        )}
      </ScrollView>
      {items.editor}
    </SafeAreaView>
  );
}
