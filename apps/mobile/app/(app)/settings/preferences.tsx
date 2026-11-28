import { MODE_OPTIONS } from '@/components/profile/theme-mode-options';
import { useProfileItemEditor } from '@/components/profile/profile-item-editor';
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Sun, Moon, Clock, Globe, Languages } from 'lucide-react-native';
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
    valueText: { fontSize: 14, color: C.textMuted, marginRight: 4 },
    emptyValue: { fontSize: 14, color: C.textFaint, fontStyle: 'italic', marginRight: 4 },
  });
}

export default function PreferencesScreen() {
  const router = useRouter();
  const { colors, mode, colorScheme } = useTheme();
  const { data: profile, isPending, isError, refetch } = useSettingsProfile();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const items = useProfileItemEditor(profile?.id);

  const prof = profile as Record<string, unknown> | undefined;
  const modeLabel = MODE_OPTIONS.find((o) => o.value === mode)?.label ?? 'System';
  const appearanceLabel =
    mode === 'system'
      ? `System · ${colorScheme === 'dark' ? 'Dark' : 'Light'}`
      : modeLabel;
  const ThemeIcon = colorScheme === 'dark' ? Moon : Sun;
  const langs = prof?.languages_spoken as string[] | null;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity style={s.navBack} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Preferences</Text>
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
            {/* Appearance */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={s.sectionLabel}>Appearance</Text>
            </View>
            <View style={s.card}>
              <SettingsRow
                icon={<ThemeIcon size={20} color={colors.textMuted} />}
                label="Theme"
                labelColor={colors.text}
                chevronColor={colors.textFaint}
                onPress={items.edit ? () => items.edit?.('mode') : undefined}
                trailing={<Text style={s.valueText}>{appearanceLabel}</Text>}
              />
              <View style={s.divider} />
              <SettingsRow
                icon={<Sun size={20} color={colors.textMuted} />}
                label="Accent Color"
                onPress={items.edit ? () => items.edit?.('ui_theme_key') : undefined}
                labelColor={colors.text}
                hideChevron
                trailing={
                  <Text style={s.valueText}>{String(prof?.ui_theme_key ?? 'green')}</Text>
                }
              />
            </View>

            {/* Regional */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={s.sectionLabel}>Regional</Text>
            </View>
            <View style={s.card}>
              <SettingsRow
                icon={<Clock size={20} color={colors.textMuted} />}
                label="Timezone"
                onPress={items.edit ? () => items.edit?.('timezone') : undefined}
                labelColor={colors.text}
                hideChevron
                trailing={
                  prof?.timezone ? (
                    <Text style={s.valueText} numberOfLines={1}>
                      {prof.timezone as string}
                    </Text>
                  ) : (
                    <Text style={s.emptyValue}>Not set</Text>
                  )
                }
              />
              <View style={s.divider} />
              <SettingsRow
                icon={<Globe size={20} color={colors.textMuted} />}
                label="Locale"
                onPress={items.edit ? () => items.edit?.('locale') : undefined}
                labelColor={colors.text}
                hideChevron
                trailing={
                  prof?.locale ? (
                    <Text style={s.valueText}>{prof.locale as string}</Text>
                  ) : (
                    <Text style={s.emptyValue}>Not set</Text>
                  )
                }
              />
              <View style={s.divider} />
              <SettingsRow
                icon={<Languages size={20} color={colors.textMuted} />}
                label="Languages"
                onPress={items.edit ? () => items.edit?.('languages_spoken') : undefined}
                labelColor={colors.text}
                hideChevron
                trailing={
                  langs?.length ? (
                    <Text style={s.valueText} numberOfLines={1}>
                      {langs.join(', ')}
                    </Text>
                  ) : (
                    <Text style={s.emptyValue}>Not set</Text>
                  )
                }
              />
            </View>
          </>
        )}
      </ScrollView>

      {items.editor}
    </SafeAreaView>
  );
}
