import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Check, Sun, Clock, Globe, Languages } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors, ThemeMode } from '@/lib/theme';

const MODE_OPTIONS: { value: ThemeMode; label: string; sub: string }[] = [
  { value: 'system', label: 'System', sub: 'Follow device setting' },
  { value: 'light', label: 'Light', sub: 'Always light' },
  { value: 'dark', label: 'Dark', sub: 'Always dark' },
];

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
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginRight: 40,
    },
    scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 6 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
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
    valueText: { fontSize: 13, color: C.textMuted, marginRight: 4 },
    emptyValue: { fontSize: 13, color: C.textFaint, fontStyle: 'italic', marginRight: 4 },
    // Appearance modal
    overlay: { flex: 1, backgroundColor: C.modalOverlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingBottom: 40,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: 20,
    },
    sheetTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      gap: 14,
    },
    modeLabel: { flex: 1, fontSize: 16, color: C.text, fontWeight: '500' },
    modeSub: { fontSize: 13, color: C.textMuted },
  });
}

export default function PreferencesScreen() {
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const { data: profile } = useProfile();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [showAppearance, setShowAppearance] = useState(false);

  const prof = profile as Record<string, unknown> | undefined;
  const modeLabel = MODE_OPTIONS.find((o) => o.value === mode)?.label ?? 'System';
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
        {/* Appearance */}
        <Text style={s.sectionLabel}>Appearance</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<Sun size={20} color={colors.textMuted} />}
            label="Theme"
            labelColor={colors.text}
            chevronColor={colors.textFaint}
            onPress={() => setShowAppearance(true)}
            trailing={<Text style={s.valueText}>{modeLabel}</Text>}
          />
        </View>

        {/* Regional */}
        <Text style={s.sectionLabel}>Regional</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<Clock size={20} color={colors.textMuted} />}
            label="Timezone"
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
      </ScrollView>

      {/* Appearance picker sheet */}
      <Modal
        visible={showAppearance}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAppearance(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowAppearance(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitle}>Appearance</Text>
              {MODE_OPTIONS.map((opt, i) => (
                <React.Fragment key={opt.value}>
                  {i > 0 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: colors.border,
                        marginHorizontal: 24,
                      }}
                    />
                  )}
                  <TouchableOpacity
                    style={s.modeRow}
                    onPress={() => {
                      setMode(opt.value);
                      setShowAppearance(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={s.modeLabel}>{opt.label}</Text>
                      <Text style={s.modeSub}>{opt.sub}</Text>
                    </View>
                    {mode === opt.value && <Check size={20} color={colors.teal} />}
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
