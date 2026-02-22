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
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SettingsRow } from '@iconicedu/ui-native';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors, ThemeMode } from '@/lib/theme';

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17L4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function AppearanceIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3V4M12 20V21M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M3 12H4M20 12H21M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
function ClockIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.8} />
      <Path d="M12 6V12L16 14" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function GlobeIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.8} />
      <Path d="M2 12H22M12 2C12 2 8 6 8 12C8 18 12 22 12 22C12 22 16 18 16 12C16 6 12 2 12 2Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function LanguageIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M5 8L10 13M4 14L9 9L11 6M2 6H12M7 2V4M22 22L17 12L12 22M13.5 19H20.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const MODE_OPTIONS: { value: ThemeMode; label: string; sub: string }[] = [
  { value: 'system', label: 'System', sub: 'Follow device setting' },
  { value: 'light',  label: 'Light',  sub: 'Always light' },
  { value: 'dark',   label: 'Dark',   sub: 'Always dark' },
];

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
    valueText:    { fontSize: 13, color: C.textMuted, marginRight: 4 },
    emptyValue:   { fontSize: 13, color: C.textFaint, fontStyle: 'italic', marginRight: 4 },
    // Appearance modal
    overlay:      { flex: 1, backgroundColor: C.modalOverlay, justifyContent: 'flex-end' },
    sheet:        { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 40 },
    sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },
    sheetTitle:   { fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 16 },
    modeRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, gap: 14 },
    modeLabel:    { flex: 1, fontSize: 16, color: C.text, fontWeight: '500' },
    modeSub:      { fontSize: 13, color: C.textMuted },
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
          <ChevronLeftIcon color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Preferences</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Appearance */}
        <Text style={s.sectionLabel}>Appearance</Text>
        <View style={s.card}>
          <SettingsRow
            icon={<AppearanceIcon color={colors.textMuted} />}
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
            icon={<ClockIcon color={colors.textMuted} />}
            label="Timezone"
            labelColor={colors.text}
            hideChevron
            trailing={
              prof?.timezone
                ? <Text style={s.valueText} numberOfLines={1}>{prof.timezone as string}</Text>
                : <Text style={s.emptyValue}>Not set</Text>
            }
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<GlobeIcon color={colors.textMuted} />}
            label="Locale"
            labelColor={colors.text}
            hideChevron
            trailing={
              prof?.locale
                ? <Text style={s.valueText}>{prof.locale as string}</Text>
                : <Text style={s.emptyValue}>Not set</Text>
            }
          />
          <View style={s.divider} />
          <SettingsRow
            icon={<LanguageIcon color={colors.textMuted} />}
            label="Languages"
            labelColor={colors.text}
            hideChevron
            trailing={
              langs?.length
                ? <Text style={s.valueText} numberOfLines={1}>{langs.join(', ')}</Text>
                : <Text style={s.emptyValue}>Not set</Text>
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
                    <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 24 }} />
                  )}
                  <TouchableOpacity
                    style={s.modeRow}
                    onPress={() => { setMode(opt.value); setShowAppearance(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={s.modeLabel}>{opt.label}</Text>
                      <Text style={s.modeSub}>{opt.sub}</Text>
                    </View>
                    {mode === opt.value && <CheckIcon color={colors.teal} />}
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
